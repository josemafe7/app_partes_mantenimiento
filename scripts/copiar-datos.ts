/**
 * Copia los datos de producción al entorno de desarrollo, para trabajar en
 * local con lo mismo que hay en la aplicación de verdad.
 *
 *   pnpm datos:copiar                  # producción -> desarrollo
 *   pnpm datos:copiar --sin-escribir   # solo el respaldo y el resumen
 *
 * Cómo lo hace, y por qué así:
 *
 * - Lee producción con el rol `app_avisos`, que solo puede hacer `select`, y
 *   escribe únicamente en desarrollo. Antes de tocar nada comprueba que el
 *   destino no es producción, así que no hay forma de invertir la dirección.
 * - Antes de escribir guarda lo leído en `respaldos/`. En el plan free de
 *   Supabase no hay copias automáticas, así que ese archivo es la copia de
 *   seguridad de producción del día.
 * - Cada tabla viaja como JSON y se vuelca con `jsonb_populate_recordset`
 *   sobre el propio tipo de la tabla: es Postgres quien convierte las fechas,
 *   los arrays y los números, sin listas de columnas escritas a mano que se
 *   queden viejas al cambiar el esquema.
 * - **No copia usuarios.** `perfiles` cuelga de `auth.users` y los usuarios de
 *   desarrollo son otros (`pnpm usuarios:prueba`), así que `usuario_id` de
 *   `movimientos` y `creado_por` de `partes` llegan en blanco: las dos
 *   columnas admiten nulo.
 */

import { mkdirSync, writeFileSync } from 'node:fs'

import postgres from 'postgres'

import {
  ARCHIVO,
  banderas,
  describirDestino,
  esProduccion,
  exigirCoherencia,
  exigirDesarrollo,
  refsDe,
  variablesDe,
  type Variables,
} from './entornos'

/** Las tablas de datos, en el orden en que se pueden insertar. */
const TABLAS = ['clientes', 'locales', 'tecnicos', 'avisos', 'partes', 'movimientos'] as const

type Tabla = (typeof TABLAS)[number]

/** Columnas que no se copian porque apuntan a usuarios, que no se copian. */
const COLUMNAS_DE_USUARIO: Partial<Record<Tabla, readonly string[]>> = {
  movimientos: ['usuario_id'],
  partes: ['creado_por'],
}

type Fila = Record<string, unknown>

function conectar(variables: Variables, cual: string) {
  const url = variables.DATABASE_URL
  if (!url) throw new Error(`Falta DATABASE_URL en el archivo de ${cual}.`)
  // Una conexión y poco tiempo de espera: las 15 del pooler se reparten entre
  // todo lo que haya abierto (ver AGENTS.md).
  return postgres(url, { max: 1, idle_timeout: 5, connect_timeout: 15 })
}

/** Cada fila como objeto JSON, tal y como la devuelve Postgres. */
async function leerTabla(bd: postgres.Sql, tabla: Tabla): Promise<Fila[]> {
  const filas = await bd<{ fila: Fila }[]>`select to_jsonb(t) as fila from ${bd(tabla)} t order by t.id`
  const sobran = COLUMNAS_DE_USUARIO[tabla] ?? []
  return filas.map(({ fila }) => {
    for (const columna of sobran) delete fila[columna]
    return fila
  })
}

function guardarRespaldo(refOrigen: string, datos: Record<Tabla, Fila[]>): string {
  const marca = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const archivo = `respaldos/${marca}-${refOrigen}.json`
  mkdirSync('respaldos', { recursive: true })
  writeFileSync(archivo, JSON.stringify({ proyecto: refOrigen, fecha: new Date().toISOString(), datos }, null, 2))
  return archivo
}

async function volcar(bd: postgres.Sql, datos: Record<Tabla, Fila[]>): Promise<void> {
  await bd.begin(async (tx) => {
    // Al revés que al insertar: primero lo que cuelga de otras tablas.
    for (const tabla of [...TABLAS].reverse()) {
      await tx.unsafe(`delete from ${comillas(tabla)}`)
    }

    for (const tabla of TABLAS) {
      const filas = datos[tabla]
      if (filas.length > 0) {
        // `overriding system value` porque los id son `generated always as
        // identity`: sin eso Postgres los renumeraría y las claves ajenas
        // dejarían de cuadrar.
        //
        // El parámetro va `$1::text::jsonb` y no `$1::jsonb`: con el segundo,
        // Postgres deduce que el parámetro es jsonb, postgres.js aplica su
        // serializador de JSON y vuelve a codificar la cadena, así que al
        // servidor le llega un texto JSON en vez del array
        // («cannot call jsonb_populate_recordset on a non-array»). Al pasar
        // por text, el tipo queda fijado y la cadena viaja tal cual.
        await tx.unsafe(
          `insert into ${comillas(tabla)} overriding system value
             select * from jsonb_populate_recordset(null::${comillas(tabla)}, $1::text::jsonb)`,
          [JSON.stringify(filas)],
        )
      }

      // Que el siguiente id no choque con los copiados.
      const ultimo = Math.max(0, ...filas.map((fila) => Number(fila.id)))
      await tx.unsafe(`select setval(pg_get_serial_sequence($1, 'id'), $2::bigint, $3::boolean)`, [
        tabla,
        String(Math.max(ultimo, 1)),
        String(ultimo > 0),
      ])
    }
  })
}

/** Los nombres de tabla salen de TABLAS, pero se citan igual. */
function comillas(nombre: string): string {
  return `"${nombre.replace(/"/g, '""')}"`
}

async function principal() {
  const sinEscribir = banderas().has('sin-escribir')

  const origen = variablesDe('produccion')
  const destino = variablesDe('desarrollo')
  exigirCoherencia(origen, 'produccion')
  exigirCoherencia(destino, 'desarrollo')

  exigirDesarrollo(destino, 'La copia de datos escribe en el destino, y')

  const refOrigen = refsDe(origen).base
  const refDestino = refsDe(destino).base
  if (!refOrigen || refOrigen === refDestino) {
    throw new Error(
      `El origen (${ARCHIVO.produccion}) y el destino (${ARCHIVO.desarrollo}) tienen que ser dos proyectos distintos.`,
    )
  }
  if (!esProduccion(origen)) {
    console.log(`Aviso: ${ARCHIVO.produccion} no apunta al proyecto de producción, sino a ${refOrigen}.`)
  }

  console.log(`Origen:  ${describirDestino(origen)}`)
  console.log(`Destino: ${describirDestino(destino)}`)
  console.log('')

  const bdOrigen = conectar(origen, 'producción')
  const bdDestino = conectar(destino, 'desarrollo')

  try {
    const datos = {} as Record<Tabla, Fila[]>
    for (const tabla of TABLAS) {
      datos[tabla] = await leerTabla(bdOrigen, tabla)
      console.log(`  leídas ${String(datos[tabla].length).padStart(5)} filas de ${tabla}`)
    }

    const archivo = guardarRespaldo(refOrigen, datos)
    console.log(`\nRespaldo de producción guardado en ${archivo}`)

    if (sinEscribir) {
      console.log('\n--sin-escribir: no se ha tocado la base de desarrollo.')
      return
    }

    await volcar(bdDestino, datos)
    const total = TABLAS.reduce((suma, tabla) => suma + datos[tabla].length, 0)
    console.log(`\nCopiadas ${total} filas a desarrollo.`)
    console.log('Los usuarios no se copian: crea los de prueba con «pnpm usuarios:prueba».')
  } finally {
    await Promise.all([bdOrigen.end(), bdDestino.end()])
  }
}

principal().catch((error) => {
  console.error(`\n${error instanceof Error ? error.message : error}`)
  process.exitCode = 1
})

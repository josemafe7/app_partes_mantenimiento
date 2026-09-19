/** Consultas de avisos: listado con filtros, ficha, agenda y tablero. */

import { and, asc, desc, eq, isNull, sql, type SQL } from 'drizzle-orm'

import { bd, type Transaccion } from '@/db/cliente'
import { avisos, clientes, locales, tecnicos, type Aviso } from '@/db/esquema'
import { ESTADOS, type Estado } from '@/lib/dominio'
import { hoyISO } from '@/lib/fechas'
import type { FiltrosAvisos } from '@/lib/filtros'
import type { Ambito } from '@/lib/permisos'
import { normalizar } from '@/lib/utils'

const NO_CERRADOS = sql`${avisos.estado} not in ('finalizado', 'cancelado')`

/** Peso de la prioridad para poder ordenar «lo urgente primero» en SQL. */
const PESO_PRIORIDAD = sql`case ${avisos.prioridad}
  when 'urgente' then 3 when 'alta' then 2 when 'normal' then 1 else 0 end`

/** Los avisos cerrados caen al final de la lista. */
const PESO_CERRADO = sql`case when ${avisos.estado} in ('finalizado', 'cancelado') then 1 else 0 end`

const COLUMNAS_LISTA = {
  id: avisos.id,
  referencia: avisos.referencia,
  titulo: avisos.titulo,
  descripcion: avisos.descripcion,
  categoria: avisos.categoria,
  prioridad: avisos.prioridad,
  estado: avisos.estado,
  canalEntrada: avisos.canalEntrada,
  fechaAviso: avisos.fechaAviso,
  fechaProgramada: avisos.fechaProgramada,
  horaProgramada: avisos.horaProgramada,
  fechaCierre: avisos.fechaCierre,
  motivoEspera: avisos.motivoEspera,
  clienteId: clientes.id,
  clienteNombre: clientes.nombre,
  localId: locales.id,
  localNombre: locales.nombre,
  localCiudad: locales.ciudad,
  localDireccion: locales.direccion,
  tecnicoId: tecnicos.id,
  tecnicoNombre: tecnicos.nombre,
  tecnicoApellidos: tecnicos.apellidos,
  // Ver la nota sobre subconsultas correlacionadas en consultas/clientes.ts:
  // los nombres van a mano para que la correlación no se rompa.
  numPartes: sql<number>`(select count(*)::int from partes where partes.aviso_id = avisos.id)`,
  horasTotales: sql<number>`(
    select coalesce(sum(partes.horas), 0) from partes where partes.aviso_id = avisos.id
  )`,
}

/**
 * Lo que alcanza quien consulta (ver `ambitoDe` en permisos.ts): sin ámbito,
 * todos los avisos; con él, solo los del técnico. Un técnico sin ficha
 * vinculada no ve ninguno.
 */
export function condicionAmbito(ambito: Ambito): SQL | undefined {
  if (!ambito) return undefined
  if (ambito.tecnicoId === null) return sql`false`
  return eq(avisos.tecnicoId, ambito.tecnicoId)
}

function consultaBase() {
  return bd
    .select(COLUMNAS_LISTA)
    .from(avisos)
    .innerJoin(clientes, eq(avisos.clienteId, clientes.id))
    .innerJoin(locales, eq(avisos.localId, locales.id))
    .leftJoin(tecnicos, eq(avisos.tecnicoId, tecnicos.id))
    .$dynamic()
}

/** Traduce los filtros de la URL a condiciones SQL. */
function condiciones(filtros: FiltrosAvisos, ambito: Ambito): SQL[] {
  const hoy = hoyISO()
  const lista: SQL[] = []

  // El ámbito va siempre, y con AND: ningún filtro de la URL lo puede ampliar.
  const alcance = condicionAmbito(ambito)
  if (alcance) lista.push(alcance)

  // El estado explícito manda sobre el atajo de vista.
  if (filtros.estado) {
    lista.push(sql`${avisos.estado} = ${filtros.estado}`)
  } else {
    switch (filtros.vista) {
      case 'todos':
        break
      case 'finalizados':
        lista.push(sql`${avisos.estado} in ('finalizado', 'cancelado')`)
        break
      case 'hoy':
        lista.push(NO_CERRADOS, sql`${avisos.fechaProgramada} = ${hoy}`)
        break
      case 'retrasados':
        lista.push(NO_CERRADOS, sql`${avisos.fechaProgramada} < ${hoy}`)
        break
      case 'sin_asignar':
        lista.push(NO_CERRADOS, sql`${avisos.tecnicoId} is null`)
        break
      case 'urgentes':
        lista.push(NO_CERRADOS, sql`${avisos.prioridad} in ('alta', 'urgente')`)
        break
      default:
        lista.push(NO_CERRADOS)
    }
  }

  if (filtros.prioridad) lista.push(sql`${avisos.prioridad} = ${filtros.prioridad}`)
  if (filtros.categoria) lista.push(sql`${avisos.categoria} = ${filtros.categoria}`)
  if (filtros.cliente) lista.push(sql`${avisos.clienteId} = ${Number(filtros.cliente)}`)
  if (filtros.tecnico === 'sin') lista.push(sql`${avisos.tecnicoId} is null`)
  else if (filtros.tecnico) lista.push(sql`${avisos.tecnicoId} = ${Number(filtros.tecnico)}`)
  if (filtros.desde) lista.push(sql`${avisos.fechaProgramada} >= ${filtros.desde}`)
  if (filtros.hasta) lista.push(sql`${avisos.fechaProgramada} <= ${filtros.hasta}`)

  return lista
}

/**
 * La búsqueda por texto se resuelve en memoria con `normalizar()`, que quita
 * acentos y convierte ñ→n igual que en el resto de la aplicación. Para esta
 * escala (unos miles de avisos) el coste es imperceptible frente a obligar a
 * escribir «climatización» con tilde para encontrar el aviso.
 */
function filtrarPorTexto<T extends Record<string, unknown>>(filas: T[], q: string, campos: (keyof T)[]) {
  if (!q.trim()) return filas
  const termino = normalizar(q)
  return filas.filter((fila) =>
    campos
      .map((campo) => fila[campo])
      .filter((valor) => valor !== null && valor !== undefined && valor !== '')
      .some((valor) => normalizar(String(valor)).includes(termino)),
  )
}

const CAMPOS_BUSCABLES = [
  'referencia',
  'titulo',
  'descripcion',
  'clienteNombre',
  'localNombre',
  'localCiudad',
  'localDireccion',
  'tecnicoNombre',
  'tecnicoApellidos',
] as const

export async function listarAvisos(filtros: FiltrosAvisos, ambito?: Ambito) {
  const lista = condiciones(filtros, ambito)
  const filas = await consultaBase()
    .where(lista.length ? and(...lista) : undefined)
    .orderBy(
      asc(PESO_CERRADO),
      sql`${avisos.fechaProgramada} is null`,
      asc(avisos.fechaProgramada),
      desc(PESO_PRIORIDAD),
      desc(avisos.fechaAviso),
    )

  return filtrarPorTexto(filas, filtros.q, [...CAMPOS_BUSCABLES])
}

export type AvisoEnLista = Awaited<ReturnType<typeof listarAvisos>>[number]

/** Ficha completa: aviso, cliente, local, técnico, partes y movimientos. */
export async function obtenerAviso(id: number) {
  const fila = await bd.query.avisos.findFirst({
    where: eq(avisos.id, id),
    with: {
      cliente: true,
      local: true,
      tecnico: true,
      partes: {
        with: { tecnico: true, creador: { columns: { id: true, nombre: true, tecnicoId: true } } },
        orderBy: (parte, { desc: descendente }) => [descendente(parte.fecha), descendente(parte.id)],
      },
      movimientos: {
        with: { usuario: { columns: { id: true, nombre: true } } },
        orderBy: (movimiento, { desc: descendente }) => [descendente(movimiento.fecha), descendente(movimiento.id)],
      },
    },
  })
  return fila ?? null
}

export type AvisoCompleto = NonNullable<Awaited<ReturnType<typeof obtenerAviso>>>

export async function obtenerParte(id: number) {
  const fila = await bd.query.partes.findFirst({
    where: (parte, { eq: igual }) => igual(parte.id, id),
    with: { aviso: true, tecnico: true },
  })
  return fila ?? null
}

/* ------------------------------------------------------------------- Agenda */

/** Avisos programados entre dos fechas, para la agenda semanal. */
export async function avisosProgramados(desde: string, hasta: string, tecnicoId?: number, ambito?: Ambito) {
  const lista: SQL[] = [
    sql`${avisos.fechaProgramada} is not null`,
    sql`${avisos.fechaProgramada} >= ${desde}`,
    sql`${avisos.fechaProgramada} <= ${hasta}`,
  ]
  if (tecnicoId) lista.push(sql`${avisos.tecnicoId} = ${tecnicoId}`)
  const alcance = condicionAmbito(ambito)
  if (alcance) lista.push(alcance)

  // Dentro de cada día, primero los que no tienen hora (Postgres los pondría al final).
  return consultaBase()
    .where(and(...lista))
    .orderBy(
      asc(avisos.fechaProgramada),
      sql`${avisos.horaProgramada} asc nulls first`,
      desc(PESO_PRIORIDAD),
    )
}

/** Avisos sin fecha prevista y sin cerrar: el trabajo que se queda sin planificar. */
export async function avisosSinProgramar(limite = 20, ambito?: Ambito) {
  return consultaBase()
    .where(and(NO_CERRADOS, isNull(avisos.fechaProgramada), condicionAmbito(ambito)))
    .orderBy(desc(PESO_PRIORIDAD), desc(avisos.fechaAviso))
    .limit(limite)
}

/* ------------------------------------------------------------------ Tablero */

/** Avisos agrupados por estado, para el tablero. */
export async function avisosPorEstado(tecnicoId?: number) {
  const filas = await consultaBase()
    .where(tecnicoId ? eq(avisos.tecnicoId, tecnicoId) : undefined)
    .orderBy(desc(PESO_PRIORIDAD), sql`${avisos.fechaProgramada} is null`, asc(avisos.fechaProgramada))

  const agrupados = Object.fromEntries(ESTADOS.map((estado) => [estado, [] as AvisoEnLista[]])) as Record<
    Estado,
    AvisoEnLista[]
  >
  for (const fila of filas) agrupados[fila.estado].push(fila)
  return agrupados
}

/* ------------------------------------------------- Dentro de una transacción */

/**
 * Lee un aviso y lo reserva (FOR UPDATE) hasta que termine la transacción. Si
 * otra acción quiere cambiar el mismo aviso a la vez, espera a que esta acabe
 * y después ve lo que dejó, así ninguna decide sobre un estado ya caducado.
 */
export async function avisoBloqueado(tx: Transaccion, id: number): Promise<Aviso | null> {
  const [aviso] = await tx.select().from(avisos).where(eq(avisos.id, id)).for('update')
  return aviso ?? null
}

/* -------------------------------------------------------------- Referencias */

/**
 * Siguiente referencia del año: AV-2026-0001, AV-2026-0002…
 *
 * Se calcula dentro de la transacción que inserta el aviso y bajo un cerrojo
 * que dura hasta el final de esa transacción: así dos altas simultáneas no
 * pueden llevarse el mismo número (la segunda espera a que la primera termine).
 */
export async function siguienteReferencia(tx: Transaccion): Promise<string> {
  await tx.execute(sql`select pg_advisory_xact_lock(hashtext('avisos.referencia'))`)

  const anio = new Date().getFullYear()
  const prefijo = `AV-${anio}-`
  const [fila] = await tx
    .select({ ultima: sql<string | null>`max(${avisos.referencia})` })
    .from(avisos)
    .where(sql`${avisos.referencia} like ${`${prefijo}%`}`)

  const ultimoNumero = fila?.ultima ? Number(fila.ultima.slice(prefijo.length)) : 0
  const siguiente = Number.isFinite(ultimoNumero) ? ultimoNumero + 1 : 1
  return `${prefijo}${String(siguiente).padStart(4, '0')}`
}

/* ------------------------------------------------------------ Otras consultas */

/** Avisos de un cliente o de un local, para sus fichas. */
export async function avisosDe(
  ambito: { clienteId: number } | { localId: number } | { tecnicoId: number },
  limite = 25,
) {
  const condicion =
    'clienteId' in ambito
      ? eq(avisos.clienteId, ambito.clienteId)
      : 'localId' in ambito
        ? eq(avisos.localId, ambito.localId)
        : eq(avisos.tecnicoId, ambito.tecnicoId)

  return consultaBase()
    .where(condicion)
    .orderBy(asc(PESO_CERRADO), desc(avisos.fechaAviso))
    .limit(limite)
}

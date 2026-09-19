/** Consultas de técnicos. */

import { and, asc, count, desc, eq, gte, sql } from 'drizzle-orm'

import { bd } from '@/db/cliente'
import { avisos, partes, tecnicos } from '@/db/esquema'
import { hoyISO, sumarDias } from '@/lib/fechas'
import { normalizar } from '@/lib/utils'

/*
 * Subconsultas correlacionadas.
 *
 * Los nombres de tabla y columna van escritos a mano en lugar de interpolar los
 * objetos de Drizzle: dentro de una plantilla `sql` Drizzle escribe las columnas
 * SIN cualificar («tecnico_id = id»), y en una subconsulta eso se resuelve
 * contra la tabla de dentro en vez de la de fuera, así que la correlación se
 * rompe en silencio y los recuentos salen a cero. Los valores sí se interpolan
 * (llegan como parámetros). Las pruebas de `tests/consultas.test.ts` comprueban
 * que estos números cuadran con los datos de ejemplo. Los recuentos llevan
 * `::int` por lo mismo que en consultas/clientes.ts.
 */

const AVISOS_ABIERTOS = sql<number>`(
  select count(*)::int from avisos
  where avisos.tecnico_id = tecnicos.id
    and avisos.estado not in ('finalizado', 'cancelado')
)`

export type FiltrosTecnicos = {
  q?: string
  incluirArchivados?: boolean
}

export async function listarTecnicos({ q, incluirArchivados }: FiltrosTecnicos = {}) {
  const desde = sumarDias(hoyISO(), -30)

  const filas = await bd
    .select({
      id: tecnicos.id,
      nombre: tecnicos.nombre,
      apellidos: tecnicos.apellidos,
      telefono: tecnicos.telefono,
      email: tecnicos.email,
      especialidades: tecnicos.especialidades,
      zona: tecnicos.zona,
      archivado: tecnicos.archivado,
      numAvisosAbiertos: AVISOS_ABIERTOS,
      avisosHoy: sql<number>`(
        select count(*)::int from avisos
        where avisos.tecnico_id = tecnicos.id
          and avisos.fecha_programada = ${hoyISO()}
          and avisos.estado not in ('finalizado', 'cancelado')
      )`,
      horasUltimoMes: sql<number>`(
        select coalesce(sum(partes.horas), 0) from partes
        where partes.tecnico_id = tecnicos.id and partes.fecha >= ${desde}
      )`,
    })
    .from(tecnicos)
    .where(incluirArchivados ? undefined : eq(tecnicos.archivado, false))
    .orderBy(asc(tecnicos.nombre))

  if (!q?.trim()) return filas
  const termino = normalizar(q)
  return filas.filter((fila) =>
    [fila.nombre, fila.apellidos, fila.telefono, fila.email, fila.zona, ...fila.especialidades]
      .filter(Boolean)
      .some((campo) => normalizar(String(campo)).includes(termino)),
  )
}

export type TecnicoEnLista = Awaited<ReturnType<typeof listarTecnicos>>[number]

export async function obtenerTecnico(id: number) {
  const fila = await bd.query.tecnicos.findFirst({ where: eq(tecnicos.id, id) })
  return fila ?? null
}

export async function tecnicosParaSelector() {
  return bd
    .select({
      id: tecnicos.id,
      nombre: tecnicos.nombre,
      apellidos: tecnicos.apellidos,
      especialidades: tecnicos.especialidades,
    })
    .from(tecnicos)
    .where(eq(tecnicos.archivado, false))
    .orderBy(asc(tecnicos.nombre))
}

export type TecnicoSelector = Awaited<ReturnType<typeof tecnicosParaSelector>>[number]

/** Últimos partes firmados por un técnico, para su ficha. */
export async function ultimosPartesDeTecnico(tecnicoId: number, limite = 10) {
  return bd
    .select({
      id: partes.id,
      fecha: partes.fecha,
      horas: partes.horas,
      trabajoRealizado: partes.trabajoRealizado,
      avisoId: partes.avisoId,
      referencia: avisos.referencia,
      titulo: avisos.titulo,
    })
    .from(partes)
    .innerJoin(avisos, eq(partes.avisoId, avisos.id))
    .where(eq(partes.tecnicoId, tecnicoId))
    .orderBy(desc(partes.fecha), desc(partes.id))
    .limit(limite)
}

/** Resumen de carga que se muestra en la ficha del técnico. */
export async function cargaDeTecnico(tecnicoId: number) {
  const desde = sumarDias(hoyISO(), -30)

  const [abiertos] = await bd
    .select({ total: count() })
    .from(avisos)
    .where(
      and(
        eq(avisos.tecnicoId, tecnicoId),
        sql`${avisos.estado} not in ('finalizado', 'cancelado')`,
      ),
    )

  const [cerrados] = await bd
    .select({ total: count() })
    .from(avisos)
    .where(and(eq(avisos.tecnicoId, tecnicoId), eq(avisos.estado, 'finalizado')))

  const [horas] = await bd
    .select({ total: sql<number>`coalesce(sum(${partes.horas}), 0)`, partes: count() })
    .from(partes)
    .where(and(eq(partes.tecnicoId, tecnicoId), gte(partes.fecha, desde)))

  return {
    avisosAbiertos: abiertos?.total ?? 0,
    avisosFinalizados: cerrados?.total ?? 0,
    horasUltimoMes: horas?.total ?? 0,
    partesUltimoMes: horas?.partes ?? 0,
  }
}

export async function dependenciasTecnico(id: number) {
  const [{ total: numAvisos }] = await bd
    .select({ total: count() })
    .from(avisos)
    .where(eq(avisos.tecnicoId, id))
  const [{ total: numPartes }] = await bd
    .select({ total: count() })
    .from(partes)
    .where(eq(partes.tecnicoId, id))
  return { numAvisos, numPartes }
}

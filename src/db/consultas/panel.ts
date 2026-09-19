/** Datos del panel de inicio: los contadores y las listas de «qué hay hoy». */

import { and, asc, count, desc, eq, gte, isNull, lt, lte, sql, type SQL } from 'drizzle-orm'

import { bd } from '@/db/cliente'
import { avisos, clientes, locales, movimientos, partes, tecnicos } from '@/db/esquema'
import { hoyISO, inicioDelDia, lunesDe, sumarDias } from '@/lib/fechas'
import { FILTROS_VACIOS } from '@/lib/filtros'
import type { Ambito } from '@/lib/permisos'

import { condicionAmbito, listarAvisos } from './avisos'

const NO_CERRADOS = sql`${avisos.estado} not in ('finalizado', 'cancelado')`

async function contarAvisos(...condiciones: (SQL | undefined)[]) {
  const [fila] = await bd
    .select({ total: count() })
    .from(avisos)
    .where(and(...condiciones))
  return fila?.total ?? 0
}

/** Contadores de la fila de arriba del panel. Con ámbito, solo los avisos del técnico. */
export async function contadoresPanel(ambito?: Ambito) {
  const hoy = hoyISO()
  const haceUnaSemana = inicioDelDia(sumarDias(hoy, -7))
  const alcance = condicionAmbito(ambito)
  const contar = (...condiciones: (SQL | undefined)[]) => contarAvisos(alcance, ...condiciones)

  const [abiertos, sinAsignar, urgentes, paraHoy, retrasados, enEspera, finalizadosSemana, recibidosSemana] =
    await Promise.all([
      contar(NO_CERRADOS),
      contar(NO_CERRADOS, isNull(avisos.tecnicoId)),
      contar(NO_CERRADOS, sql`${avisos.prioridad} in ('alta', 'urgente')`),
      contar(NO_CERRADOS, eq(avisos.fechaProgramada, hoy)),
      contar(NO_CERRADOS, lt(avisos.fechaProgramada, hoy)),
      contar(eq(avisos.estado, 'en_espera')),
      contar(eq(avisos.estado, 'finalizado'), gte(avisos.fechaCierre, haceUnaSemana)),
      contar(gte(avisos.fechaAviso, haceUnaSemana)),
    ])

  return {
    abiertos,
    sinAsignar,
    urgentes,
    paraHoy,
    retrasados,
    enEspera,
    finalizadosSemana,
    recibidosSemana,
  }
}

/* ---------------------------------------------------------- Horas de trabajo */

export type SemanaHoras = {
  /** Lunes de la semana, `YYYY-MM-DD`. */
  lunes: string
  horas: number
  partes: number
}

/**
 * Horas anotadas en los partes: por semanas (para el gráfico del panel) y en
 * los últimos 30 días frente a los 30 anteriores (para la cifra de cabecera).
 * Se suma en JavaScript: son pocas filas y así la semana se calcula con la
 * misma función `lunesDe` que usa la agenda.
 */
export async function resumenHoras(numSemanas = 8) {
  const hoy = hoyISO()
  const primerLunes = sumarDias(lunesDe(hoy), -7 * (numSemanas - 1))
  const inicio30 = sumarDias(hoy, -29)
  const inicio60 = sumarDias(hoy, -59)
  const desde = primerLunes < inicio60 ? primerLunes : inicio60

  const filas = await bd
    .select({ fecha: partes.fecha, horas: partes.horas })
    .from(partes)
    .where(and(gte(partes.fecha, desde), lte(partes.fecha, hoy)))

  const semanas: SemanaHoras[] = Array.from({ length: numSemanas }, (_, i) => ({
    lunes: sumarDias(primerLunes, 7 * i),
    horas: 0,
    partes: 0,
  }))
  const porLunes = new Map(semanas.map((semana) => [semana.lunes, semana]))

  let ultimos30 = 0
  let anteriores30 = 0
  for (const fila of filas) {
    const semana = porLunes.get(lunesDe(fila.fecha))
    if (semana) {
      semana.horas += fila.horas
      semana.partes += 1
    }
    if (fila.fecha >= inicio30) ultimos30 += fila.horas
    else if (fila.fecha >= inicio60) anteriores30 += fila.horas
  }

  return { semanas, ultimos30, anteriores30 }
}

export type ContadoresPanel = Awaited<ReturnType<typeof contadoresPanel>>

export async function listasPanel(ambito?: Ambito) {
  const [paraHoy, retrasados, sinAsignar, enEspera] = await Promise.all([
    listarAvisos({ ...FILTROS_VACIOS, vista: 'hoy' }, ambito),
    listarAvisos({ ...FILTROS_VACIOS, vista: 'retrasados' }, ambito),
    listarAvisos({ ...FILTROS_VACIOS, vista: 'sin_asignar' }, ambito),
    listarAvisos({ ...FILTROS_VACIOS, estado: 'en_espera' }, ambito),
  ])
  return { paraHoy, retrasados, sinAsignar, enEspera }
}

/** Últimos movimientos de estado, para la columna de actividad reciente. */
export async function actividadReciente(limite = 8) {
  return bd
    .select({
      id: movimientos.id,
      fecha: movimientos.fecha,
      estadoAnterior: movimientos.estadoAnterior,
      estadoNuevo: movimientos.estadoNuevo,
      nota: movimientos.nota,
      avisoId: avisos.id,
      referencia: avisos.referencia,
      titulo: avisos.titulo,
      clienteNombre: clientes.nombre,
      localNombre: locales.nombre,
    })
    .from(movimientos)
    .innerJoin(avisos, eq(movimientos.avisoId, avisos.id))
    .innerJoin(clientes, eq(avisos.clienteId, clientes.id))
    .innerJoin(locales, eq(avisos.localId, locales.id))
    .orderBy(desc(movimientos.fecha), desc(movimientos.id))
    .limit(limite)
}

/** Carga de trabajo por técnico: avisos vivos y horas del último mes. */
export async function cargaPorTecnico() {
  const desde = sumarDias(hoyISO(), -30)

  // La subconsulta se repite en el ORDER BY en lugar de usar el alias:
  // el alias de la lista de columnas no está disponible para ordenar.
  const abiertos = sql<number>`(
    select count(*)::int from avisos
    where avisos.tecnico_id = tecnicos.id
      and avisos.estado not in ('finalizado', 'cancelado')
  )`

  return bd
    .select({
      id: tecnicos.id,
      nombre: tecnicos.nombre,
      apellidos: tecnicos.apellidos,
      abiertos,
      horas: sql<number>`(
        select coalesce(sum(partes.horas), 0) from partes
        where partes.tecnico_id = tecnicos.id and partes.fecha >= ${desde}
      )`,
    })
    .from(tecnicos)
    .where(eq(tecnicos.archivado, false))
    .orderBy(desc(abiertos), asc(tecnicos.nombre))
}

/** ¿Hay datos en la base? Si no, el panel invita a cargar los de ejemplo. */
export async function bdVacia() {
  const [fila] = await bd.select({ total: count() }).from(clientes)
  return (fila?.total ?? 0) === 0
}

/** Consultas de clientes y locales. */

import { and, asc, count, eq, sql } from 'drizzle-orm'

import { bd } from '@/db/cliente'
import { avisos, clientes, locales } from '@/db/esquema'
import type { ClienteCatalogo } from '@/lib/lecturaMensaje'
import { esIdValido, normalizar } from '@/lib/utils'

/*
 * Subconsultas correlacionadas.
 *
 * Los nombres de tabla y columna van escritos a mano en lugar de interpolar los
 * objetos de Drizzle: dentro de una plantilla `sql` Drizzle escribe las columnas
 * SIN cualificar («tecnico_id = id»), y en una subconsulta eso se resuelve
 * contra la tabla de dentro en vez de la de fuera, así que la correlación se
 * rompe en silencio y los recuentos salen a cero. Los valores sí se interpolan
 * (llegan como parámetros). Las pruebas de `tests/consultas.test.ts` comprueban
 * que estos números cuadran con los datos de ejemplo.
 *
 * Los recuentos llevan `::int`: `count(*)` es `bigint` en Postgres y el driver
 * lo devolvería como texto, con lo que las sumas y comparaciones fallarían.
 */

const AVISOS_ABIERTOS = sql<number>`(
  select count(*)::int from avisos
  where avisos.cliente_id = clientes.id
    and avisos.estado not in ('finalizado', 'cancelado')
)`

const TOTAL_AVISOS = sql<number>`(
  select count(*)::int from avisos where avisos.cliente_id = clientes.id
)`

const TOTAL_LOCALES = sql<number>`(
  select count(*)::int from locales
  where locales.cliente_id = clientes.id and not locales.archivado
)`

export type FiltrosClientes = {
  q?: string
  incluirArchivados?: boolean
}

export async function listarClientes({ q, incluirArchivados }: FiltrosClientes = {}) {
  const filas = await bd
    .select({
      id: clientes.id,
      nombre: clientes.nombre,
      cif: clientes.cif,
      personaContacto: clientes.personaContacto,
      telefono: clientes.telefono,
      email: clientes.email,
      archivado: clientes.archivado,
      numLocales: TOTAL_LOCALES,
      numAvisosAbiertos: AVISOS_ABIERTOS,
      numAvisos: TOTAL_AVISOS,
    })
    .from(clientes)
    .where(incluirArchivados ? undefined : eq(clientes.archivado, false))
    .orderBy(asc(clientes.nombre))

  // La búsqueda se filtra aquí y no en SQL para que «jardin» encuentre «Jardín»
  // con la misma `normalizar()` que el resto de buscadores.
  if (!q?.trim()) return filas
  const termino = normalizar(q)
  return filas.filter((fila) =>
    [fila.nombre, fila.cif, fila.personaContacto, fila.telefono, fila.email]
      .filter(Boolean)
      .some((campo) => normalizar(String(campo)).includes(termino)),
  )
}

export type ClienteEnLista = Awaited<ReturnType<typeof listarClientes>>[number]

export async function obtenerCliente(id: number) {
  if (!esIdValido(id)) return null
  const fila = await bd.query.clientes.findFirst({ where: eq(clientes.id, id) })
  return fila ?? null
}

/** Clientes disponibles para elegir en un formulario (sin los archivados). */
export async function clientesParaSelector() {
  return bd
    .select({ id: clientes.id, nombre: clientes.nombre })
    .from(clientes)
    .where(eq(clientes.archivado, false))
    .orderBy(asc(clientes.nombre))
}

/** Locales de un cliente, con el número de avisos vivos de cada uno. */
export async function localesDeCliente(clienteId: number, incluirArchivados = false) {
  return bd
    .select({
      id: locales.id,
      clienteId: locales.clienteId,
      nombre: locales.nombre,
      direccion: locales.direccion,
      ciudad: locales.ciudad,
      provincia: locales.provincia,
      codigoPostal: locales.codigoPostal,
      telefono: locales.telefono,
      personaContacto: locales.personaContacto,
      horario: locales.horario,
      archivado: locales.archivado,
      numAvisosAbiertos: sql<number>`(
        select count(*)::int from avisos
        where avisos.local_id = locales.id
          and avisos.estado not in ('finalizado', 'cancelado')
      )`,
    })
    .from(locales)
    .where(
      incluirArchivados
        ? eq(locales.clienteId, clienteId)
        : and(eq(locales.clienteId, clienteId), eq(locales.archivado, false)),
    )
    .orderBy(asc(locales.nombre))
}

export type LocalEnLista = Awaited<ReturnType<typeof localesDeCliente>>[number]

export async function obtenerLocal(id: number) {
  if (!esIdValido(id)) return null
  const fila = await bd.query.locales.findFirst({
    where: eq(locales.id, id),
    with: { cliente: true },
  })
  return fila ?? null
}

/**
 * Todos los locales activos con su cliente, para el desplegable dependiente
 * del formulario de aviso (se filtra en el navegador al elegir cliente).
 */
export async function localesParaSelector() {
  return bd
    .select({
      id: locales.id,
      clienteId: locales.clienteId,
      nombre: locales.nombre,
      ciudad: locales.ciudad,
      direccion: locales.direccion,
    })
    .from(locales)
    .where(eq(locales.archivado, false))
    .orderBy(asc(locales.nombre))
}

export type LocalSelector = Awaited<ReturnType<typeof localesParaSelector>>[number]

/**
 * Clientes activos con sus locales activos y los datos que ayudan a reconocerlos
 * en un mensaje (dirección, contacto, teléfono, email), para la lectura con IA.
 * Son los mismos que ofrecen los desplegables del aviso. El orden es fijo para
 * que las instrucciones salgan idénticas de una petición a otra (caché de la API).
 */
export async function catalogoParaLectura(): Promise<ClienteCatalogo[]> {
  const [filasClientes, filasLocales] = await Promise.all([
    bd
      .select({
        id: clientes.id,
        nombre: clientes.nombre,
        personaContacto: clientes.personaContacto,
        telefono: clientes.telefono,
        email: clientes.email,
      })
      .from(clientes)
      .where(eq(clientes.archivado, false))
      .orderBy(asc(clientes.nombre), asc(clientes.id)),
    bd
      .select({
        id: locales.id,
        clienteId: locales.clienteId,
        nombre: locales.nombre,
        direccion: locales.direccion,
        ciudad: locales.ciudad,
        personaContacto: locales.personaContacto,
        telefono: locales.telefono,
      })
      .from(locales)
      .where(eq(locales.archivado, false))
      .orderBy(asc(locales.nombre), asc(locales.id)),
  ])

  return filasClientes.map((cliente) => ({
    ...cliente,
    locales: filasLocales.filter((local) => local.clienteId === cliente.id),
  }))
}

/* ------------------------------------------------------ Borrado protegido */

/** Qué cuelga de un cliente: si hay algo, no se puede borrar del todo. */
export async function dependenciasCliente(id: number) {
  const [{ locales: numLocales }] = await bd
    .select({ locales: count() })
    .from(locales)
    .where(eq(locales.clienteId, id))
  const [{ avisos: numAvisos }] = await bd
    .select({ avisos: count() })
    .from(avisos)
    .where(eq(avisos.clienteId, id))
  return { numLocales, numAvisos }
}

export async function dependenciasLocal(id: number) {
  const [{ avisos: numAvisos }] = await bd
    .select({ avisos: count() })
    .from(avisos)
    .where(eq(avisos.localId, id))
  return { numAvisos }
}

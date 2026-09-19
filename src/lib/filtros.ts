/**
 * Contrato de los filtros del listado de avisos.
 *
 * Los filtros viven en la URL: así se pueden guardar en favoritos, compartir por
 * WhatsApp y sobreviven a recargar la página o volver atrás.
 */

import {
  esFechaISO,
} from './fechas'
import {
  CATEGORIAS,
  ESTADOS,
  PRIORIDADES,
  type Categoria,
  type Estado,
  type Prioridad,
} from './dominio'

/** Atajos de la barra de filtros rápidos. */
export const VISTAS = [
  'abiertos',
  'hoy',
  'retrasados',
  'sin_asignar',
  'urgentes',
  'finalizados',
  'todos',
] as const

export type Vista = (typeof VISTAS)[number]

export const VISTA: Record<Vista, { etiqueta: string; descripcion: string }> = {
  abiertos: { etiqueta: 'Pendientes', descripcion: 'Todo el trabajo que aún no está cerrado' },
  hoy: { etiqueta: 'Para hoy', descripcion: 'Avisos programados para hoy' },
  retrasados: { etiqueta: 'Retrasados', descripcion: 'Su fecha prevista ya ha pasado' },
  sin_asignar: { etiqueta: 'Sin asignar', descripcion: 'Aún no tienen técnico' },
  urgentes: { etiqueta: 'Urgentes', descripcion: 'Prioridad alta o urgente sin cerrar' },
  finalizados: { etiqueta: 'Finalizados', descripcion: 'Trabajos ya cerrados' },
  todos: { etiqueta: 'Todos', descripcion: 'Sin filtrar por estado' },
}

export type FiltrosAvisos = {
  q: string
  vista: Vista
  estado: Estado | ''
  prioridad: Prioridad | ''
  categoria: Categoria | ''
  /** Id del técnico, o «sin» para los avisos sin asignar. */
  tecnico: string
  cliente: string
  desde: string
  hasta: string
}

export const FILTROS_VACIOS: FiltrosAvisos = {
  q: '',
  vista: 'abiertos',
  estado: '',
  prioridad: '',
  categoria: '',
  tecnico: '',
  cliente: '',
  desde: '',
  hasta: '',
}

type Parametros = Record<string, string | string[] | undefined>

function uno(parametros: Parametros, clave: string): string {
  const valor = parametros[clave]
  if (Array.isArray(valor)) return valor[0] ?? ''
  return valor ?? ''
}

function enumerado<T extends string>(valor: string, permitidos: readonly T[]): T | '' {
  return (permitidos as readonly string[]).includes(valor) ? (valor as T) : ''
}

/** Lee los filtros de los parámetros de la URL, descartando lo que no sea válido. */
export function leerFiltros(parametros: Parametros): FiltrosAvisos {
  const vista = uno(parametros, 'vista')
  const desde = uno(parametros, 'desde')
  const hasta = uno(parametros, 'hasta')
  const tecnico = uno(parametros, 'tecnico')
  const cliente = uno(parametros, 'cliente')

  return {
    q: uno(parametros, 'q').slice(0, 120),
    vista: (VISTAS as readonly string[]).includes(vista) ? (vista as Vista) : 'abiertos',
    estado: enumerado(uno(parametros, 'estado'), ESTADOS),
    prioridad: enumerado(uno(parametros, 'prioridad'), PRIORIDADES),
    categoria: enumerado(uno(parametros, 'categoria'), CATEGORIAS),
    tecnico: tecnico === 'sin' || /^\d+$/.test(tecnico) ? tecnico : '',
    cliente: /^\d+$/.test(cliente) ? cliente : '',
    desde: esFechaISO(desde) ? desde : '',
    hasta: esFechaISO(hasta) ? hasta : '',
  }
}

/** Devuelve la query de la URL, omitiendo lo que esté en su valor por defecto. */
export function aParametros(filtros: Partial<FiltrosAvisos>): string {
  const parametros = new URLSearchParams()
  for (const [clave, valor] of Object.entries(filtros)) {
    if (!valor) continue
    if (clave === 'vista' && valor === 'abiertos') continue
    parametros.set(clave, String(valor))
  }
  const query = parametros.toString()
  return query ? `?${query}` : ''
}

/** Enlace al listado de avisos con unos filtros concretos. */
export function enlaceAvisos(filtros: Partial<FiltrosAvisos>): string {
  return `/avisos${aParametros(filtros)}`
}

/** ¿Hay algún filtro puesto más allá de la vista por defecto? */
export function hayFiltros(filtros: FiltrosAvisos): boolean {
  return Boolean(
    filtros.q ||
      filtros.estado ||
      filtros.prioridad ||
      filtros.categoria ||
      filtros.tecnico ||
      filtros.cliente ||
      filtros.desde ||
      filtros.hasta ||
      filtros.vista !== 'abiertos',
  )
}

/** Cuántos filtros «de detalle» están puestos (para el contador del panel de filtros). */
export function numeroFiltrosDetalle(filtros: FiltrosAvisos): number {
  return [
    filtros.estado,
    filtros.prioridad,
    filtros.categoria,
    filtros.tecnico,
    filtros.cliente,
    filtros.desde,
    filtros.hasta,
  ].filter(Boolean).length
}

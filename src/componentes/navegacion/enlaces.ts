import {
  Building2,
  CalendarDays,
  ClipboardList,
  Columns3,
  HardHat,
  LayoutDashboard,
  SquarePlus,
  UserCog,
  type LucideIcon,
} from 'lucide-react'

import { puede, type Permiso, type Usuario } from '@/lib/permisos'

export type Enlace = {
  href: string
  etiqueta: string
  icono: LucideIcon
  /** Si está en la barra inferior del móvil (donde solo caben cinco). */
  enMovil: boolean
  /** Permiso necesario para verlo; sin él, lo ven todos. */
  permiso?: Permiso
}

export const ENLACES: Enlace[] = [
  { href: '/', etiqueta: 'Inicio', icono: LayoutDashboard, enMovil: true },
  // En el móvil el alta de avisos tiene su propio botón en la cabecera.
  {
    href: '/avisos/nuevo',
    etiqueta: 'Nuevo aviso',
    icono: SquarePlus,
    enMovil: false,
    permiso: 'gestionarAvisos',
  },
  { href: '/avisos', etiqueta: 'Avisos', icono: ClipboardList, enMovil: true },
  { href: '/agenda', etiqueta: 'Agenda', icono: CalendarDays, enMovil: true },
  { href: '/tablero', etiqueta: 'Tablero', icono: Columns3, enMovil: false, permiso: 'gestionarAvisos' },
  { href: '/clientes', etiqueta: 'Clientes', icono: Building2, enMovil: true, permiso: 'gestionarClientes' },
  { href: '/tecnicos', etiqueta: 'Técnicos', icono: HardHat, enMovil: true, permiso: 'gestionarTecnicos' },
  // En el móvil se llega desde «Mi cuenta».
  { href: '/usuarios', etiqueta: 'Usuarios', icono: UserCog, enMovil: false, permiso: 'gestionarUsuarios' },
]

/** Los enlaces que ve este usuario: el técnico, solo inicio, sus avisos y su agenda. */
export function enlacesDe(usuario: Usuario): Enlace[] {
  return ENLACES.filter((enlace) => !enlace.permiso || puede(usuario, enlace.permiso))
}

/** ¿Está la ruta dentro de esta sección? */
function coincide(ruta: string, href: string): boolean {
  if (href === '/') return ruta === '/'
  return ruta === href || ruta.startsWith(`${href}/`)
}

/**
 * El enlace que se marca como activo: el más concreto de los que coinciden.
 * Así «/avisos/nuevo» ilumina «Nuevo aviso» y no también «Avisos».
 */
export function enlaceActivo(ruta: string, enlaces: Enlace[]): Enlace | undefined {
  return enlaces
    .filter((enlace) => coincide(ruta, enlace.href))
    .sort((a, b) => b.href.length - a.href.length)[0]
}

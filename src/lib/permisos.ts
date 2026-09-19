/**
 * Qué puede hacer cada rol.
 *
 * Todas las decisiones de permisos salen de aquí: las usan las páginas (para no
 * mostrar lo que no toca), las acciones de servidor (para rechazar lo que no
 * toca aunque alguien fabrique la petición a mano) y las consultas (para que un
 * técnico solo lea sus avisos). Son funciones puras, sin base de datos, así que
 * se pueden usar también en componentes de cliente y probar por separado.
 *
 * Resumen:
 * - administrador: todo, más los usuarios y los borrados definitivos.
 * - oficina: avisos, asignaciones, partes, clientes, locales y fichas de técnicos.
 * - técnico: solo sus avisos. Los pasa a en curso, en espera o finalizado y
 *   anota sus partes; los suyos los puede corregir mientras el aviso siga abierto.
 */

import { ESTADOS, esEstadoFinal, type Estado, type Rol } from './dominio'

/** El usuario que ha iniciado sesión, tal y como lo ve la aplicación. */
export type Usuario = {
  id: string
  nombre: string
  email: string
  rol: Rol
  /** Ficha de técnico vinculada. Solo la tienen los técnicos, y puede faltar. */
  tecnicoId: number | null
  /** Entró con una contraseña que le dio un administrador y aún no la ha cambiado. */
  debeCambiarContrasena: boolean
}

/** Lo único que miran los permisos. */
type Quien = Pick<Usuario, 'rol' | 'tecnicoId'>

const TODOS: readonly Rol[] = ['administrador', 'oficina', 'tecnico']
const OFICINA: readonly Rol[] = ['administrador', 'oficina']
const ADMINISTRACION: readonly Rol[] = ['administrador']

/** Permisos que no dependen de un aviso o un parte concreto. */
export const PERMISOS = {
  /** Panel completo, con la carga de todos los técnicos. */
  verPanelCompleto: OFICINA,
  /** Listado, agenda y búsqueda de avisos (el técnico, solo los suyos). */
  verAvisos: TODOS,
  /** Crear, modificar, asignar y cancelar avisos, y el tablero. */
  gestionarAvisos: OFICINA,
  /** Borrar un aviso con sus partes y su cronología. */
  borrarAvisos: ADMINISTRACION,
  /** Ver, crear, modificar y archivar clientes y locales. */
  gestionarClientes: OFICINA,
  /** Borrar clientes y locales sin historial. */
  borrarClientes: ADMINISTRACION,
  /** Ver los técnicos y corregir sus fichas. */
  gestionarTecnicos: OFICINA,
  /** Dar de alta, archivar y borrar técnicos. */
  altaTecnicos: ADMINISTRACION,
  /** Crear usuarios, cambiarles el rol, restablecer su contraseña y desactivarlos. */
  gestionarUsuarios: ADMINISTRACION,
  /** Cargar los datos de ejemplo en una base vacía. */
  cargarDatosEjemplo: ADMINISTRACION,
} as const satisfies Record<string, readonly Rol[]>

export type Permiso = keyof typeof PERMISOS

export function puede(usuario: Quien | null | undefined, permiso: Permiso): boolean {
  if (!usuario) return false
  return PERMISOS[permiso].includes(usuario.rol)
}

export function esTecnico(usuario: Quien | null | undefined): boolean {
  return usuario?.rol === 'tecnico'
}

/* ------------------------------------------------------------------ Ámbito */

/**
 * Qué avisos alcanza un usuario en las consultas: `undefined` son todos; con
 * `tecnicoId`, solo los asignados a ese técnico. Un técnico sin ficha
 * vinculada (`tecnicoId: null`) no alcanza ninguno.
 */
export type Ambito = { tecnicoId: number | null } | undefined

export function ambitoDe(usuario: Quien): Ambito {
  return usuario.rol === 'tecnico' ? { tecnicoId: usuario.tecnicoId } : undefined
}

/* ------------------------------------------------------------------ Avisos */

type AvisoParaPermisos = { tecnicoId: number | null; estado: Estado }

export function puedeVerAviso(usuario: Quien | null | undefined, aviso: AvisoParaPermisos): boolean {
  if (!usuario) return false
  if (usuario.rol !== 'tecnico') return true
  return usuario.tecnicoId !== null && aviso.tecnicoId === usuario.tecnicoId
}

/** Los estados a los que un técnico puede llevar sus avisos. */
export const ESTADOS_DEL_TECNICO: readonly Estado[] = ['en_curso', 'en_espera', 'finalizado']

/** Los estados desde los que el técnico puede moverlos: los de trabajo en marcha. */
const ESTADOS_DE_TRABAJO: readonly Estado[] = ['asignado', 'en_curso', 'en_espera']

/**
 * Estados a los que el usuario puede llevar este aviso. La oficina, a
 * cualquiera; el técnico, solo sus avisos en marcha y solo a en curso, en
 * espera o finalizado (reabrir, cancelar o devolver a pendiente es de la oficina).
 * Las reglas del negocio (técnico asignado, motivo, resumen) se comprueban aparte.
 */
export function estadosPermitidos(usuario: Quien | null | undefined, aviso: AvisoParaPermisos): Estado[] {
  if (!usuario || !puedeVerAviso(usuario, aviso)) return []
  if (usuario.rol !== 'tecnico') return [...ESTADOS]
  if (!ESTADOS_DE_TRABAJO.includes(aviso.estado)) return []
  return [...ESTADOS_DEL_TECNICO]
}

export function puedeCambiarEstado(
  usuario: Quien | null | undefined,
  aviso: AvisoParaPermisos,
  estadoNuevo: Estado,
): boolean {
  return estadosPermitidos(usuario, aviso).includes(estadoNuevo)
}

/* ------------------------------------------------------------------ Partes */

/** Anotar un parte nuevo: la oficina en cualquier aviso; el técnico, en los suyos abiertos. */
export function puedeAnotarParte(usuario: Quien | null | undefined, aviso: AvisoParaPermisos): boolean {
  if (!usuario || !puedeVerAviso(usuario, aviso)) return false
  if (usuario.rol !== 'tecnico') return true
  return !esEstadoFinal(aviso.estado)
}

/**
 * Corregir o borrar un parte: la oficina, cualquiera; el técnico, solo los
 * suyos y mientras el aviso siga abierto (cerrado, el parte ya es historia).
 */
export function puedeEditarParte(
  usuario: Quien | null | undefined,
  aviso: AvisoParaPermisos,
  parte: { tecnicoId: number },
): boolean {
  if (!usuario || !puedeVerAviso(usuario, aviso)) return false
  if (usuario.rol !== 'tecnico') return true
  return !esEstadoFinal(aviso.estado) && parte.tecnicoId === usuario.tecnicoId
}

import 'server-only'

import { headers } from 'next/headers'
import { notFound, redirect } from 'next/navigation'
import { cache } from 'react'

import { obtenerPerfil } from '@/db/consultas/usuarios'

import { puede, type Permiso, type Usuario } from './permisos'
import { sesionAnulada } from './sesiones'
import { clienteSupabase } from './supabase/servidor'

/**
 * Quién hace la petición, o `null` si nadie válido.
 *
 * 1. El token de la cookie se verifica con `getClaims()`: firma y caducidad,
 *    con las claves públicas del proyecto. Nunca se fía de `getSession()`, que
 *    solo lee la cookie.
 * 2. El perfil se lee de la base en cada petición: si un administrador cambia
 *    el rol o desactiva a alguien, se nota en el siguiente clic, sin esperar a
 *    que caduque el token.
 * 3. Si la sesión se abrió antes de `sesionesValidasDesde` (se restableció la
 *    contraseña o se desactivó al usuario), ya no vale.
 *
 * `cache` hace que dentro de una misma petición se calcule una sola vez, aunque
 * lo pidan el layout, la página y varios componentes.
 */
export const usuarioActual = cache(async (): Promise<Usuario | null> => {
  const supabase = await clienteSupabase()
  const { data, error } = await supabase.auth.getClaims()
  const claims = data?.claims
  if (error || !claims?.sub || claims.is_anonymous) return null

  const perfil = await obtenerPerfil(claims.sub)
  if (!perfil || !perfil.activo) return null
  if (sesionAnulada(claims, perfil.sesionesValidasDesde)) return null

  return {
    id: perfil.id,
    nombre: perfil.nombre,
    email: perfil.email,
    rol: perfil.rol,
    tecnicoId: perfil.tecnicoId,
    debeCambiarContrasena: perfil.debeCambiarContrasena,
  }
})

/**
 * Para las páginas: el usuario, o fuera. Sin sesión válida se va al login; con
 * una contraseña temporal, a cambiarla antes de seguir.
 */
export async function exigirUsuario(): Promise<Usuario> {
  const usuario = await usuarioActual()
  if (!usuario) redirect('/login?sesion=cerrada')
  if (usuario.debeCambiarContrasena) redirect('/cambiar-contrasena')
  return usuario
}

/**
 * Para las páginas que no son de todos. A quien no tiene permiso se le responde
 * como si la página no existiera: no hace falta contarle qué hay detrás.
 */
export async function exigirPermiso(permiso: Permiso): Promise<Usuario> {
  const usuario = await exigirUsuario()
  if (!puede(usuario, permiso)) notFound()
  return usuario
}

/**
 * Para las acciones de servidor, que se pueden llamar a mano sin pasar por la
 * página: el usuario si puede actuar, o `null`. Quien tiene que cambiar la
 * contraseña todavía no puede hacer nada más.
 */
export async function usuarioDeLaAccion(): Promise<Usuario | null> {
  const usuario = await usuarioActual()
  if (!usuario || usuario.debeCambiarContrasena) return null
  return usuario
}

/** IP de quien hace la petición, para frenar los intentos de acceso repetidos. */
export async function ipDelCliente(): Promise<string | null> {
  const cabeceras = await headers()
  const reenviada = cabeceras.get('x-forwarded-for')?.split(',')[0]?.trim()
  return reenviada || cabeceras.get('x-real-ip') || null
}

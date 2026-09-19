import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { configSupabase, OPCIONES_COOKIE } from './config'

/**
 * Cliente de Supabase Auth para páginas y acciones de servidor, con la sesión
 * del usuario que hace la petición (la lee de su cookie).
 *
 * Se crea uno por petición y nunca se guarda en una variable de módulo: si se
 * compartiera, la sesión de un usuario podría acabar en la petición de otro.
 */
export async function clienteSupabase() {
  const almacen = await cookies()
  const { url, clavePublicable } = configSupabase()

  return createServerClient(url, clavePublicable, {
    cookieOptions: OPCIONES_COOKIE,
    cookies: {
      getAll() {
        return almacen.getAll()
      },
      setAll(cookiesNuevas) {
        try {
          for (const { name, value, options } of cookiesNuevas) almacen.set(name, value, options)
        } catch {
          // Desde un Server Component no se pueden escribir cookies. No pasa
          // nada: el proxy (src/proxy.ts) ya renueva la sesión en cada petición.
        }
      },
    },
  })
}

import 'server-only'

import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

import { esModoLocal } from '@/lib/modoLocal'

import { clienteLocal } from './authLocal'
import { configSupabase, OPCIONES_COOKIE } from './config'
import type { ClienteAuth } from './tipos'

/**
 * Cliente de Supabase Auth para páginas y acciones de servidor, con la sesión
 * del usuario que hace la petición (la lee de su cookie).
 *
 * Se crea uno por petición y nunca se guarda en una variable de módulo: si se
 * compartiera, la sesión de un usuario podría acabar en la petición de otro.
 *
 * En modo local no hay Supabase: devuelve el cliente de `authLocal.ts`, que
 * hace lo mismo contra las cuentas de `.datos/`.
 */
export async function clienteSupabase(): Promise<ClienteAuth> {
  if (esModoLocal()) return clienteLocal()

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

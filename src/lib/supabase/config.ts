/**
 * Datos de conexión con Supabase Auth, compartidos por el proxy, el servidor y
 * el cliente de administración.
 *
 * Ninguna variable lleva el prefijo `NEXT_PUBLIC_`: el navegador no habla nunca
 * con Supabase. Inicia sesión, la renueva y la cierra el servidor de Next, que
 * guarda la sesión en una cookie que el JavaScript de la página no puede leer.
 */

import type { CookieOptionsWithName } from '@supabase/ssr'

export function configSupabase() {
  const url = process.env.SUPABASE_URL
  const clavePublicable = process.env.SUPABASE_PUBLISHABLE_KEY
  if (!url || !clavePublicable) {
    throw new Error(
      'Faltan SUPABASE_URL y SUPABASE_PUBLISHABLE_KEY en .env.local: .env.example dice de dónde se copian.',
    )
  }
  return { url, clavePublicable }
}

/**
 * Cookie de la sesión:
 * - `httpOnly`: el JavaScript de la página no la ve, así que un script
 *   inyectado no podría robarla. Se puede porque solo la usa el servidor.
 * - `secure` en producción: solo viaja por HTTPS.
 * - `sameSite: 'lax'`: no se envía en peticiones que otra web haga a esta.
 */
export const OPCIONES_COOKIE: CookieOptionsWithName = {
  path: '/',
  sameSite: 'lax',
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
}

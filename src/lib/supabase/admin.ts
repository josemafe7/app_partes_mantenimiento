import 'server-only'

import { createClient } from '@supabase/supabase-js'

import { esModoLocal } from '@/lib/modoLocal'

import { adminLocal } from './authLocal'
import { configSupabase } from './config'
import type { ClienteAdmin } from './tipos'

/**
 * Cliente de administración de Supabase Auth: crea cuentas, cambia
 * contraseñas y bloquea usuarios. Usa la clave secreta del proyecto, que da
 * acceso total, así que:
 * - solo se importa desde el servidor (`server-only` rompe el build si un
 *   componente de cliente lo intentara);
 * - solo lo usan las acciones de usuarios, después de comprobar que quien las
 *   pide es administrador.
 *
 * En modo local no hay Supabase: devuelve el de `authLocal.ts`, que hace lo
 * mismo contra las cuentas de `.datos/`.
 */
export function clienteAdmin(): ClienteAdmin {
  if (esModoLocal()) return adminLocal()

  const { url } = configSupabase()
  const claveSecreta = process.env.SUPABASE_SECRET_KEY
  if (!claveSecreta) {
    throw new Error(
      'Falta SUPABASE_SECRET_KEY en .env.local: es la clave secreta del proyecto de Supabase (ver README).',
    )
  }

  return createClient(url, claveSecreta, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
}

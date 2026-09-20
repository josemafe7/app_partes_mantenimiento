/**
 * Lo que la aplicación le pide a Supabase Auth, y nada más.
 *
 * `clienteSupabase()` y `clienteAdmin()` devuelven estos tipos en vez de los de
 * `@supabase/supabase-js`, porque en el modo local (`authLocal.ts`) los
 * sustituye un cliente propio. El cliente de verdad encaja en ellos de sobra
 * (tiene muchos más métodos), así que las páginas y las acciones no cambian.
 *
 * La gracia es que la lista es corta y está aquí: si algún día hace falta otro
 * método de Auth, el compilador obliga a añadirlo también al de local, en vez
 * de dejar el modo local roto sin que nadie se entere.
 */

/** Los errores de Auth, tal como los miran las acciones (`status`, `code`). */
export type ErrorAuth = { status?: number; code?: string; message: string }

/** Lo que la aplicación lee del token: quién es y cuándo escribió la contraseña. */
export type ClaimsSesion = { sub: string; is_anonymous?: boolean; amr?: unknown }

/** Cliente con la sesión del usuario que hace la petición. */
export type ClienteAuth = {
  auth: {
    getClaims(): Promise<{ data: { claims: ClaimsSesion } | null; error: ErrorAuth | null }>
    signInWithPassword(credenciales: {
      email: string
      password: string
    }): Promise<{ data: { user: { id: string } | null }; error: ErrorAuth | null }>
    signOut(opciones: { scope: 'global' | 'local' | 'others' }): Promise<{ error: ErrorAuth | null }>
    updateUser(cambios: { password: string }): Promise<{ error: ErrorAuth | null }>
  }
}

/** Cliente de administración: crear cuentas, cambiar contraseñas y bloquear. */
export type ClienteAdmin = {
  auth: {
    admin: {
      createUser(datos: {
        email: string
        password: string
        email_confirm?: boolean
      }): Promise<{ data: { user: { id: string } | null }; error: ErrorAuth | null }>
      deleteUser(id: string): Promise<{ data: unknown; error: ErrorAuth | null }>
      updateUserById(
        id: string,
        cambios: { password?: string; ban_duration?: string },
      ): Promise<{ error: ErrorAuth | null }>
    }
  }
}

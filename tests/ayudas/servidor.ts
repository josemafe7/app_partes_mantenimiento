/**
 * Lo que las acciones de servidor necesitan de Next y de Supabase, sustituido
 * para poder ejecutarlas en las pruebas:
 *
 * - `next/cache`: fuera de Next, `revalidatePath` lanza un error. Aquí no hace nada.
 * - `next/headers`: `headers()` da la IP de `servidor.ip`.
 * - `server-only`: fuera de Next rompe al importarlo (es su trabajo). Aquí, vacío.
 * - `src/lib/supabase/servidor.ts` y `admin.ts`: un Supabase Auth de mentira,
 *   con las cuentas de `supabase.cuentas` y un registro de lo que se le pide.
 * - `src/lib/filtraciones.ts`: no llama al servicio de contraseñas filtradas;
 *   da por filtradas las de `servidor.filtradas`.
 *
 * Lo demás es real. En particular `src/lib/sesion.ts`: el token solo dice quién
 * es (`entrarComo`), y el rol, si sigue activo, si tiene la contraseña temporal
 * y si la sesión se anuló salen de su perfil en la base, como en la aplicación.
 * `redirect()` también es el de Next: lanza una excepción, que `redireccion()`
 * recoge.
 *
 * `sustituirServidor()` va antes de importar las acciones (con `await import`).
 * Necesita `--experimental-test-module-mocks`, que ya lleva `pnpm test`.
 */

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { join } from 'node:path'
import { mock } from 'node:test'
import { pathToFileURL } from 'node:url'

import { sql } from 'drizzle-orm'

import type { BaseDePruebas } from './base'

type Claims = { sub: string; amr: { method: string; timestamp: number }[] }
type Cuenta = { id: string; contrasena: string }
type ErrorAuth = { status: number; code: string; message: string }

/** Lo que llega con cada petición. `reiniciar()` lo deja como al principio. */
export const servidor = {
  /** El token de la cookie, ya verificado, o `null` si no hay sesión. */
  claims: null as Claims | null,
  ip: '203.0.113.7' as string | null,
  /** Contraseñas que el servicio de filtraciones daría por filtradas. */
  filtradas: new Set<string>(),
}

/** Las cuentas de Supabase Auth (por email) y lo que se le ha pedido, en orden. */
export const supabase = {
  cuentas: new Map<string, Cuenta>(),
  llamadas: [] as { metodo: string; datos: Record<string, unknown> }[],
}

/** Lo que se le ha pedido a Supabase con ese método. */
export function llamadasA(metodo: string): Record<string, unknown>[] {
  return supabase.llamadas.filter((llamada) => llamada.metodo === metodo).map((llamada) => llamada.datos)
}

function anotar(metodo: string, datos: Record<string, unknown> = {}) {
  supabase.llamadas.push({ metodo, datos })
}

function tokenDe(id: string, momento = Date.now()): Claims {
  return { sub: id, amr: [{ method: 'password', timestamp: Math.floor(momento / 1000) }] }
}

/**
 * Hace las peticiones siguientes en nombre de ese usuario (o sin sesión, con
 * `null`). `momento` es cuándo escribió la contraseña: por defecto, ahora.
 */
export function entrarComo(usuario: { id: string } | null, momento?: number) {
  servidor.claims = usuario ? tokenDe(usuario.id, momento) : null
}

export function reiniciar() {
  servidor.claims = null
  servidor.ip = '203.0.113.7'
  servidor.filtradas.clear()
  supabase.cuentas.clear()
  supabase.llamadas.length = 0
}

const CREDENCIALES_MAL: ErrorAuth = { status: 400, code: 'invalid_credentials', message: 'Invalid login credentials' }

/** El cliente con la sesión del usuario (`src/lib/supabase/servidor.ts`). */
export const clienteSupabase = {
  auth: {
    async getClaims() {
      return { data: servidor.claims ? { claims: servidor.claims } : null, error: null }
    },

    async signInWithPassword({ email, password }: { email: string; password: string }) {
      anotar('signInWithPassword', { email })
      const cuenta = supabase.cuentas.get(email)
      if (!cuenta || cuenta.contrasena !== password) {
        return { data: { user: null, session: null }, error: CREDENCIALES_MAL as ErrorAuth | null }
      }
      servidor.claims = tokenDe(cuenta.id)
      return { data: { user: { id: cuenta.id }, session: {} }, error: null as ErrorAuth | null }
    },

    async signOut({ scope }: { scope: string }) {
      anotar('signOut', { scope })
      servidor.claims = null
      return { error: null }
    },

    async updateUser({ password }: { password: string }) {
      anotar('updateUser')
      const cuenta = [...supabase.cuentas.values()].find((c) => c.id === servidor.claims?.sub)
      if (!cuenta) return { data: { user: null }, error: { status: 401, code: 'no_authorization', message: '' } }
      cuenta.contrasena = password
      return { data: { user: { id: cuenta.id } }, error: null as ErrorAuth | null }
    },
  },
}

let bdDeLasPruebas: BaseDePruebas | null = null

/** El cliente de administración (`src/lib/supabase/admin.ts`). */
export const clienteAdmin = {
  auth: {
    admin: {
      async createUser({ email, password }: { email: string; password: string }) {
        anotar('createUser', { email })
        if (supabase.cuentas.has(email)) {
          return { data: { user: null }, error: { status: 422, code: 'email_exists', message: '' } as ErrorAuth | null }
        }
        const id = randomUUID()
        await bdDeLasPruebas?.execute(sql`insert into auth.users (id) values (${id})`)
        supabase.cuentas.set(email, { id, contrasena: password })
        return { data: { user: { id } as { id: string } | null }, error: null as ErrorAuth | null }
      },

      async deleteUser(id: string) {
        anotar('deleteUser', { id })
        for (const [email, cuenta] of supabase.cuentas) if (cuenta.id === id) supabase.cuentas.delete(email)
        await bdDeLasPruebas?.execute(sql`delete from auth.users where id = ${id}`)
        return { data: {}, error: null }
      },

      async updateUserById(id: string, { password, ...cambios }: { password?: string; ban_duration?: string }) {
        // La contraseña no se anota: solo que ha cambiado.
        anotar('updateUserById', { id, ...cambios, ...(password ? { password: '(nueva)' } : {}) })
        const cuenta = [...supabase.cuentas.values()].find((c) => c.id === id)
        if (cuenta && password) cuenta.contrasena = password
        return { data: { user: { id } }, error: null as ErrorAuth | null }
      },
    },
  },
}

function archivo(ruta: string): string {
  return pathToFileURL(join(process.cwd(), ruta)).href
}

/** Sustituye Next y Supabase. Va antes de importar cualquier acción. */
export function sustituirServidor(bd: BaseDePruebas) {
  if (typeof mock.module !== 'function') {
    throw new Error('Estas pruebas necesitan --experimental-test-module-mocks: lánzalas con `pnpm test`.')
  }
  bdDeLasPruebas = bd

  mock.module('server-only', { namedExports: {} })
  mock.module('next/cache', {
    namedExports: { revalidatePath: () => {}, revalidateTag: () => {} },
  })
  mock.module('next/headers', {
    namedExports: {
      headers: async () => new Headers(servidor.ip ? { 'x-forwarded-for': servidor.ip } : {}),
      cookies: async () => ({ getAll: () => [], set: () => {} }),
    },
  })
  mock.module(archivo('src/lib/supabase/servidor.ts'), {
    namedExports: { clienteSupabase: async () => clienteSupabase },
  })
  mock.module(archivo('src/lib/supabase/admin.ts'), {
    namedExports: { clienteAdmin: () => clienteAdmin },
  })
  mock.module(archivo('src/lib/filtraciones.ts'), {
    namedExports: { contrasenaFiltrada: async (contrasena: string) => servidor.filtradas.has(contrasena) },
  })
}

/* ------------------------------------------------------------- Formularios */

/** Un formulario como el que manda el navegador. Las listas se repiten (casillas). */
export function formulario(campos: Record<string, string | number | string[] | undefined>): FormData {
  const datos = new FormData()
  for (const [campo, valor] of Object.entries(campos)) {
    if (valor === undefined) continue
    for (const uno of Array.isArray(valor) ? valor : [valor]) datos.append(campo, String(uno))
  }
  return datos
}

/**
 * Adónde redirige una acción. `redirect()` de Next lanza una excepción que
 * lleva la ruta en `digest` (`NEXT_REDIRECT;replace;/avisos/3;307;`). Si la
 * acción termina sin redirigir, la prueba falla enseñando lo que devolvió.
 */
export async function redireccion(accion: Promise<unknown>): Promise<string> {
  let resultado: unknown
  try {
    resultado = await accion
  } catch (error) {
    const digest = (error as { digest?: unknown } | null)?.digest
    if (typeof digest === 'string' && digest.startsWith('NEXT_REDIRECT;')) return digest.split(';')[2]
    throw error
  }
  assert.fail(`La acción no ha redirigido: ha devuelto ${JSON.stringify(resultado)}`)
}

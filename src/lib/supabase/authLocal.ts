import 'server-only'

import { randomBytes } from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'

import { cookies } from 'next/headers'

import {
  bloquearCuentaLocal,
  borrarCuentaLocal,
  cambiarContrasenaLocal,
  contrasenaCorrecta,
  crearCuentaLocal,
  cuentaPorEmail,
  cuentaPorId,
} from '@/db/baseLocal'
import { CARPETA_DATOS, COOKIE_SESION } from '@/lib/modoLocal'
import { crearSesionLocal, DURACION_SESION, leerSesionLocal, type SesionLocal } from '@/lib/sesionLocal'

import { OPCIONES_COOKIE } from './config'
import type { ClienteAdmin, ClienteAuth, ErrorAuth } from './tipos'

/**
 * El inicio de sesión del modo local: lo que en la aplicación de verdad hace
 * Supabase Auth, con las cuentas guardadas en `.datos/` (`src/db/baseLocal.ts`)
 * y la sesión en una cookie propia.
 *
 * Es el mismo planteamiento que las pruebas de las acciones
 * (`tests/ayudas/servidor.ts`): se sustituye solo la parte que habla con
 * Supabase, y todo lo que hay debajo del login —quién es cada usuario, qué rol
 * tiene, si sigue activo y qué puede hacer— sigue saliendo de `perfiles` y de
 * `src/lib/permisos.ts`, sin enterarse.
 *
 * Lo que la cookie dice es solo **quién** y **cuándo entró**; que ese usuario
 * exista, esté activo y su sesión siga valiendo lo comprueba `usuarioActual()`
 * contra la base en cada petición, igual que con Supabase.
 */

/* --------------------------------------------------------------- La cookie */

let claveFirma: Buffer | null = null

/**
 * Clave con la que se firma la cookie, guardada en `.datos/`. Se genera la
 * primera vez. Firmar es lo que impide que alguien se ponga a mano una cookie
 * con el id de otro usuario: sin firma, el `httpOnly` no serviría de nada.
 */
function clave(): Buffer {
  if (claveFirma) return claveFirma

  const ruta = join(process.cwd(), CARPETA_DATOS, 'clave-sesion')
  if (existsSync(ruta)) {
    claveFirma = Buffer.from(readFileSync(ruta, 'utf8').trim(), 'hex')
  } else {
    claveFirma = randomBytes(32)
    mkdirSync(dirname(ruta), { recursive: true })
    writeFileSync(ruta, claveFirma.toString('hex'), { mode: 0o600 })
  }
  return claveFirma
}

/** Lo que dice la cookie de esta petición, o `null` si no vale. */
async function sesionDeLaCookie(): Promise<SesionLocal | null> {
  return leerSesionLocal(clave(), (await cookies()).get(COOKIE_SESION)?.value)
}

/* ------------------------------------------------------- La sesión abierta */

const CREDENCIALES_MAL: ErrorAuth = {
  status: 400,
  code: 'invalid_credentials',
  message: 'Invalid login credentials',
}

/**
 * El cliente con la sesión del usuario, en lugar del de Supabase
 * (`src/lib/supabase/servidor.ts`).
 */
export function clienteLocal(): ClienteAuth {
  return {
    auth: {
      async getClaims() {
        const sesion = await sesionDeLaCookie()
        if (!sesion) return { data: null, error: null }
        return {
          // `amr` con el momento del acceso es lo que mira `sesionAnulada()`
          // para saber si la sesión es anterior a `sesionesValidasDesde`.
          data: { claims: { sub: sesion.sub, amr: [{ method: 'password', timestamp: sesion.ts }] } },
          error: null,
        }
      },

      async signInWithPassword({ email, password }) {
        const cuenta = await cuentaPorEmail(email)
        // Se comprueba la contraseña aunque la cuenta esté bloqueada: así se
        // tarda lo mismo con una cuenta que no existe que con una que sí.
        const correcta = cuenta ? await contrasenaCorrecta(password, cuenta.contrasena) : false
        if (!cuenta || !correcta || cuenta.bloqueada) {
          return { data: { user: null }, error: CREDENCIALES_MAL }
        }

        const almacen = await cookies()
        almacen.set(COOKIE_SESION, crearSesionLocal(clave(), cuenta.id), {
          ...OPCIONES_COOKIE,
          maxAge: DURACION_SESION,
        })
        return { data: { user: { id: cuenta.id } }, error: null }
      },

      async signOut() {
        // La sesión vive entera en esta cookie: cerrarla aquí es cerrarla del
        // todo, así que `scope` (esta sesión o todas) da igual en local.
        ;(await cookies()).delete(COOKIE_SESION)
        return { error: null }
      },

      async updateUser({ password }) {
        const sesion = await sesionDeLaCookie()
        if (!sesion) return { error: { status: 401, code: 'no_authorization', message: 'No hay sesión' } }
        if (!(await cuentaPorId(sesion.sub))) {
          return { error: { status: 401, code: 'user_not_found', message: 'La cuenta ya no existe' } }
        }
        await cambiarContrasenaLocal(sesion.sub, password)
        return { error: null }
      },
    },
  }
}

/* ------------------------------------------------------------ Las cuentas */

/**
 * El cliente de administración, en lugar del de Supabase
 * (`src/lib/supabase/admin.ts`). Quien lo usa ya ha comprobado que es
 * administrador: aquí no se vuelve a mirar, igual que con el de verdad.
 */
export function adminLocal(): ClienteAdmin {
  return {
    auth: {
      admin: {
        async createUser({ email, password }) {
          if (await cuentaPorEmail(email)) {
            return { data: { user: null }, error: { status: 422, code: 'email_exists', message: 'Ya existe' } }
          }
          return { data: { user: { id: await crearCuentaLocal(email, password) } }, error: null }
        },

        async deleteUser(id) {
          await borrarCuentaLocal(id)
          return { data: {}, error: null }
        },

        async updateUserById(id, cambios) {
          if (!(await cuentaPorId(id))) {
            return { error: { status: 404, code: 'user_not_found', message: 'No existe' } }
          }
          if (cambios.password) await cambiarContrasenaLocal(id, cambios.password)
          // Como en Supabase: 'none' levanta el bloqueo y una duración lo pone.
          if (cambios.ban_duration) await bloquearCuentaLocal(id, cambios.ban_duration !== 'none')
          return { error: null }
        },
      },
    },
  }
}

/**
 * El modo local: la aplicación entera dentro de la carpeta del proyecto, para
 * que quien clona el repositorio pueda verla funcionando con `pnpm install` y
 * `pnpm dev`, sin Supabase, sin Docker y sin configurar nada.
 *
 * Cambia las dos únicas piezas que necesitan servicios de fuera:
 *
 * - la base de datos, que pasa a ser un Postgres dentro de `.datos/`
 *   (`src/db/baseLocal.ts`), con las mismas migraciones y los datos de ejemplo;
 * - el inicio de sesión, que pasa a ser una cookie propia validada contra
 *   `perfiles` (`src/lib/supabase/authLocal.ts`), sin Supabase Auth.
 *
 * Debajo del login no cambia nada: los permisos, las consultas y las acciones
 * son las mismas, con la misma base de datos y las mismas reglas.
 *
 * Borrar `.datos/` es empezar de cero.
 */

import type { Rol } from './dominio'

/**
 * ¿Está la aplicación en modo local?
 *
 * No hay ninguna bandera para encenderlo, y eso es a propósito: una variable de
 * entorno que valiera para activarlo se podría copiar a Vercel por error, y la
 * aplicación publicada se quedaría con una base de datos de juguete y un login
 * que no comprueba nada. Se enciende solo cuando **no hay** base de datos de
 * verdad y se está trabajando en local:
 *
 * 1. Sin `DATABASE_URL` no hay a dónde conectarse. Basta con que `.env.local`
 *    exista (o que Vercel tenga puesta la variable) para que nunca se active.
 * 2. `NODE_ENV` vale `production` en `next build` y en `next start`, que es lo
 *    que corre en Vercel: una compilación de producción queda fuera aunque
 *    falte la variable (entonces falla con el error de siempre, que es lo que
 *    tiene que pasar: mejor un despliegue roto que uno con datos de mentira).
 * 3. `VERCEL` y `CI` son el cinturón sobre los tirantes, por si alguien
 *    arrancase un despliegue con `NODE_ENV` mal puesto.
 */
export function esModoLocal(): boolean {
  if (process.env.DATABASE_URL) return false
  if (process.env.NODE_ENV === 'production') return false
  if (process.env.VERCEL || process.env.CI) return false
  return true
}

/** Carpeta donde vive todo lo del modo local. Está en `.gitignore`. */
export const CARPETA_DATOS = '.datos'

/** Cookie de la sesión local. No se parece a las `sb-…` de Supabase a propósito. */
export const COOKIE_SESION = 'avisos-sesion-local'

/**
 * La contraseña de los tres usuarios de ejemplo, la misma para los tres: son
 * cuentas de juguete en una base de datos que vive en esta carpeta, y lo que
 * importa es poder entrar sin buscarla. Está en el README, y cumple las reglas
 * de `src/lib/contrasenas.ts` por si alguien la cambia desde «Mi cuenta».
 */
export const CONTRASENA_LOCAL = 'Modo-Local-2026!'

/**
 * Un usuario de cada rol, con el id fijo: así se pueden volver a crear igual
 * después de recargar los datos de ejemplo. El dominio `example.com` está
 * reservado y no existe, como en `pnpm usuarios:prueba`.
 */
export const USUARIOS_LOCALES: readonly { id: string; email: string; nombre: string; rol: Rol }[] = [
  { id: '00000000-0000-4000-8000-0000000000a1', email: 'admin@example.com', nombre: 'Ada Administradora', rol: 'administrador' },
  { id: '00000000-0000-4000-8000-0000000000b1', email: 'oficina@example.com', nombre: 'Olga Oficina', rol: 'oficina' },
  { id: '00000000-0000-4000-8000-0000000000c1', email: 'tecnico@example.com', nombre: 'Tomás Técnico', rol: 'tecnico' },
]

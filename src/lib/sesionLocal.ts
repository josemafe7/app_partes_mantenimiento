/**
 * La cookie de sesión del modo local, sin Next ni base de datos, para poder
 * probarla (`tests/sesionLocal.test.ts`). Quien la usa es
 * `src/lib/supabase/authLocal.ts`.
 *
 * La cookie es `cuerpo.firma`: el cuerpo dice **quién** entró y **cuándo**, y
 * la firma (HMAC-SHA256 con una clave que vive en `.datos/`) es lo que impide
 * escribirse a mano una con el id de otro usuario. Que ese usuario exista, siga
 * activo y su sesión no esté anulada lo comprueba `usuarioActual()` contra la
 * base en cada petición, igual que con Supabase.
 */

import { createHmac, timingSafeEqual } from 'node:crypto'

/** 30 días: es un entorno de pruebas, no hace falta estar entrando cada rato. */
export const DURACION_SESION = 30 * 24 * 3600

/** Quién abrió la sesión y en qué segundo. */
export type SesionLocal = { sub: string; ts: number }

function firma(clave: Buffer, cuerpo: string): string {
  return createHmac('sha256', clave).update(cuerpo).digest('base64url')
}

/** El valor de la cookie para ese usuario. `ts` en segundos, como el token de Supabase. */
export function crearSesionLocal(clave: Buffer, sub: string, ts = Math.floor(Date.now() / 1000)): string {
  const cuerpo = Buffer.from(JSON.stringify({ sub, ts })).toString('base64url')
  return `${cuerpo}.${firma(clave, cuerpo)}`
}

/**
 * Lo que dice la cookie, o `null` si no está, si está rota, si la firma no
 * cuadra o si ya ha caducado.
 */
export function leerSesionLocal(clave: Buffer, valor: string | undefined, ahora = Date.now()): SesionLocal | null {
  if (!valor) return null
  const [cuerpo, recibida] = valor.split('.')
  if (!cuerpo || !recibida) return null

  // En tiempo constante y sobre longitudes iguales: `timingSafeEqual` lanza si
  // no coinciden, y comparar longitudes antes no dice nada que no se vea.
  const esperada = Buffer.from(firma(clave, cuerpo))
  const comparada = Buffer.from(recibida)
  if (esperada.length !== comparada.length || !timingSafeEqual(esperada, comparada)) return null

  try {
    const contenido: unknown = JSON.parse(Buffer.from(cuerpo, 'base64url').toString('utf8'))
    if (typeof contenido !== 'object' || contenido === null) return null
    const { sub, ts } = contenido as Partial<SesionLocal>
    if (typeof sub !== 'string' || !sub || typeof ts !== 'number' || !Number.isFinite(ts)) return null
    if (ts + DURACION_SESION < ahora / 1000) return null
    return { sub, ts }
  } catch {
    return null
  }
}

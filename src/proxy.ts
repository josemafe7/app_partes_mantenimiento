import type { NextRequest } from 'next/server'

import { nuevoNonce, politicaDeContenido } from '@/lib/seguridad'
import { actualizarSesion } from '@/lib/supabase/proxy'

/**
 * Se ejecuta antes de cada petición:
 * 1. Prepara la política de seguridad de contenido con un nonce nuevo. Viaja en
 *    la petición (Next lo lee para marcar sus scripts) y en la respuesta (el
 *    navegador la aplica).
 * 2. Renueva la sesión y manda al login a quien no la tenga.
 *
 * Los permisos de verdad se comprueban en cada página y en cada acción de
 * servidor (`src/lib/sesion.ts`).
 */
export async function proxy(request: NextRequest) {
  const nonce = nuevoNonce()
  const politica = politicaDeContenido(nonce)

  const respuesta = await actualizarSesion(request, {
    'x-nonce': nonce,
    'content-security-policy': politica,
  })
  respuesta.headers.set('Content-Security-Policy', politica)
  return respuesta
}

export const config = {
  // Todo menos los archivos estáticos de Next. No se excluye por extensión: las
  // rutas con [id] aceptan cualquier texto, y `/avisos/1.png` llegaba a la página
  // sin pasar por aquí (sin CSP). La aplicación no sirve imágenes propias; si un
  // día las tiene, se excluye su carpeta, no una extensión.
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}

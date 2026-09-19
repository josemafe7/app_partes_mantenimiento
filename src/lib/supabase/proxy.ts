import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

import { configSupabase, OPCIONES_COOKIE } from './config'

/** Lo único que se puede ver sin haber iniciado sesión. */
const RUTAS_PUBLICAS = ['/login']

/**
 * Renueva la sesión de Supabase en cada petición y manda al login a quien no
 * la tenga.
 *
 * Es solo la primera barrera: comprueba que el token es válido, pero no mira
 * el rol ni si el usuario sigue activo. Eso lo hace cada página y cada acción
 * con `src/lib/sesion.ts`, porque las acciones de servidor no siempre pasan por
 * aquí (ver la guía de seguridad de datos de Next).
 *
 * `cabeceras` se añaden a la petición que llega a la página (la política de
 * seguridad de contenido y su nonce, ver src/proxy.ts).
 */
export async function actualizarSesion(request: NextRequest, cabeceras: Record<string, string> = {}) {
  // La petición sigue hacia la página con sus cookies (ya renovadas, si hizo
  // falta) y con las cabeceras extra.
  const continuar = () => {
    const peticion = new Headers(request.headers)
    for (const [clave, valor] of Object.entries(cabeceras)) peticion.set(clave, valor)
    return NextResponse.next({ request: { headers: peticion } })
  }

  let respuesta = continuar()
  const { url, clavePublicable } = configSupabase()

  const supabase = createServerClient(url, clavePublicable, {
    cookieOptions: OPCIONES_COOKIE,
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesNuevas, cabeceras) {
        // El token renovado se deja en la petición (para que la página lo use
        // sin volver a renovarlo) y en la respuesta (para el navegador), con
        // las cabeceras que impiden que una caché guarde la respuesta.
        for (const { name, value } of cookiesNuevas) request.cookies.set(name, value)
        respuesta = continuar()
        for (const { name, value, options } of cookiesNuevas) respuesta.cookies.set(name, value, options)
        for (const [clave, valor] of Object.entries(cabeceras)) respuesta.headers.set(clave, valor)
      },
    },
  })

  // Nada entre crear el cliente y getClaims(): es lo que renueva el token y,
  // si se mete código en medio, los usuarios pierden la sesión al azar.
  const { data } = await supabase.auth.getClaims()

  const ruta = request.nextUrl.pathname
  if (data?.claims || RUTAS_PUBLICAS.includes(ruta)) return respuesta

  const destino = request.nextUrl.clone()
  destino.pathname = '/login'
  destino.search = ''
  if (ruta !== '/') destino.searchParams.set('siguiente', ruta + request.nextUrl.search)

  // 303 para lo que no sea una lectura: el navegador vuelve con un GET.
  const lectura = request.method === 'GET' || request.method === 'HEAD'
  const redireccion = NextResponse.redirect(destino, lectura ? 307 : 303)
  // Las cookies que getClaims() haya borrado o renovado viajan también.
  for (const cookie of respuesta.cookies.getAll()) redireccion.cookies.set(cookie)
  return redireccion
}

'use server'

import { eq } from 'drizzle-orm'
import { redirect } from 'next/navigation'

import { bd } from '@/db/cliente'
import { accesoBloqueado, MINUTOS_BLOQUEO, obtenerPerfil, registrarIntento } from '@/db/consultas/usuarios'
import { perfiles } from '@/db/esquema'
import { ESTADO_INICIAL, texto, type ResultadoAccion } from '@/lib/acciones'
import { contrasenaFiltrada } from '@/lib/filtraciones'
import { ipDelCliente, usuarioActual } from '@/lib/sesion'
import { rutaDeVuelta } from '@/lib/sesiones'
import { clienteSupabase } from '@/lib/supabase/servidor'
import { erroresDe, esquemaContrasenaNueva, REGEX_EMAIL } from '@/lib/validaciones'

/*
 * Inicio y cierre de sesión, y cambio de contraseña.
 *
 * Las contraseñas no se devuelven nunca en `valores`: si el formulario falla,
 * el navegador vuelve a pintar el email, pero la contraseña hay que escribirla
 * otra vez.
 */

/** Mismo mensaje si el email no existe, si la contraseña está mal o si el usuario está desactivado. */
const CREDENCIALES_INCORRECTAS = 'El email o la contraseña no son correctos.'
const DEMASIADOS_INTENTOS = `Demasiados intentos fallidos. Espera ${MINUTOS_BLOQUEO} minutos y vuelve a probar.`
const SERVICIO_NO_DISPONIBLE = 'Ahora mismo no se puede iniciar sesión. Prueba de nuevo en unos minutos.'
const SERVICIO_NO_DISPONIBLE_CUENTA =
  'Ahora mismo no se puede comprobar tu contraseña. Prueba de nuevo en unos minutos.'
/** Lo que se anota en `intentos_acceso` cuando lo tecleado en «email» no lo es. */
const NO_ES_UN_EMAIL = '(no es un email)'

/**
 * Supabase caído, saturado o sin respuesta: no es culpa de quien escribe la
 * contraseña. Cuando la petición ni siquiera llega (sin red, DNS, tiempo
 * agotado), auth-js devuelve un `AuthRetryableFetchError` con `status: 0`, no
 * sin `status`: por eso vale cualquier status «vacío».
 */
function falloDelServicio(error: { status?: number } | null): boolean {
  return Boolean(error && (!error.status || error.status === 429 || error.status >= 500))
}

/** Traduce los errores de Supabase Auth que puede ver el usuario. */
function mensajeDeAuth(codigo: string | undefined): string {
  switch (codigo) {
    case 'weak_password':
      return 'Supabase ha rechazado la contraseña por débil. Prueba con una más larga y variada.'
    case 'same_password':
      return 'La contraseña nueva tiene que ser distinta de la anterior.'
    case 'over_request_rate_limit':
    case 'over_email_send_rate_limit':
      return 'Demasiadas peticiones seguidas. Espera un momento y vuelve a probar.'
    default:
      return 'No se ha podido guardar la contraseña. Prueba de nuevo en unos minutos.'
  }
}

/* ------------------------------------------------------------------- Entrar */

export async function iniciarSesion(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  const email = texto(formData, 'email').trim().toLowerCase()
  const contrasena = texto(formData, 'contrasena')
  const siguiente = rutaDeVuelta(texto(formData, 'siguiente'))
  const valores = { email }

  const errores: Record<string, string> = {}
  if (!email) errores.email = 'Escribe tu email'
  if (!contrasena) errores.contrasena = 'Escribe tu contraseña'
  if (Object.keys(errores).length) return { ok: false, errores, valores }
  if (email.length > 254 || contrasena.length > 200) {
    return { ok: false, mensaje: CREDENCIALES_INCORRECTAS, valores }
  }

  const ip = await ipDelCliente()
  if (await accesoBloqueado(email, ip)) return { ok: false, mensaje: DEMASIADOS_INTENTOS, valores }

  // Lo que no tiene forma de email no es de nadie: ni se pregunta a Supabase ni
  // se guarda tal cual. Es un despiste corriente teclear la contraseña en la
  // casilla del email, y quedaría escrita en `intentos_acceso`. El intento sí
  // cuenta para el freno por IP.
  if (!REGEX_EMAIL.test(email)) {
    await registrarIntento(NO_ES_UN_EMAIL, ip, false)
    return { ok: false, mensaje: CREDENCIALES_INCORRECTAS, valores }
  }

  const supabase = await clienteSupabase()
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: contrasena })

  // Un fallo de Supabase (caído, límite de peticiones) no es culpa de quien entra.
  if (falloDelServicio(error)) return { ok: false, mensaje: SERVICIO_NO_DISPONIBLE, valores }

  // Una cuenta de Supabase sin perfil activo en la aplicación no entra.
  const perfil = !error && data.user ? await obtenerPerfil(data.user.id) : null
  if (!perfil || !perfil.activo) {
    if (!error) await supabase.auth.signOut({ scope: 'local' })
    await registrarIntento(email, ip, false)
    return { ok: false, mensaje: CREDENCIALES_INCORRECTAS, valores }
  }

  await registrarIntento(email, ip, true)
  await bd.update(perfiles).set({ ultimoAcceso: new Date() }).where(eq(perfiles.id, perfil.id))

  redirect(perfil.debeCambiarContrasena ? '/cambiar-contrasena' : siguiente)
}

/* -------------------------------------------------------------------- Salir */

export async function cerrarSesion(): Promise<void> {
  const supabase = await clienteSupabase()
  // «local»: cierra esta sesión (y anula su token de renovación en Supabase),
  // no las que el usuario tenga abiertas en otros dispositivos.
  await supabase.auth.signOut({ scope: 'local' })
  redirect('/login')
}

/* ------------------------------------------------------ Cambiar contraseña */

/**
 * Cambia la contraseña del propio usuario. Sirve para las dos situaciones:
 * - la primera vez que entra (o tras un restablecimiento), con la contraseña
 *   temporal que le dio el administrador: no se le pide la actual;
 * - cuando la cambia él desde «Mi cuenta»: se le pide la actual.
 *
 * Al cambiarla se cierran todas sus sesiones, también las de otros
 * dispositivos, y se abre una nueva en este con la contraseña nueva.
 */
export async function cambiarContrasena(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  const usuario = await usuarioActual()
  if (!usuario) redirect('/login?sesion=cerrada')

  const temporal = usuario.debeCambiarContrasena
  const actual = texto(formData, 'actual')
  const analisis = esquemaContrasenaNueva(usuario.email).safeParse({
    nueva: texto(formData, 'nueva'),
    repetir: texto(formData, 'repetir'),
  })

  const errores = analisis.success ? {} : erroresDe(analisis.error)
  if (!temporal && !actual) errores.actual = 'Escribe tu contraseña actual'
  if (!analisis.success || Object.keys(errores).length) return { ok: false, errores }

  const nueva = analisis.data.nueva
  if (actual && actual === nueva) {
    return { ok: false, errores: { nueva: 'Tiene que ser distinta de la actual' } }
  }
  if (await contrasenaFiltrada(nueva)) {
    return {
      ok: false,
      errores: {
        nueva: 'Esta contraseña aparece en filtraciones de datos conocidas: alguien podría probarla. Elige otra.',
      },
    }
  }

  const supabase = await clienteSupabase()

  if (!temporal) {
    // Comprobar la contraseña actual cuenta como un intento de acceso más: así
    // una sesión olvidada abierta no sirve para adivinarla.
    const ip = await ipDelCliente()
    if (await accesoBloqueado(usuario.email, ip)) return { ok: false, mensaje: DEMASIADOS_INTENTOS }
    const { error } = await supabase.auth.signInWithPassword({ email: usuario.email, password: actual })
    // Igual que al entrar: si quien falla es Supabase, no cuenta como contraseña mala.
    if (falloDelServicio(error)) return { ok: false, mensaje: SERVICIO_NO_DISPONIBLE_CUENTA }
    if (error) {
      await registrarIntento(usuario.email, ip, false)
      return { ok: false, errores: { actual: 'La contraseña actual no es correcta' } }
    }
  }

  const { error } = await supabase.auth.updateUser({ password: nueva })
  if (error) return { ok: false, mensaje: mensajeDeAuth(error.code) }

  // Las sesiones anteriores dejan de valer en la aplicación (sesionesValidasDesde)
  // y en Supabase (signOut global). Después se entra de nuevo con la nueva.
  await bd
    .update(perfiles)
    .set({ debeCambiarContrasena: false, sesionesValidasDesde: new Date(), actualizadoEn: new Date() })
    .where(eq(perfiles.id, usuario.id))
  await supabase.auth.signOut({ scope: 'global' })
  const { error: errorEntrada } = await supabase.auth.signInWithPassword({
    email: usuario.email,
    password: nueva,
  })
  if (errorEntrada) redirect('/login')

  if (temporal) redirect('/')
  return { ok: true, mensaje: 'Contraseña cambiada. Se han cerrado tus sesiones en otros dispositivos.' }
}

'use server'

import { catalogoParaLectura } from '@/db/consultas/clientes'
import { lecturaPermitida } from '@/db/consultas/usuarios'
import { SIN_PERMISO, type ResultadoAccion } from '@/lib/acciones'
import { ajustarLectura, MAX_MENSAJE, type LecturaMensaje } from '@/lib/lecturaMensaje'
import { ErrorLectura, iaConfigurada, leerMensajeConIA } from '@/lib/openrouter'
import { puede } from '@/lib/permisos'
import { usuarioDeLaAccion } from '@/lib/sesion'

export type ResultadoLectura = ResultadoAccion & { lectura?: LecturaMensaje }

/**
 * Lee con IA el mensaje de un cliente y propone los datos del aviso.
 *
 * No escribe nada en la base: devuelve la propuesta y el formulario la pinta
 * para que la oficina la revise y registre el aviso como siempre. No va con
 * `useActionState` porque no es un envío de formulario: si lo fuera, React
 * vaciaría el recuadro del mensaje al terminar.
 */
export async function leerMensaje(mensaje: unknown): Promise<ResultadoLectura> {
  const usuario = await usuarioDeLaAccion()
  if (!usuario || !puede(usuario, 'gestionarAvisos')) return SIN_PERMISO

  if (typeof mensaje !== 'string' || !mensaje.trim()) {
    return { ok: false, mensaje: 'Pega primero el mensaje del cliente.' }
  }
  if (mensaje.length > MAX_MENSAJE) {
    return { ok: false, mensaje: `El mensaje es demasiado largo: como máximo ${MAX_MENSAJE} caracteres.` }
  }
  if (!iaConfigurada()) {
    return {
      ok: false,
      mensaje:
        'La lectura con IA aún no está activada: falta la clave de OpenRouter (OPENROUTER_API_KEY) en .env.local.',
    }
  }

  // Cada lectura cuesta dinero y la acción se puede llamar a mano: tope por usuario.
  const tope = await lecturaPermitida(usuario.id)
  if (tope !== 'permitida') {
    return {
      ok: false,
      mensaje:
        tope === 'minuto'
          ? 'Has pedido muchas lecturas seguidas. Espera un minuto y vuelve a probar.'
          : 'Has llegado al tope de lecturas con IA de hoy. Rellena el aviso a mano o prueba mañana.',
    }
  }

  const catalogo = await catalogoParaLectura()
  if (catalogo.length === 0) {
    return { ok: false, mensaje: 'Todavía no hay clientes con los que comparar el mensaje.' }
  }

  try {
    const salida = await leerMensajeConIA(mensaje, catalogo)
    return { ok: true, lectura: ajustarLectura(salida, catalogo) }
  } catch (error) {
    if (error instanceof ErrorLectura) return { ok: false, mensaje: error.message }
    console.error('Lectura con IA: fallo inesperado', error)
    return {
      ok: false,
      mensaje: 'La IA no está disponible ahora mismo. Rellena el aviso a mano o prueba más tarde.',
    }
  }
}

import 'server-only'

import { z } from 'zod'

import { CANALES, CATEGORIAS, PRIORIDADES } from './dominio'
import {
  ESQUEMA_SALIDA,
  instruccionesLectura,
  mensajeParaLeer,
  type ClienteCatalogo,
  type SalidaLectura,
} from './lecturaMensaje'

/*
 * Llamada a la IA, a través de OpenRouter, para leer el mensaje de un cliente.
 * Solo desde el servidor: la clave (OPENROUTER_API_KEY, en .env.local) no sale
 * nunca al navegador.
 *
 * - Una sola petición a su API de chat, con `fetch`: no hace falta ningún SDK.
 * - El modelo sale de OPENROUTER_MODELO y, si no está, de MODELO_POR_DEFECTO.
 *   Tiene que admitir salida estructurada (en openrouter.ai/models, el filtro
 *   «structured_outputs»).
 * - Salida estructurada estricta: el modelo tiene que devolver un JSON que
 *   cumpla `ESQUEMA_SALIDA`, así que no hay que interpretar texto libre.
 * - `require_parameters`: OpenRouter solo la manda a proveedores que cumplen el
 *   esquema; sin esto, uno que no lo admita lo ignoraría sin avisar.
 * - `data_collection: 'deny'`: solo proveedores que no guardan ni usan para
 *   entrenar lo que se les manda. Llevan datos de contacto de los clientes.
 */

const URL_API = 'https://openrouter.ai/api/v1/chat/completions'

/** Gemini 3 Flash (elegido por el usuario): con salida estructurada en todos sus proveedores. */
const MODELO_POR_DEFECTO = 'google/gemini-3-flash-preview'

export function modeloIA(): string {
  return process.env.OPENROUTER_MODELO?.trim() || MODELO_POR_DEFECTO
}

export function iaConfigurada(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY?.trim())
}

/** Un error con un texto que ya se puede enseñar a la oficina. */
export class ErrorLectura extends Error {}

/*
 * La misma forma que `ESQUEMA_SALIDA`, para comprobar la respuesta antes de
 * usarla. El proveedor ya debería cumplir el esquema; esto es por si acaso.
 */
const esquemaLectura = z.object({
  titulo: z.string(),
  descripcion: z.string(),
  categoria: z.enum(CATEGORIAS),
  prioridad: z.enum(PRIORIDADES),
  canalEntrada: z.enum(CANALES).nullable(),
  contactoAviso: z.string().nullable(),
  identificacion: z.string(),
  clienteId: z.number().int().nullable(),
  localId: z.number().int().nullable(),
  dudas: z.array(z.string()),
}) satisfies z.ZodType<SalidaLectura>

/** Lo que se usa de la respuesta de OpenRouter (formato de OpenAI). */
const esquemaRespuesta = z.object({
  choices: z
    .array(
      z.object({
        finish_reason: z.string().nullish(),
        message: z
          .object({ content: z.string().nullish(), refusal: z.string().nullish() })
          .nullish(),
        error: z.object({ message: z.string().nullish() }).nullish(),
      }),
    )
    .min(1),
})

const NO_SE_ENTIENDE = 'La IA ha devuelto una respuesta que no se entiende. Vuelve a probar.'

function mensajePorEstado(estado: number): string {
  switch (estado) {
    case 401:
      return 'La clave de OpenRouter no es válida. Revisa OPENROUTER_API_KEY en .env.local.'
    case 402:
      return 'La cuenta de OpenRouter no tiene saldo. Recárgala en openrouter.ai y vuelve a probar.'
    case 403:
      return 'El proveedor de la IA ha rechazado este mensaje. Rellena el aviso a mano.'
    case 404:
      return `El modelo «${modeloIA()}» no existe en OpenRouter o ninguno de sus proveedores admite salida estructurada sin guardar los datos. Cambia OPENROUTER_MODELO.`
    case 408:
    case 504:
      return 'La IA ha tardado demasiado en responder. Vuelve a probar.'
    case 429:
      return 'La IA está recibiendo demasiadas peticiones. Espera un minuto y vuelve a probar.'
    case 400:
      return `El modelo «${modeloIA()}» no ha aceptado la petición. Si sigue pasando, avisa al administrador.`
    default:
      return 'La IA no está disponible ahora mismo. Rellena el aviso a mano o prueba más tarde.'
  }
}

/** Algunos modelos envuelven el JSON en un bloque ```json aunque se les pida sin él. */
function sinCercas(texto: string): string {
  return texto
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
}

export async function leerMensajeConIA(
  mensaje: string,
  catalogo: readonly ClienteCatalogo[],
): Promise<SalidaLectura> {
  let respuesta: Response
  try {
    respuesta = await fetch(URL_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY?.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modeloIA(),
        // Las instrucciones y el catálogo no cambian entre peticiones: los
        // proveedores que tienen caché la aprovechan solos.
        messages: [
          { role: 'system', content: instruccionesLectura(catalogo) },
          { role: 'user', content: mensajeParaLeer(mensaje) },
        ],
        response_format: {
          type: 'json_schema',
          json_schema: { name: 'aviso', strict: true, schema: ESQUEMA_SALIDA },
        },
        max_tokens: 8000,
        provider: { require_parameters: true, data_collection: 'deny' },
      }),
      // Al otro lado hay alguien esperando delante del botón.
      signal: AbortSignal.timeout(60_000),
      cache: 'no-store',
    })
  } catch {
    throw new ErrorLectura('No se ha podido hablar con la IA (sin conexión o tarda demasiado). Vuelve a probar.')
  }

  if (!respuesta.ok) {
    // Al registro va el motivo que da OpenRouter, nunca el mensaje del cliente.
    const cuerpo: unknown = await respuesta.json().catch(() => null)
    const detalle = z.object({ error: z.object({ message: z.string() }) }).safeParse(cuerpo)
    console.error(
      `Lectura con IA: OpenRouter respondió ${respuesta.status}` +
        (detalle.success ? `: ${detalle.data.error.message.slice(0, 300)}` : ''),
    )
    throw new ErrorLectura(mensajePorEstado(respuesta.status))
  }

  const datos = esquemaRespuesta.safeParse(await respuesta.json().catch(() => null))
  if (!datos.success) throw new ErrorLectura(NO_SE_ENTIENDE)

  const [eleccion] = datos.data.choices
  if (eleccion.error || eleccion.finish_reason === 'error') {
    console.error(`Lectura con IA: el proveedor falló a mitad (${eleccion.error?.message ?? 'sin detalle'})`)
    throw new ErrorLectura('La IA no está disponible ahora mismo. Rellena el aviso a mano o prueba más tarde.')
  }
  if (eleccion.message?.refusal || eleccion.finish_reason === 'content_filter') {
    throw new ErrorLectura('La IA no ha querido leer este mensaje. Rellena el aviso a mano.')
  }
  if (eleccion.finish_reason === 'length') {
    throw new ErrorLectura('La IA no ha terminado de leer el mensaje. Prueba con un texto más corto.')
  }

  let json: unknown
  try {
    json = JSON.parse(sinCercas(eleccion.message?.content ?? ''))
  } catch {
    throw new ErrorLectura(NO_SE_ENTIENDE)
  }

  const analisis = esquemaLectura.safeParse(json)
  if (!analisis.success) throw new ErrorLectura(NO_SE_ENTIENDE)
  return analisis.data
}

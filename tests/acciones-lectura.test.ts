/**
 * Pruebas de la lectura de mensajes con IA de punta a punta: la acción
 * (`src/acciones/lectura.ts`) y la llamada a OpenRouter (`src/lib/openrouter.ts`),
 * con un `fetch` de mentira en lugar de la API.
 *
 * Lo que se comprueba: quién puede usarla, que la petición lleva lo que protege
 * los datos de los clientes (`data_collection: 'deny'`, `require_parameters`),
 * que lo que devuelve la IA no llega al formulario sin contrastarlo, que los
 * errores se explican y que no se guarda nada en la base.
 */

import assert from 'node:assert/strict'
import { after, before, beforeEach, describe, it, type TestContext } from 'node:test'

import { eq, sql } from 'drizzle-orm'

import * as esquema from '../src/db/esquema'
import { SIN_PERMISO } from '../src/lib/acciones'
import type { SalidaLectura } from '../src/lib/lecturaMensaje'
import { crearFichas, usarBaseEnMemoria, type BaseDePruebas, type Fichas } from './ayudas/base'
import { entrarComo, reiniciar, sustituirServidor } from './ayudas/servidor'

let bd: BaseDePruebas
let fichas: Fichas
let lectura: typeof import('../src/acciones/lectura')

const entornoOriginal = {
  clave: process.env.OPENROUTER_API_KEY,
  modelo: process.env.OPENROUTER_MODELO,
}

before(async () => {
  process.env.OPENROUTER_API_KEY = 'clave-de-prueba'
  process.env.OPENROUTER_MODELO = 'proveedor/modelo-de-prueba'
  bd = await usarBaseEnMemoria()
  sustituirServidor(bd)
  fichas = await crearFichas(bd)
  lectura = await import('../src/acciones/lectura')
})

after(() => {
  for (const [variable, valor] of [
    ['OPENROUTER_API_KEY', entornoOriginal.clave],
    ['OPENROUTER_MODELO', entornoOriginal.modelo],
  ] as const) {
    if (valor === undefined) delete process.env[variable]
    else process.env[variable] = valor
  }
})

beforeEach(() => {
  reiniciar()
  entrarComo(fichas.usuarios.oficina)
})

/* ---------------------------------------------------------------- Ayudas */

const MENSAJE = 'Hola, soy Lucía, de la panadería de la calle Mayor. El horno grande no calienta desde esta mañana.'

function salida(cambios: Partial<SalidaLectura> = {}): SalidaLectura {
  return {
    titulo: 'El horno grande no calienta',
    descripcion: 'El horno grande no calienta desde esta mañana.',
    categoria: 'electricidad',
    prioridad: 'urgente',
    canalEntrada: 'whatsapp',
    contactoAviso: 'Lucía',
    identificacion: 'Habla de la panadería de la calle Mayor.',
    clienteId: fichas.clientes.horno.id,
    localId: fichas.locales.hornoCentro.id,
    dudas: [],
    ...cambios,
  }
}

/** Lo que devuelve la API de chat de OpenRouter con ese contenido. */
function respuestaIA(contenido: unknown, cambios: Record<string, unknown> = {}) {
  const texto = typeof contenido === 'string' ? contenido : JSON.stringify(contenido)
  return { choices: [{ finish_reason: 'stop', message: { content: texto }, ...cambios }] }
}

/** Lo que se le manda a OpenRouter (la parte que miran las pruebas). */
type PeticionIA = {
  model: string
  messages: { role: string; content: string }[]
  response_format: { type: string; json_schema: { strict: boolean } }
  provider: Record<string, unknown>
}

/**
 * Cambia `fetch` por un OpenRouter de mentira durante la prueba: responde con
 * `estado` y `cuerpo`, y guarda lo que se le ha pedido.
 */
function simularOpenRouter(t: TestContext) {
  const simulado = {
    estado: 200,
    cuerpo: respuestaIA(salida()) as unknown,
    sinConexion: false,
    peticiones: [] as { url: string; cabeceras: Headers; cuerpo: PeticionIA }[],
  }
  t.mock.method(globalThis, 'fetch', async (url: string | URL, init?: RequestInit) => {
    simulado.peticiones.push({ url: String(url), cabeceras: new Headers(init?.headers), cuerpo: JSON.parse(String(init?.body)) })
    if (simulado.sinConexion) throw new TypeError('fetch failed')
    const texto = typeof simulado.cuerpo === 'string' ? simulado.cuerpo : JSON.stringify(simulado.cuerpo)
    return new Response(texto, { status: simulado.estado })
  })
  return simulado
}

async function numeroDeAvisos(): Promise<number> {
  const [{ total }] = await bd.select({ total: sql<number>`count(*)::int` }).from(esquema.avisos)
  return total
}

/* ---------------------------------------------------------------- Pruebas */

describe('lectura de mensajes con IA', () => {
  it('propone los datos del aviso sin guardar nada', async (t) => {
    const openRouter = simularOpenRouter(t)
    const antes = await numeroDeAvisos()

    const resultado = await lectura.leerMensaje(MENSAJE)
    assert.equal(resultado.ok, true)
    assert.equal(resultado.lectura?.propuesta.clienteId, fichas.clientes.horno.id)
    assert.equal(resultado.lectura?.propuesta.localId, fichas.locales.hornoCentro.id)
    assert.equal(resultado.lectura?.propuesta.prioridad, 'urgente')
    assert.equal(resultado.lectura?.cliente, fichas.clientes.horno.nombre)
    assert.equal(await numeroDeAvisos(), antes, 'la lectura ha escrito en la base')
    assert.equal(openRouter.peticiones.length, 1)
  })

  it('la petición protege los datos: sin guardarlos y solo con proveedores que cumplan el esquema', async (t) => {
    const openRouter = simularOpenRouter(t)
    await lectura.leerMensaje(MENSAJE)

    const [peticion] = openRouter.peticiones
    assert.equal(peticion.url, 'https://openrouter.ai/api/v1/chat/completions')
    assert.equal(peticion.cabeceras.get('authorization'), 'Bearer clave-de-prueba')
    assert.equal(peticion.cuerpo.model, 'proveedor/modelo-de-prueba')
    assert.deepEqual(peticion.cuerpo.provider, { require_parameters: true, data_collection: 'deny' })
    assert.equal(peticion.cuerpo.response_format.type, 'json_schema')
    assert.equal(peticion.cuerpo.response_format.json_schema.strict, true)
    assert.match(peticion.cuerpo.messages[0].content, new RegExp(`Cliente ${fichas.clientes.horno.id}: `))
    assert.match(peticion.cuerpo.messages[1].content, /<mensaje>\nHola, soy Lucía/)
  })

  it('no le manda los clientes archivados, y descarta el cliente si la IA lo propone', async (t) => {
    const { grano } = fichas.clientes
    await bd.update(esquema.clientes).set({ archivado: true }).where(eq(esquema.clientes.id, grano.id))
    try {
      const openRouter = simularOpenRouter(t)
      openRouter.cuerpo = respuestaIA(salida({ clienteId: grano.id, localId: fichas.locales.granoSol.id }))

      const resultado = await lectura.leerMensaje(MENSAJE)
      assert.doesNotMatch(openRouter.peticiones[0].cuerpo.messages[0].content, /Grano/)
      assert.equal(resultado.lectura?.propuesta.clienteId, null)
      assert.equal(resultado.lectura?.propuesta.localId, null)
      assert.ok(resultado.lectura?.dudas.length)
    } finally {
      await bd.update(esquema.clientes).set({ archivado: false }).where(eq(esquema.clientes.id, grano.id))
    }
  })

  it('un técnico no puede usarla, y un mensaje vacío o larguísimo no llega a la IA', async (t) => {
    const openRouter = simularOpenRouter(t)

    entrarComo(fichas.usuarios.tecnico)
    assert.deepEqual(await lectura.leerMensaje(MENSAJE), SIN_PERMISO)

    entrarComo(fichas.usuarios.oficina)
    assert.equal((await lectura.leerMensaje('   ')).mensaje, 'Pega primero el mensaje del cliente.')
    assert.equal((await lectura.leerMensaje(42)).mensaje, 'Pega primero el mensaje del cliente.')
    assert.match((await lectura.leerMensaje('x'.repeat(4001))).mensaje ?? '', /demasiado largo/)
    assert.equal(openRouter.peticiones.length, 0)
  })

  it('sin la clave de OpenRouter lo explica y no llama', async (t) => {
    const openRouter = simularOpenRouter(t)
    delete process.env.OPENROUTER_API_KEY
    try {
      assert.match((await lectura.leerMensaje(MENSAJE)).mensaje ?? '', /OPENROUTER_API_KEY/)
      assert.equal(openRouter.peticiones.length, 0)
    } finally {
      process.env.OPENROUTER_API_KEY = 'clave-de-prueba'
    }
  })

  it('explica los errores de OpenRouter sin llevar el mensaje del cliente al registro', async (t) => {
    const registro = t.mock.method(console, 'error', () => {})
    const openRouter = simularOpenRouter(t)
    const casos: [number, RegExp][] = [
      [401, /clave de OpenRouter no es válida/],
      [402, /no tiene saldo/],
      [404, /modelo «proveedor\/modelo-de-prueba» no existe/],
      [429, /demasiadas peticiones/],
      [503, /no está disponible ahora mismo/],
    ]
    for (const [estado, esperado] of casos) {
      openRouter.estado = estado
      openRouter.cuerpo = { error: { message: `Motivo ${estado}` } }
      const resultado = await lectura.leerMensaje(MENSAJE)
      assert.equal(resultado.ok, false)
      assert.match(resultado.mensaje ?? '', esperado, `estado ${estado}`)
    }
    const escrito = registro.mock.calls.map((llamada) => llamada.arguments.join(' ')).join('\n')
    assert.match(escrito, /OpenRouter respondió 401: Motivo 401/)
    assert.ok(!escrito.includes('calle Mayor'), 'el mensaje del cliente ha ido al registro')
  })

  it('una respuesta que no cumple el esquema no llega al formulario', async (t) => {
    t.mock.method(console, 'error', () => {})
    const openRouter = simularOpenRouter(t)
    const casos: [unknown, RegExp][] = [
      [respuestaIA('Claro, aquí tienes el aviso: …'), /respuesta que no se entiende/],
      [respuestaIA({ ...salida(), categoria: 'jardineria' }), /respuesta que no se entiende/],
      [respuestaIA({ ...salida(), clienteId: '1' }), /respuesta que no se entiende/],
      [{ choices: [] }, /respuesta que no se entiende/],
      [respuestaIA('', { finish_reason: 'length' }), /no ha terminado de leer/],
      [respuestaIA('', { message: { content: null, refusal: 'No puedo' } }), /no ha querido leer/],
      [respuestaIA('', { error: { message: 'proveedor caído' } }), /no está disponible ahora mismo/],
    ]
    for (const [cuerpo, esperado] of casos) {
      openRouter.cuerpo = cuerpo
      const resultado = await lectura.leerMensaje(MENSAJE)
      assert.equal(resultado.ok, false, JSON.stringify(cuerpo))
      assert.match(resultado.mensaje ?? '', esperado, JSON.stringify(cuerpo))
    }
  })

  it('entiende el JSON aunque el modelo lo envuelva en un bloque de código', async (t) => {
    const openRouter = simularOpenRouter(t)
    openRouter.cuerpo = respuestaIA('```json\n' + JSON.stringify(salida()) + '\n```')
    assert.equal((await lectura.leerMensaje(MENSAJE)).ok, true)
  })

  it('sin conexión con la IA lo dice, sin romper', async (t) => {
    const openRouter = simularOpenRouter(t)
    openRouter.sinConexion = true
    assert.match((await lectura.leerMensaje(MENSAJE)).mensaje ?? '', /No se ha podido hablar con la IA/)
  })
})

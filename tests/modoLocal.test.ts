/**
 * Pruebas del modo local: cuándo se enciende y si su cookie de sesión aguanta
 * que la toquen.
 *
 * Lo primero es lo importante: el modo local cambia la base de datos por una de
 * juguete y el login por uno que no habla con Supabase. Si se encendiera en la
 * aplicación publicada, cualquiera entraría con las contraseñas del README. No
 * hay ninguna bandera para activarlo a propósito, así que lo único que hay que
 * comprobar es que las condiciones para que se encienda no se cumplan nunca en
 * un despliegue.
 */

import assert from 'node:assert/strict'
import { randomBytes } from 'node:crypto'
import { afterEach, describe, it } from 'node:test'

import { esModoLocal } from '../src/lib/modoLocal'
import { crearSesionLocal, DURACION_SESION, leerSesionLocal } from '../src/lib/sesionLocal'

/* ------------------------------------------------------- Cuándo se enciende */

const DE_VERDAD = 'postgresql://app_avisos.abc:secreto@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'

type Variable = 'DATABASE_URL' | 'NODE_ENV' | 'VERCEL' | 'CI'
const VARIABLES: readonly Variable[] = ['DATABASE_URL', 'NODE_ENV', 'VERCEL', 'CI']

// Next declara `process.env.NODE_ENV` de solo lectura, y con el tipo de verdad
// no se puede escribir (lo avisa `next build`, que es el typecheck que cuenta).
const entornoEscribible = process.env as Record<string, string | undefined>

/** Las variables que mira `esModoLocal`, puestas a lo que diga la prueba. */
function entorno(valores: Partial<Record<Variable, string>>) {
  for (const nombre of VARIABLES) {
    const valor = valores[nombre]
    if (valor === undefined) delete entornoEscribible[nombre]
    else entornoEscribible[nombre] = valor
  }
}

const original = { ...process.env }

afterEach(() => {
  for (const nombre of VARIABLES) {
    if (original[nombre] === undefined) delete entornoEscribible[nombre]
    else entornoEscribible[nombre] = original[nombre]
  }
})

describe('esModoLocal', () => {
  it('se enciende en un proyecto recién clonado: sin base de datos y en desarrollo', () => {
    entorno({ NODE_ENV: 'development' })
    assert.equal(esModoLocal(), true)
  })

  it('no se enciende si hay una base de datos configurada', () => {
    entorno({ NODE_ENV: 'development', DATABASE_URL: DE_VERDAD })
    assert.equal(esModoLocal(), false)
  })

  it('no se enciende en una compilación de producción, ni aunque falte la base de datos', () => {
    entorno({ NODE_ENV: 'production' })
    assert.equal(esModoLocal(), false)
  })

  it('no se enciende en Vercel, ni con NODE_ENV mal puesto', () => {
    entorno({ NODE_ENV: 'development', VERCEL: '1' })
    assert.equal(esModoLocal(), false)
  })

  it('no se enciende en una integración continua', () => {
    entorno({ NODE_ENV: 'development', CI: 'true' })
    assert.equal(esModoLocal(), false)
  })

  it('no hay ninguna variable que lo encienda: solo se apaga', () => {
    // Si algún día apareciera un MODO_LOCAL=1, esta prueba seguiría pasando y
    // no serviría de nada; lo que cuenta es que con la base configurada (que es
    // lo que hay en Vercel) no se encienda pase lo que pase alrededor.
    entorno({ NODE_ENV: 'development', DATABASE_URL: DE_VERDAD })
    entornoEscribible.MODO_LOCAL = '1'
    entornoEscribible.LOCAL = 'true'
    try {
      assert.equal(esModoLocal(), false)
    } finally {
      delete entornoEscribible.MODO_LOCAL
      delete entornoEscribible.LOCAL
    }
  })
})

/* ------------------------------------------------------ La cookie de sesión */

const CLAVE = randomBytes(32)
const USUARIO = '00000000-0000-4000-8000-0000000000a1'
/** Hace un rato: dentro de la sesión, para que lo que falle sea lo que prueba cada caso. */
const AHORA = Math.floor(Date.now() / 1000) - 60

describe('cookie de sesión local', () => {
  it('dice quién entró y cuándo', () => {
    const sesion = leerSesionLocal(CLAVE, crearSesionLocal(CLAVE, USUARIO, AHORA))
    assert.deepEqual(sesion, { sub: USUARIO, ts: AHORA })
  })

  it('no vale si la firma es de otra clave', () => {
    const cookie = crearSesionLocal(randomBytes(32), USUARIO)
    assert.equal(leerSesionLocal(CLAVE, cookie), null)
  })

  it('no vale si le cambian el usuario', () => {
    const otro = '00000000-0000-4000-8000-0000000000b1'
    // Un id distinto con la firma del bueno: es el intento evidente de
    // ponerse a mano una cookie de administrador.
    const [, firma] = crearSesionLocal(CLAVE, USUARIO, AHORA).split('.')
    const cuerpo = Buffer.from(JSON.stringify({ sub: otro, ts: AHORA })).toString('base64url')
    assert.equal(leerSesionLocal(CLAVE, `${cuerpo}.${firma}`), null)
  })

  it('no vale sin firma, ni rota, ni vacía', () => {
    const [cuerpo] = crearSesionLocal(CLAVE, USUARIO).split('.')
    assert.equal(leerSesionLocal(CLAVE, cuerpo), null)
    assert.equal(leerSesionLocal(CLAVE, `${cuerpo}.`), null)
    assert.equal(leerSesionLocal(CLAVE, 'cualquier-cosa'), null)
    assert.equal(leerSesionLocal(CLAVE, ''), null)
    assert.equal(leerSesionLocal(CLAVE, undefined), null)
  })

  it('no vale si el cuerpo no es lo que se espera', () => {
    const casos = ['null', '"texto"', '{}', `{"sub":"","ts":${AHORA}}`, '{"sub":"a"}', `{"ts":${AHORA}}`]
    for (const contenido of casos) {
      const cuerpo = Buffer.from(contenido).toString('base64url')
      const firmada = crearSesionLocal(CLAVE, USUARIO)
      // Se firma bien el cuerpo malo, para probar la comprobación de después.
      const [, firma] = firmada.split('.')
      assert.equal(leerSesionLocal(CLAVE, `${cuerpo}.${firma}`), null, contenido)
    }
  })

  it('caduca a los 30 días', () => {
    const hace31Dias = Math.floor(Date.now() / 1000) - (DURACION_SESION + 3600)
    assert.equal(leerSesionLocal(CLAVE, crearSesionLocal(CLAVE, USUARIO, hace31Dias)), null)

    const reciente = Math.floor(Date.now() / 1000) - 3600
    assert.ok(leerSesionLocal(CLAVE, crearSesionLocal(CLAVE, USUARIO, reciente)))
  })
})

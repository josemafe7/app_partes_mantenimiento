/**
 * La conexión con la base va cifrada salvo que la cadena diga ya cómo.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { cifrado } from '../src/db/cifrado'

const POOLER = 'postgresql://app_avisos.ref:secreto@aws-0-eu-central-1.pooler.supabase.com:5432/postgres'

describe('cifrado', () => {
  it('pide TLS cuando la cadena no dice nada (la plantilla de .env.example)', () => {
    assert.deepEqual(cifrado(POOLER), { ssl: 'require' })
  })

  it('respeta el sslmode de la cadena: la opción del código lo rebajaría', () => {
    assert.deepEqual(cifrado(`${POOLER}?sslmode=verify-full`), {})
  })

  it('con una cadena que no se entiende también pide TLS', () => {
    assert.deepEqual(cifrado('esto no es una url'), { ssl: 'require' })
  })
})

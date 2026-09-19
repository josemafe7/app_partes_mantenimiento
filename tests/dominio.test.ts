/**
 * Pruebas del vocabulario de negocio y de las reglas que dependen de él.
 * Es la lógica donde un fallo pasaría inadvertido en la pantalla.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  esEstado,
  esEstadoFinal,
  ESTADO,
  ESTADOS,
  ESTADOS_ABIERTOS,
  ESTADOS_FINALES,
  PRIORIDAD,
  PRIORIDADES,
  requiereMotivoEspera,
  requiereResumenCierre,
  totalHoras,
} from '../src/lib/dominio'

describe('estados', () => {
  it('tiene los seis estados acordados', () => {
    assert.deepEqual(
      [...ESTADOS],
      ['pendiente', 'asignado', 'en_curso', 'en_espera', 'finalizado', 'cancelado'],
    )
  })

  it('todos los estados tienen etiqueta, descripción y color', () => {
    for (const estado of ESTADOS) {
      assert.ok(ESTADO[estado].etiqueta.length > 0, `falta la etiqueta de ${estado}`)
      assert.ok(ESTADO[estado].descripcion.length > 0, `falta la descripción de ${estado}`)
      assert.match(ESTADO[estado].punto, /^bg-/, `falta el color de ${estado}`)
    }
  })

  it('finalizado y cancelado son los únicos estados cerrados', () => {
    const cerrados = ESTADOS.filter((estado) => esEstadoFinal(estado))
    assert.deepEqual(cerrados, ESTADOS_FINALES)
  })

  it('los estados abiertos y los cerrados cubren todos los estados sin solaparse', () => {
    assert.equal(ESTADOS_ABIERTOS.length + ESTADOS_FINALES.length, ESTADOS.length)
    for (const abierto of ESTADOS_ABIERTOS) {
      assert.ok(!ESTADOS_FINALES.includes(abierto))
    }
  })

  it('reconoce lo que no es un estado', () => {
    assert.ok(esEstado('pendiente'))
    assert.ok(!esEstado('PENDIENTE'))
    assert.ok(!esEstado('en espera'))
    assert.ok(!esEstado(undefined))
    assert.ok(!esEstado(3))
  })

  it('solo en espera y finalizado exigen explicación', () => {
    const conMotivo = ESTADOS.filter((estado) => requiereMotivoEspera(estado))
    const conResumen = ESTADOS.filter((estado) => requiereResumenCierre(estado))
    assert.deepEqual(conMotivo, ['en_espera'])
    assert.deepEqual(conResumen, ['finalizado'])
  })
})

describe('prioridades', () => {
  it('van de menos a más urgente', () => {
    const pesos = PRIORIDADES.map((prioridad) => PRIORIDAD[prioridad].peso)
    assert.deepEqual(pesos, [...pesos].sort((a, b) => a - b))
    assert.equal(PRIORIDAD.urgente.peso, 3)
  })
})

describe('totalHoras', () => {
  it('suma las horas de todos los partes', () => {
    assert.equal(totalHoras([{ horas: 2 }, { horas: 1.5 }, { horas: 0.5 }]), 4)
  })

  it('un aviso sin partes tiene cero horas', () => {
    assert.equal(totalHoras([]), 0)
  })
})

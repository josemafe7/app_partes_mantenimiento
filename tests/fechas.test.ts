/**
 * Pruebas de las fechas: es donde más fácil se cuela un error de un día
 * por culpa de la zona horaria o del inicio de semana.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  aISO,
  cuadriculaMes,
  desdeISO,
  diasDeRetraso,
  esFechaISO,
  fechaCorta,
  fechaRelativa,
  hoyISO,
  horasTexto,
  inicioDeMes,
  lunesDe,
  semanaDesde,
  sumarDias,
  sumarMeses,
} from '../src/lib/fechas'

describe('conversión de fechas', () => {
  it('usa la fecha local, no la UTC', () => {
    // A las 23:30 del 17 en Madrid, en UTC ya podría ser el 18.
    const nocheDel17 = new Date(2026, 8, 17, 23, 30)
    assert.equal(aISO(nocheDel17), '2026-09-17')
  })

  it('ida y vuelta sin perder el día', () => {
    for (const iso of ['2026-01-01', '2026-02-28', '2026-03-29', '2026-10-25', '2026-12-31']) {
      assert.equal(aISO(desdeISO(iso)), iso, `se ha desplazado ${iso}`)
    }
  })

  it('valida el formato', () => {
    assert.ok(esFechaISO('2026-09-17'))
    assert.ok(!esFechaISO('17/09/2026'))
    assert.ok(!esFechaISO('2026-9-7'))
    assert.ok(!esFechaISO('2026-02-30'))
    assert.ok(!esFechaISO(''))
  })
})

describe('sumarDias', () => {
  it('cruza el fin de mes', () => {
    assert.equal(sumarDias('2026-01-31', 1), '2026-02-01')
    assert.equal(sumarDias('2026-03-01', -1), '2026-02-28')
  })

  it('cruza el cambio de año', () => {
    assert.equal(sumarDias('2026-12-31', 1), '2027-01-01')
  })

  it('sobrevive al cambio de hora de primavera', () => {
    // En España la madrugada del último domingo de marzo solo tiene 23 horas.
    assert.equal(sumarDias('2026-03-28', 1), '2026-03-29')
    assert.equal(sumarDias('2026-03-29', 1), '2026-03-30')
  })
})

describe('semanas', () => {
  it('el lunes de una semana es el mismo para todos sus días', () => {
    // 2026-09-14 es lunes; 2026-09-20, domingo.
    for (const dia of [
      '2026-09-14',
      '2026-09-15',
      '2026-09-16',
      '2026-09-17',
      '2026-09-18',
      '2026-09-19',
      '2026-09-20',
    ]) {
      assert.equal(lunesDe(dia), '2026-09-14', `mal el lunes de ${dia}`)
    }
  })

  it('el domingo pertenece a la semana que empieza el lunes anterior', () => {
    assert.equal(lunesDe('2026-09-20'), '2026-09-14')
    assert.equal(lunesDe('2026-09-21'), '2026-09-21')
  })

  it('una semana son siete días consecutivos', () => {
    const dias = semanaDesde('2026-09-14')
    assert.equal(dias.length, 7)
    assert.equal(dias[0], '2026-09-14')
    assert.equal(dias[6], '2026-09-20')
  })
})

describe('meses', () => {
  it('el inicio de mes es el día 1', () => {
    assert.equal(inicioDeMes('2026-09-19'), '2026-09-01')
    assert.equal(inicioDeMes('2026-09-01'), '2026-09-01')
  })

  it('sumar meses no se desborda en los meses cortos', () => {
    assert.equal(sumarMeses('2026-01-31', 1), '2026-02-01')
    assert.equal(sumarMeses('2026-03-31', -1), '2026-02-01')
  })

  it('sumar meses cruza el cambio de año', () => {
    assert.equal(sumarMeses('2026-12-15', 1), '2027-01-01')
    assert.equal(sumarMeses('2026-01-15', -1), '2025-12-01')
  })

  it('la cuadrícula va de lunes a domingo y cubre todo el mes', () => {
    // Septiembre de 2026 empieza en martes y acaba en miércoles.
    const dias = cuadriculaMes('2026-09-19')
    assert.equal(dias[0], '2026-08-31')
    assert.equal(dias.at(-1), '2026-10-04')
    assert.equal(dias.length, 35)
    for (let i = 1; i < dias.length; i++) assert.equal(dias[i], sumarDias(dias[i - 1], 1))
  })

  it('un mes que empieza en lunes no arrastra la semana anterior', () => {
    // Febrero de 2027 empieza en lunes y tiene 28 días: cuatro semanas justas.
    const dias = cuadriculaMes('2027-02-10')
    assert.equal(dias[0], '2027-02-01')
    assert.equal(dias.at(-1), '2027-02-28')
    assert.equal(dias.length, 28)
  })

  it('un mes largo que empieza en domingo ocupa seis semanas', () => {
    // Noviembre de 2026 empieza en domingo.
    const dias = cuadriculaMes('2026-11-01')
    assert.equal(dias[0], '2026-10-26')
    assert.equal(dias.at(-1), '2026-12-06')
    assert.equal(dias.length, 42)
  })
})

describe('diasDeRetraso', () => {
  it('no hay retraso si la fecha es hoy o futura', () => {
    assert.equal(diasDeRetraso(hoyISO()), 0)
    assert.equal(diasDeRetraso(sumarDias(hoyISO(), 5)), 0)
  })

  it('cuenta los días pasados', () => {
    assert.equal(diasDeRetraso(sumarDias(hoyISO(), -1)), 1)
    assert.equal(diasDeRetraso(sumarDias(hoyISO(), -9)), 9)
  })

  it('sin fecha prevista no hay retraso', () => {
    assert.equal(diasDeRetraso(null), 0)
    assert.equal(diasDeRetraso(undefined), 0)
  })
})

describe('presentación', () => {
  it('escribe las fechas como en España', () => {
    assert.equal(fechaCorta('2026-09-17'), '17/09/2026')
    assert.equal(fechaCorta(null), '—')
  })

  it('usa palabras para los días cercanos', () => {
    assert.equal(fechaRelativa(hoyISO()), 'Hoy')
    assert.equal(fechaRelativa(sumarDias(hoyISO(), 1)), 'Mañana')
    assert.equal(fechaRelativa(sumarDias(hoyISO(), -1)), 'Ayer')
    assert.equal(fechaRelativa(null), 'Sin fecha')
  })

  it('escribe las horas con coma decimal', () => {
    assert.equal(horasTexto(2), '2 h')
    assert.equal(horasTexto(1.5), '1,5 h')
    assert.equal(horasTexto(0), '0 h')
  })
})

/**
 * Pruebas de los filtros del listado: la URL es el contrato entre el panel,
 * los atajos, el buscador y la consulta a la base de datos.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  aParametros,
  enlaceAvisos,
  FILTROS_VACIOS,
  hayFiltros,
  leerFiltros,
  numeroFiltrosDetalle,
  VISTA,
  VISTAS,
} from '../src/lib/filtros'
import { iniciales, inicialesEmpresa, normalizar, plural } from '../src/lib/utils'

describe('leerFiltros', () => {
  it('sin parámetros muestra el trabajo abierto', () => {
    const filtros = leerFiltros({})
    assert.equal(filtros.vista, 'abiertos')
    assert.equal(filtros.q, '')
    assert.equal(filtros.estado, '')
  })

  it('descarta los valores que no están en el vocabulario', () => {
    const filtros = leerFiltros({
      estado: 'inventado',
      prioridad: 'muy_alta',
      categoria: 'jardineria',
      vista: 'otra_cosa',
    })
    assert.equal(filtros.estado, '')
    assert.equal(filtros.prioridad, '')
    assert.equal(filtros.categoria, '')
    assert.equal(filtros.vista, 'abiertos')
  })

  it('acepta los valores válidos', () => {
    const filtros = leerFiltros({
      estado: 'en_espera',
      prioridad: 'urgente',
      categoria: 'climatizacion',
      vista: 'retrasados',
      q: 'cámara',
    })
    assert.equal(filtros.estado, 'en_espera')
    assert.equal(filtros.prioridad, 'urgente')
    assert.equal(filtros.categoria, 'climatizacion')
    assert.equal(filtros.vista, 'retrasados')
    assert.equal(filtros.q, 'cámara')
  })

  it('en el técnico admite un id o «sin» y nada más', () => {
    assert.equal(leerFiltros({ tecnico: '7' }).tecnico, '7')
    assert.equal(leerFiltros({ tecnico: 'sin' }).tecnico, 'sin')
    assert.equal(leerFiltros({ tecnico: 'marta' }).tecnico, '')
    assert.equal(leerFiltros({ tecnico: '-3' }).tecnico, '')
  })

  it('rechaza fechas mal escritas', () => {
    assert.equal(leerFiltros({ desde: '2026-09-17' }).desde, '2026-09-17')
    assert.equal(leerFiltros({ desde: '17/09/2026' }).desde, '')
  })

  it('si el parámetro llega repetido se queda con el primero', () => {
    assert.equal(leerFiltros({ estado: ['en_curso', 'finalizado'] }).estado, 'en_curso')
  })

  it('corta búsquedas desmedidas', () => {
    assert.equal(leerFiltros({ q: 'a'.repeat(500) }).q.length, 120)
  })
})

describe('aParametros', () => {
  it('la vista por defecto no ensucia la URL', () => {
    assert.equal(aParametros({ vista: 'abiertos' }), '')
    assert.equal(aParametros({}), '')
  })

  it('escribe solo lo que filtra', () => {
    assert.equal(aParametros({ vista: 'hoy' }), '?vista=hoy')
    assert.equal(aParametros({ estado: 'en_espera' }), '?estado=en_espera')
  })

  it('los enlaces del panel apuntan al listado filtrado', () => {
    assert.equal(enlaceAvisos({ vista: 'retrasados' }), '/avisos?vista=retrasados')
    assert.equal(enlaceAvisos({ vista: 'abiertos' }), '/avisos')
  })

  it('leer y volver a escribir no cambia el resultado', () => {
    const original = '?vista=hoy&prioridad=urgente&tecnico=4'
    const filtros = leerFiltros({ vista: 'hoy', prioridad: 'urgente', tecnico: '4' })
    const parametros = new URLSearchParams(aParametros(filtros).slice(1))
    const esperados = new URLSearchParams(original.slice(1))
    assert.deepEqual([...parametros.entries()].sort(), [...esperados.entries()].sort())
  })
})

describe('recuento de filtros', () => {
  it('la vista por defecto no cuenta como filtro', () => {
    assert.equal(hayFiltros(FILTROS_VACIOS), false)
    assert.equal(numeroFiltrosDetalle(FILTROS_VACIOS), 0)
  })

  it('cuenta los filtros de detalle, no los atajos', () => {
    const filtros = leerFiltros({ vista: 'hoy', prioridad: 'alta', tecnico: '2' })
    assert.equal(hayFiltros(filtros), true)
    assert.equal(numeroFiltrosDetalle(filtros), 2)
  })
})

describe('vistas', () => {
  it('todas tienen etiqueta y explicación', () => {
    for (const vista of VISTAS) {
      assert.ok(VISTA[vista].etiqueta.length > 0, `falta la etiqueta de ${vista}`)
      assert.ok(VISTA[vista].descripcion.length > 0, `falta la descripción de ${vista}`)
    }
  })
})

describe('utilidades de texto', () => {
  it('buscar ignora acentos y mayúsculas', () => {
    assert.equal(normalizar('Climatización'), 'climatizacion')
    assert.ok(normalizar('Panadería El Horno').includes('panaderia'))
    assert.equal(normalizar('  Climatización  '), 'climatizacion')
  })

  it('la ñ también se normaliza, para poder buscar sin ella', () => {
    // Buscar «canerias» encuentra «cañerías»: en un móvil a pie de obra
    // se escribe deprisa y sin acentos.
    assert.equal(normalizar('Cañerías'), 'canerias')
    assert.equal(normalizar('España'), 'espana')
  })

  it('el plural concuerda', () => {
    assert.equal(plural(0, 'aviso', 'avisos'), '0 avisos')
    assert.equal(plural(1, 'aviso', 'avisos'), '1 aviso')
    assert.equal(plural(2, 'local', 'locales'), '2 locales')
  })

  it('las iniciales salen del nombre y del apellido', () => {
    assert.equal(iniciales('Marta', 'Ruiz Alcántara'), 'MR')
    assert.equal(iniciales('Marta Ruiz'), 'MR')
    assert.equal(iniciales('Sergio', null), 'S')
  })

  it('las iniciales de una empresa se saltan artículos y preposiciones', () => {
    assert.equal(inicialesEmpresa('Panaderías El Horno de Lucía'), 'PH')
    assert.equal(inicialesEmpresa('Restaurante La Brasería del Puerto'), 'RB')
    assert.equal(inicialesEmpresa('Cafeterías Grano & Co.'), 'CG')
    assert.equal(inicialesEmpresa('Frescal'), 'F')
  })
})

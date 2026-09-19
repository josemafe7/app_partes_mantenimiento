/**
 * Pruebas de la validación de los formularios (`src/lib/validaciones.ts`) y
 * del contrato común de las acciones (`src/lib/acciones.ts`).
 *
 * Todo llega del navegador como texto: aquí se decide qué se guarda, cómo se
 * convierte y qué mensaje ve quien lo ha escrito mal.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { casilla, texto, valoresDe, valoresPrevios, valorPrevio } from '../src/lib/acciones'
import {
  erroresDe,
  esquemaAsignacion,
  esquemaAviso,
  esquemaCambioEstado,
  esquemaCliente,
  esquemaContrasenaNueva,
  esquemaLocal,
  esquemaParte,
  esquemaTecnico,
} from '../src/lib/validaciones'

/** Los errores por campo, o `{}` si pasa la validación. */
function errores(esquema: { safeParse: (datos: unknown) => { success: boolean; error?: unknown } }, datos: unknown) {
  const resultado = esquema.safeParse(datos)
  return resultado.success ? {} : erroresDe(resultado.error as Parameters<typeof erroresDe>[0])
}

const AVISO = {
  clienteId: '1',
  localId: '2',
  tecnicoId: '',
  titulo: '  Gotea el grifo del office  ',
  descripcion: '',
  categoria: 'fontaneria',
  prioridad: 'normal',
  estado: 'pendiente',
  canalEntrada: 'telefono',
  contactoAviso: '',
  fechaProgramada: '',
  horaProgramada: '',
  motivoEspera: '',
  resumenCierre: '',
}

describe('avisos', () => {
  it('convierte el formulario a lo que guarda la base', () => {
    const resultado = esquemaAviso.safeParse(AVISO)
    assert.ok(resultado.success)
    assert.equal(resultado.data.clienteId, 1)
    assert.equal(resultado.data.tecnicoId, null)
    assert.equal(resultado.data.titulo, 'Gotea el grifo del office')
    assert.equal(resultado.data.descripcion, null)
    assert.equal(resultado.data.fechaProgramada, null)
  })

  it('en espera pide el motivo y finalizado el resumen', () => {
    const conTecnico = { ...AVISO, tecnicoId: '3' }
    assert.ok(errores(esquemaAviso, { ...conTecnico, estado: 'en_espera' }).motivoEspera)
    assert.ok(errores(esquemaAviso, { ...conTecnico, estado: 'finalizado', resumenCierre: '   ' }).resumenCierre)
    assert.deepEqual(errores(esquemaAviso, { ...conTecnico, estado: 'en_espera', motivoEspera: 'Sin llave' }), {})
  })

  it('salvo pendiente y cancelado, todo estado necesita técnico', () => {
    for (const estado of ['asignado', 'en_curso', 'en_espera', 'finalizado']) {
      const datos = { ...AVISO, estado, motivoEspera: 'Motivo', resumenCierre: 'Resumen' }
      assert.ok(errores(esquemaAviso, datos).tecnicoId, `${estado} sin técnico ha pasado`)
    }
    for (const estado of ['pendiente', 'cancelado']) {
      assert.deepEqual(errores(esquemaAviso, { ...AVISO, estado }), {}, `${estado} sin técnico no ha pasado`)
    }
  })

  it('una hora sin día no vale, y la hora tiene que existir', () => {
    assert.ok(errores(esquemaAviso, { ...AVISO, horaProgramada: '09:30' }).fechaProgramada)
    assert.deepEqual(errores(esquemaAviso, { ...AVISO, fechaProgramada: '2026-10-01', horaProgramada: '23:59' }), {})
    for (const hora of ['9:30', '24:00', '12:60', 'mediodía']) {
      assert.ok(errores(esquemaAviso, { ...AVISO, fechaProgramada: '2026-10-01', horaProgramada: hora }).horaProgramada, hora)
    }
    assert.ok(errores(esquemaAviso, { ...AVISO, fechaProgramada: '2026-02-30' }).fechaProgramada)
  })

  it('rechaza lo que no está en el vocabulario y los ids que no son ids', () => {
    const mal = errores(esquemaAviso, {
      ...AVISO,
      categoria: 'jardineria',
      prioridad: 'maxima',
      clienteId: 'abc',
      localId: '0',
      tecnicoId: '-4',
    })
    assert.equal(mal.categoria, 'Selecciona el tipo de trabajo')
    assert.equal(mal.prioridad, 'Selecciona la prioridad')
    assert.equal(mal.clienteId, 'Selecciona el cliente')
    assert.equal(mal.localId, 'Selecciona el local')
    assert.equal(mal.tecnicoId, 'Selección no válida')
  })

  it('pone límite al largo de los textos', () => {
    assert.equal(errores(esquemaAviso, { ...AVISO, titulo: 'x'.repeat(161) }).titulo, 'Como máximo 160 caracteres')
    assert.ok(errores(esquemaAviso, { ...AVISO, titulo: '   ' }).titulo)
  })
})

describe('asignación y cambio de estado', () => {
  it('la asignación tampoco admite una hora sin día', () => {
    assert.ok(errores(esquemaAsignacion, { tecnicoId: '3', fechaProgramada: '', horaProgramada: '10:00' }).fechaProgramada)
    const valida = esquemaAsignacion.safeParse({ tecnicoId: '', fechaProgramada: '2026-10-01', horaProgramada: '' })
    assert.ok(valida.success)
    assert.equal(valida.data.tecnicoId, null)
    assert.equal(valida.data.horaProgramada, null)
  })

  it('el cambio de estado pide nota para en espera y finalizado, y solo para esos', () => {
    assert.ok(errores(esquemaCambioEstado, { estado: 'en_espera', nota: '  ' }).nota)
    assert.ok(errores(esquemaCambioEstado, { estado: 'finalizado', nota: '' }).nota)
    for (const estado of ['pendiente', 'asignado', 'en_curso', 'cancelado']) {
      assert.deepEqual(errores(esquemaCambioEstado, { estado, nota: '' }), {}, estado)
    }
  })
})

describe('partes de trabajo', () => {
  const PARTE = {
    tecnicoId: '3',
    fecha: '2026-09-18',
    horas: '1',
    trabajoRealizado: 'Cambiado el latiguillo',
    materiales: '',
    resuelto: false,
    observaciones: '',
  }

  it('las horas admiten coma decimal, como se escriben en España', () => {
    const conComa = esquemaParte.safeParse({ ...PARTE, horas: '2,5' })
    const conPunto = esquemaParte.safeParse({ ...PARTE, horas: '2.5' })
    assert.ok(conComa.success && conPunto.success)
    assert.equal(conComa.data.horas, 2.5)
    assert.equal(conPunto.data.horas, 2.5)
  })

  it('las horas son más de 0 y como mucho 24', () => {
    assert.equal(errores(esquemaParte, { ...PARTE, horas: '' }).horas, 'Indica las horas dedicadas')
    for (const horas of ['0', '-1', 'dos', '1,5,2']) {
      assert.equal(errores(esquemaParte, { ...PARTE, horas }).horas, 'Las horas deben ser mayores que 0', horas)
    }
    assert.equal(errores(esquemaParte, { ...PARTE, horas: '24,5' }).horas, 'Como máximo 24 horas en un mismo parte')
    assert.deepEqual(errores(esquemaParte, { ...PARTE, horas: '24' }), {})
  })

  it('pide técnico, día y qué se hizo', () => {
    const mal = errores(esquemaParte, { ...PARTE, tecnicoId: '', fecha: '', trabajoRealizado: ' ' })
    assert.ok(mal.tecnicoId)
    assert.equal(mal.fecha, 'Indica la fecha')
    assert.ok(mal.trabajoRealizado)
  })
})

describe('clientes, locales y técnicos', () => {
  const CLIENTE = {
    nombre: 'Frescal',
    cif: '',
    personaContacto: '',
    telefono: '',
    email: '',
    direccionFacturacion: '',
    notas: '',
  }
  const LOCAL = {
    clienteId: '1',
    nombre: 'Frescal — Centro',
    direccion: 'Calle Mayor 3',
    ciudad: 'Madrid',
    provincia: '',
    codigoPostal: '',
    telefono: '',
    personaContacto: '',
    horario: '',
    notasAcceso: '',
  }
  const TECNICO = { nombre: 'Luis', apellidos: '', telefono: '', email: '', especialidades: ['fontaneria'], zona: '', notas: '' }

  it('el email es opcional, pero si se escribe tiene que ser un email', () => {
    const sinEmail = esquemaCliente.safeParse(CLIENTE)
    assert.ok(sinEmail.success)
    assert.equal(sinEmail.data.email, null)
    assert.deepEqual(errores(esquemaCliente, { ...CLIENTE, email: ' pedidos@frescal.es ' }), {})
    for (const email of ['frescal', 'frescal@', 'frescal@empresa', 'fres cal@empresa.es']) {
      assert.deepEqual(errores(esquemaCliente, { ...CLIENTE, email }), { email: 'Escribe un email válido' }, email)
    }
  })

  it('un local necesita cliente, dirección y ciudad', () => {
    assert.deepEqual(errores(esquemaLocal, LOCAL), {})
    const mal = errores(esquemaLocal, { ...LOCAL, clienteId: '', direccion: '', ciudad: ' ' })
    assert.deepEqual(Object.keys(mal).sort(), ['ciudad', 'clienteId', 'direccion'])
  })

  it('un técnico necesita al menos una especialidad, y de las que existen', () => {
    assert.deepEqual(errores(esquemaTecnico, { ...TECNICO, especialidades: [] }), {
      especialidades: 'Marca al menos una especialidad',
    })
    assert.ok(errores(esquemaTecnico, { ...TECNICO, especialidades: ['jardineria'] })['especialidades.0'])
    assert.deepEqual(errores(esquemaTecnico, { ...TECNICO, especialidades: ['fontaneria', 'multiservicio'] }), {})
  })
})

describe('contraseña nueva', () => {
  const esquema = esquemaContrasenaNueva('marta.ruiz@empresa.es')

  it('tiene que cumplir las reglas y escribirse igual dos veces', () => {
    assert.deepEqual(errores(esquema, { nueva: 'Tejado-Verde-2026', repetir: 'Tejado-Verde-2026' }), {})
    assert.deepEqual(errores(esquema, { nueva: 'Tejado-Verde-2026', repetir: 'Tejado-Verde-2027' }), {
      repetir: 'Las dos contraseñas no coinciden',
    })
  })

  it('si es débil, lo dice en la nueva y no en la repetición', () => {
    const mal = errores(esquema, { nueva: 'corta', repetir: 'otra' })
    assert.ok(mal.nueva)
    assert.equal(mal.repetir, undefined)
    assert.match(errores(esquema, { nueva: 'Marta.Ruiz-2026', repetir: 'Marta.Ruiz-2026' }).nueva ?? '', /email/)
  })
})

describe('errores por campo', () => {
  it('se queda con el primer error de cada campo', () => {
    const mal = errores(esquemaAviso, { ...AVISO, titulo: '' })
    assert.equal(mal.titulo, 'Resume la incidencia en una frase')
  })
})

describe('contrato de las acciones', () => {
  it('copia el formulario para repintarlo, con los campos repetidos en una lista', () => {
    const datos = new FormData()
    datos.append('nombre', 'Luis')
    datos.append('especialidades', 'fontaneria')
    datos.append('especialidades', 'electricidad')
    datos.append('adjunto', new Blob(['x']), 'foto.jpg')
    assert.deepEqual(valoresDe(datos), { nombre: 'Luis', especialidades: ['fontaneria', 'electricidad'] })
  })

  it('lee textos y casillas como llegan del navegador', () => {
    const datos = new FormData()
    datos.append('titulo', 'Gotera')
    datos.append('resuelto', 'on')
    datos.append('adjunto', new Blob(['x']), 'foto.jpg')
    assert.equal(texto(datos, 'titulo'), 'Gotera')
    assert.equal(texto(datos, 'falta'), '')
    assert.equal(texto(datos, 'adjunto'), '')
    assert.equal(casilla(datos, 'resuelto'), true)
    assert.equal(casilla(datos, 'urgente'), false)
  })

  it('recupera lo escrito tras un error, también en los grupos de casillas', () => {
    const resultado = { ok: false, valores: { nombre: 'Luis', especialidades: 'fontaneria', zonas: ['Norte', 'Sur'] } }
    assert.equal(valorPrevio(resultado, 'nombre'), 'Luis')
    assert.equal(valorPrevio(resultado, 'zonas'), undefined)
    assert.deepEqual(valoresPrevios(resultado, 'especialidades'), ['fontaneria'])
    assert.deepEqual(valoresPrevios(resultado, 'zonas'), ['Norte', 'Sur'])
    assert.equal(valorPrevio(null, 'nombre'), undefined)
  })
})

/**
 * Pruebas de las reglas de estado de los avisos y de los partes, ejecutando las
 * acciones de servidor de verdad (`src/acciones/avisos.ts` y `partes.ts`) sobre
 * una base en memoria.
 *
 * Es lo que más importa y lo que menos se ve: un cambio de estado que no deja
 * rastro en la cronología, un técnico que mueve un aviso ajeno o un aviso «en
 * curso» sin nadie asignado no rompen ninguna pantalla.
 */

import assert from 'node:assert/strict'
import { before, beforeEach, describe, it } from 'node:test'

import { asc, eq, sql } from 'drizzle-orm'

import * as esquema from '../src/db/esquema'
import { SIN_PERMISO } from '../src/lib/acciones'
import { crearFichas, nuevoAviso, usarBaseEnMemoria, type BaseDePruebas, type Fichas } from './ayudas/base'
import { entrarComo, formulario, redireccion, reiniciar, sustituirServidor } from './ayudas/servidor'

let bd: BaseDePruebas
let fichas: Fichas
let avisos: typeof import('../src/acciones/avisos')
let partes: typeof import('../src/acciones/partes')

before(async () => {
  bd = await usarBaseEnMemoria()
  sustituirServidor(bd)
  fichas = await crearFichas(bd)
  avisos = await import('../src/acciones/avisos')
  partes = await import('../src/acciones/partes')
})

beforeEach(() => reiniciar())

/* ---------------------------------------------------------------- Ayudas */

async function leerAviso(id: number) {
  const [aviso] = await bd.select().from(esquema.avisos).where(eq(esquema.avisos.id, id))
  return aviso
}

async function cronologia(avisoId: number) {
  return bd
    .select()
    .from(esquema.movimientos)
    .where(eq(esquema.movimientos.avisoId, avisoId))
    .orderBy(asc(esquema.movimientos.id))
}

async function partesDe(avisoId: number) {
  return bd.select().from(esquema.partes).where(eq(esquema.partes.avisoId, avisoId))
}

async function numeroDeAvisos(): Promise<number> {
  const [{ total }] = await bd.select({ total: sql<number>`count(*)::int` }).from(esquema.avisos)
  return total
}

/** El formulario de alta o edición de un aviso, relleno como lo mandaría la oficina. */
function datosAviso(cambios: Record<string, string | number> = {}) {
  return formulario({
    clienteId: fichas.clientes.horno.id,
    localId: fichas.locales.hornoCentro.id,
    tecnicoId: '',
    titulo: 'Salta el diferencial del obrador',
    descripcion: '',
    categoria: 'electricidad',
    prioridad: 'urgente',
    estado: 'pendiente',
    canalEntrada: 'whatsapp',
    contactoAviso: 'Lucía',
    fechaProgramada: '',
    horaProgramada: '',
    motivoEspera: '',
    resumenCierre: '',
    ...cambios,
  })
}

/** El formulario de un parte de trabajo. `resuelto: 'on'` es la casilla marcada. */
function datosParte(avisoId: number, cambios: Record<string, string | number> = {}) {
  return formulario({
    avisoId,
    tecnicoId: fichas.tecnicos.marta.id,
    fecha: '2026-09-18',
    horas: '2,5',
    trabajoRealizado: 'Revisado el cuadro eléctrico y cambiado el diferencial',
    materiales: '',
    observaciones: '',
    ...cambios,
  })
}

function idDe(destino: string): number {
  const encontrado = /^\/avisos\/(\d+)$/.exec(destino)
  assert.ok(encontrado, `redirige a ${destino} en lugar de a la ficha del aviso`)
  return Number(encontrado[1])
}

const MARTA = 'Marta Ruiz Alcántara'

/* ----------------------------------------------------------------- Alta */

describe('alta de avisos', () => {
  it('la oficina registra un aviso con su referencia y la primera línea de la cronología', async () => {
    entrarComo(fichas.usuarios.oficina)
    const id = idDe(await redireccion(avisos.crearAviso(undefined, datosAviso())))

    const aviso = await leerAviso(id)
    assert.match(aviso.referencia, new RegExp(`^AV-${new Date().getFullYear()}-\\d{4}$`))
    assert.equal(aviso.estado, 'pendiente')

    const lineas = await cronologia(id)
    assert.equal(lineas.length, 1)
    assert.equal(lineas[0].estadoAnterior, null)
    assert.equal(lineas[0].estadoNuevo, 'pendiente')
    assert.equal(lineas[0].nota, 'Aviso registrado')
    assert.equal(lineas[0].usuarioId, fichas.usuarios.oficina.id)
  })

  it('si entra ya asignado, la cronología dice a quién', async () => {
    entrarComo(fichas.usuarios.oficina)
    const id = idDe(
      await redireccion(
        avisos.crearAviso(undefined, datosAviso({ estado: 'asignado', tecnicoId: fichas.tecnicos.marta.id })),
      ),
    )
    const [linea] = await cronologia(id)
    assert.equal(linea.nota, `Aviso registrado y asignado a ${MARTA}`)
  })

  it('solo guarda el motivo o el resumen que corresponden al estado', async () => {
    entrarComo(fichas.usuarios.oficina)
    const id = idDe(
      await redireccion(
        avisos.crearAviso(
          undefined,
          datosAviso({
            estado: 'finalizado',
            tecnicoId: fichas.tecnicos.marta.id,
            resumenCierre: 'Cambiado el magnetotérmico',
            motivoEspera: 'Esto sobra',
          }),
        ),
      ),
    )
    const aviso = await leerAviso(id)
    assert.equal(aviso.resumenCierre, 'Cambiado el magnetotérmico')
    assert.equal(aviso.motivoEspera, null)
    assert.ok(aviso.fechaCierre, 'un aviso que nace finalizado necesita su fecha de cierre')
  })

  it('rechaza un local de otro cliente, sin guardar nada y devolviendo lo escrito', async () => {
    entrarComo(fichas.usuarios.oficina)
    const antes = await numeroDeAvisos()
    const resultado = await avisos.crearAviso(
      undefined,
      datosAviso({ clienteId: fichas.clientes.grano.id, localId: fichas.locales.hornoCentro.id }),
    )
    assert.equal(resultado.ok, false)
    assert.equal(resultado.errores?.localId, 'Ese local no pertenece al cliente seleccionado')
    assert.equal(resultado.valores?.titulo, 'Salta el diferencial del obrador')
    assert.equal(await numeroDeAvisos(), antes)
  })

  it('ni un técnico ni alguien sin sesión pueden dar de alta avisos', async () => {
    const antes = await numeroDeAvisos()
    entrarComo(fichas.usuarios.tecnico)
    assert.deepEqual(await avisos.crearAviso(undefined, datosAviso()), SIN_PERMISO)
    entrarComo(null)
    assert.deepEqual(await avisos.crearAviso(undefined, datosAviso()), SIN_PERMISO)
    assert.equal(await numeroDeAvisos(), antes)
  })
})

/* -------------------------------------------------------------- Edición */

describe('edición de avisos', () => {
  /** El formulario de edición con lo que ya tiene guardado el aviso. */
  function datosDe(aviso: esquema.Aviso, cambios: Record<string, string | number> = {}) {
    return datosAviso({
      id: aviso.id,
      clienteId: aviso.clienteId,
      localId: aviso.localId,
      tecnicoId: aviso.tecnicoId ?? '',
      titulo: aviso.titulo,
      categoria: aviso.categoria,
      prioridad: aviso.prioridad,
      estado: aviso.estado,
      canalEntrada: aviso.canalEntrada,
      motivoEspera: aviso.motivoEspera ?? '',
      resumenCierre: aviso.resumenCierre ?? '',
      ...cambios,
    })
  }

  it('cambiar técnico y estado deja una sola línea con los dos cambios', async () => {
    const aviso = await nuevoAviso(bd, fichas)
    entrarComo(fichas.usuarios.oficina)
    const destino = await redireccion(
      avisos.actualizarAviso(undefined, datosDe(aviso, { estado: 'asignado', tecnicoId: fichas.tecnicos.marta.id })),
    )
    assert.equal(destino, `/avisos/${aviso.id}`)

    const lineas = await cronologia(aviso.id)
    assert.equal(lineas.length, 1)
    assert.equal(lineas[0].estadoAnterior, 'pendiente')
    assert.equal(lineas[0].estadoNuevo, 'asignado')
    assert.equal(lineas[0].nota, `Asignado a ${MARTA}. Estado cambiado a asignado`)
    assert.equal(lineas[0].usuarioId, fichas.usuarios.oficina.id)
  })

  it('corregir el texto no ensucia la cronología', async () => {
    const aviso = await nuevoAviso(bd, fichas)
    entrarComo(fichas.usuarios.oficina)
    await redireccion(avisos.actualizarAviso(undefined, datosDe(aviso, { titulo: 'El horno no llega a 200 °C' })))
    assert.equal((await leerAviso(aviso.id)).titulo, 'El horno no llega a 200 °C')
    assert.equal((await cronologia(aviso.id)).length, 0)
  })

  it('un aviso ya cerrado conserva su fecha de cierre al corregirlo', async () => {
    const cierre = new Date('2026-09-01T10:00:00Z')
    const aviso = await nuevoAviso(bd, fichas, {
      estado: 'finalizado',
      tecnicoId: fichas.tecnicos.marta.id,
      resumenCierre: 'Cambiada la resistencia',
      fechaCierre: cierre,
    })
    entrarComo(fichas.usuarios.oficina)
    await redireccion(avisos.actualizarAviso(undefined, datosDe(aviso, { titulo: 'Horno de leña' })))
    assert.equal((await leerAviso(aviso.id)).fechaCierre?.getTime(), cierre.getTime())
  })

  it('no edita un aviso que ya no existe, ni deja editar a un técnico', async () => {
    const aviso = await nuevoAviso(bd, fichas, { estado: 'asignado', tecnicoId: fichas.tecnicos.marta.id })
    entrarComo(fichas.usuarios.oficina)
    assert.deepEqual(await avisos.actualizarAviso(undefined, datosDe(aviso, { id: 999_999 })), {
      ok: false,
      mensaje: 'El aviso ya no existe',
    })
    entrarComo(fichas.usuarios.tecnico)
    assert.deepEqual(await avisos.actualizarAviso(undefined, datosDe(aviso, { titulo: 'Otro' })), SIN_PERMISO)
    assert.equal((await leerAviso(aviso.id)).titulo, aviso.titulo)
  })
})

/* ---------------------------------------------------- Cambios de estado */

describe('cambios de estado', () => {
  it('en espera exige motivo; sin él no cambia nada', async () => {
    const aviso = await nuevoAviso(bd, fichas, { estado: 'asignado', tecnicoId: fichas.tecnicos.marta.id })
    entrarComo(fichas.usuarios.oficina)

    const sinMotivo = await avisos.cambiarEstado(aviso.id, 'en_espera', '  ')
    assert.equal(sinMotivo.ok, false)
    assert.ok(sinMotivo.errores?.nota)
    assert.equal((await leerAviso(aviso.id)).estado, 'asignado')
    assert.equal((await cronologia(aviso.id)).length, 0)

    assert.deepEqual(await avisos.cambiarEstado(aviso.id, 'en_espera', 'Falta la pieza del proveedor'), { ok: true })
    const guardado = await leerAviso(aviso.id)
    assert.equal(guardado.estado, 'en_espera')
    assert.equal(guardado.motivoEspera, 'Falta la pieza del proveedor')

    const [linea] = await cronologia(aviso.id)
    assert.equal(linea.estadoAnterior, 'asignado')
    assert.equal(linea.estadoNuevo, 'en_espera')
    assert.equal(linea.nota, 'Falta la pieza del proveedor')
    assert.equal(linea.usuarioId, fichas.usuarios.oficina.id)
  })

  it('finalizar exige resumen y fija la fecha de cierre; reabrir la quita', async () => {
    const aviso = await nuevoAviso(bd, fichas, { estado: 'en_curso', tecnicoId: fichas.tecnicos.marta.id })
    entrarComo(fichas.usuarios.oficina)

    assert.equal((await avisos.cambiarEstado(aviso.id, 'finalizado', '')).ok, false)
    assert.equal((await leerAviso(aviso.id)).fechaCierre, null)

    await avisos.cambiarEstado(aviso.id, 'finalizado', 'Cambiado el termostato')
    const cerrado = await leerAviso(aviso.id)
    assert.equal(cerrado.estado, 'finalizado')
    assert.equal(cerrado.resumenCierre, 'Cambiado el termostato')
    assert.ok(cerrado.fechaCierre)

    await avisos.cambiarEstado(aviso.id, 'en_curso', 'El cliente dice que sigue fallando')
    const reabierto = await leerAviso(aviso.id)
    assert.equal(reabierto.estado, 'en_curso')
    assert.equal(reabierto.fechaCierre, null)
    assert.equal(reabierto.resumenCierre, null)
    assert.equal((await cronologia(aviso.id)).length, 2)
  })

  it('sin técnico, un aviso solo puede estar pendiente o cancelado', async () => {
    const aviso = await nuevoAviso(bd, fichas)
    entrarComo(fichas.usuarios.oficina)

    for (const estado of ['asignado', 'en_curso', 'en_espera', 'finalizado'] as const) {
      const resultado = await avisos.cambiarEstado(aviso.id, estado, 'Con nota')
      assert.equal(resultado.ok, false, `ha pasado a ${estado} sin técnico`)
      assert.match(resultado.mensaje ?? '', /Asigna primero un técnico/)
    }
    assert.deepEqual(await avisos.cambiarEstado(aviso.id, 'cancelado', ''), { ok: true })
    assert.equal((await leerAviso(aviso.id)).estado, 'cancelado')
  })

  it('quedarse en el mismo estado no deja rastro', async () => {
    const aviso = await nuevoAviso(bd, fichas)
    entrarComo(fichas.usuarios.oficina)
    assert.deepEqual(await avisos.cambiarEstado(aviso.id, 'pendiente', ''), { ok: true })
    assert.equal((await cronologia(aviso.id)).length, 0)
  })

  it('el técnico mueve sus avisos en marcha, pero no los cancela ni los reabre', async () => {
    const suyo = await nuevoAviso(bd, fichas, { estado: 'asignado', tecnicoId: fichas.tecnicos.marta.id })
    entrarComo(fichas.usuarios.tecnico)

    assert.deepEqual(await avisos.cambiarEstado(suyo.id, 'en_curso', ''), { ok: true })
    assert.equal((await cronologia(suyo.id))[0].usuarioId, fichas.usuarios.tecnico.id)

    assert.deepEqual(await avisos.cambiarEstado(suyo.id, 'cancelado', ''), SIN_PERMISO)
    assert.deepEqual(await avisos.cambiarEstado(suyo.id, 'pendiente', ''), SIN_PERMISO)
    assert.equal((await leerAviso(suyo.id)).estado, 'en_curso')

    const cerrado = await nuevoAviso(bd, fichas, {
      estado: 'finalizado',
      tecnicoId: fichas.tecnicos.marta.id,
      resumenCierre: 'Hecho',
      fechaCierre: new Date(),
    })
    assert.deepEqual(await avisos.cambiarEstado(cerrado.id, 'en_curso', ''), SIN_PERMISO)
  })

  it('para el técnico, un aviso ajeno no existe', async () => {
    const ajeno = await nuevoAviso(bd, fichas, { estado: 'asignado', tecnicoId: fichas.tecnicos.sergio.id })
    entrarComo(fichas.usuarios.tecnico)
    assert.deepEqual(await avisos.cambiarEstado(ajeno.id, 'en_curso', ''), {
      ok: false,
      mensaje: 'El aviso ya no existe',
    })
    assert.equal((await leerAviso(ajeno.id)).estado, 'asignado')
  })

  it('el formulario de cambio de estado aplica las mismas reglas', async () => {
    const aviso = await nuevoAviso(bd, fichas, { estado: 'asignado', tecnicoId: fichas.tecnicos.marta.id })
    entrarComo(fichas.usuarios.oficina)
    const sinMotivo = await avisos.accionCambiarEstado(
      undefined,
      formulario({ avisoId: aviso.id, estado: 'en_espera', nota: '' }),
    )
    assert.ok(sinMotivo.errores?.nota)
    const inventado = await avisos.accionCambiarEstado(
      undefined,
      formulario({ avisoId: aviso.id, estado: 'archivado', nota: '' }),
    )
    assert.deepEqual(inventado, { ok: false, mensaje: 'Estado no válido' })
    assert.equal((await leerAviso(aviso.id)).estado, 'asignado')
  })
})

/* ------------------------------------------------------------ Asignación */

describe('asignación', () => {
  function datosAsignacion(avisoId: number, tecnicoId: number | '', fecha = '', hora = '') {
    return formulario({ avisoId, tecnicoId, fechaProgramada: fecha, horaProgramada: hora })
  }

  it('asignar un técnico a un aviso pendiente lo pasa a asignado; quitarlo lo devuelve', async () => {
    const aviso = await nuevoAviso(bd, fichas)
    entrarComo(fichas.usuarios.oficina)

    const asignado = await avisos.asignarAviso(
      undefined,
      datosAsignacion(aviso.id, fichas.tecnicos.marta.id, '2026-10-01', '09:30'),
    )
    assert.deepEqual(asignado, { ok: true })
    const conTecnico = await leerAviso(aviso.id)
    assert.equal(conTecnico.estado, 'asignado')
    assert.equal(conTecnico.tecnicoId, fichas.tecnicos.marta.id)
    assert.equal(conTecnico.fechaProgramada, '2026-10-01')
    assert.equal(conTecnico.horaProgramada, '09:30')

    await avisos.asignarAviso(undefined, datosAsignacion(aviso.id, ''))
    const sinTecnico = await leerAviso(aviso.id)
    assert.equal(sinTecnico.estado, 'pendiente')
    assert.equal(sinTecnico.tecnicoId, null)

    const lineas = await cronologia(aviso.id)
    assert.deepEqual(
      lineas.map((linea) => [linea.estadoAnterior, linea.estadoNuevo, linea.nota]),
      [
        ['pendiente', 'asignado', `Asignado a ${MARTA}`],
        ['asignado', 'pendiente', 'Asignación retirada'],
      ],
    )
  })

  it('cambiar solo el día no deja rastro en la cronología', async () => {
    const aviso = await nuevoAviso(bd, fichas, { estado: 'asignado', tecnicoId: fichas.tecnicos.marta.id })
    entrarComo(fichas.usuarios.oficina)
    await avisos.asignarAviso(undefined, datosAsignacion(aviso.id, fichas.tecnicos.marta.id, '2026-10-02'))
    assert.equal((await leerAviso(aviso.id)).fechaProgramada, '2026-10-02')
    assert.equal((await cronologia(aviso.id)).length, 0)
  })

  it('cambiar de técnico un aviso en curso no cambia su estado', async () => {
    const aviso = await nuevoAviso(bd, fichas, { estado: 'en_curso', tecnicoId: fichas.tecnicos.marta.id })
    entrarComo(fichas.usuarios.oficina)
    await avisos.asignarAviso(undefined, datosAsignacion(aviso.id, fichas.tecnicos.sergio.id))

    const guardado = await leerAviso(aviso.id)
    assert.equal(guardado.estado, 'en_curso')
    assert.equal(guardado.tecnicoId, fichas.tecnicos.sergio.id)
    const [linea] = await cronologia(aviso.id)
    assert.deepEqual([linea.estadoAnterior, linea.estadoNuevo, linea.nota], ['en_curso', 'en_curso', 'Asignado a Sergio Pardo'])
  })

  it('no deja sin técnico un aviso en curso, en espera o finalizado', async () => {
    entrarComo(fichas.usuarios.oficina)
    for (const estado of ['en_curso', 'en_espera', 'finalizado'] as const) {
      const aviso = await nuevoAviso(bd, fichas, { estado, tecnicoId: fichas.tecnicos.marta.id })
      const resultado = await avisos.asignarAviso(undefined, datosAsignacion(aviso.id, ''))
      assert.equal(resultado.ok, false, `ha dejado sin técnico un aviso ${estado}`)
      assert.ok(resultado.errores?.tecnicoId)
      assert.equal((await leerAviso(aviso.id)).tecnicoId, fichas.tecnicos.marta.id)
      assert.equal((await cronologia(aviso.id)).length, 0)
    }
  })

  it('el técnico no asigna avisos', async () => {
    const aviso = await nuevoAviso(bd, fichas, { estado: 'asignado', tecnicoId: fichas.tecnicos.marta.id })
    entrarComo(fichas.usuarios.tecnico)
    assert.deepEqual(
      await avisos.asignarAviso(undefined, datosAsignacion(aviso.id, fichas.tecnicos.sergio.id)),
      SIN_PERMISO,
    )
    assert.equal((await leerAviso(aviso.id)).tecnicoId, fichas.tecnicos.marta.id)
  })
})

/* -------------------------------------------------------------- Borrado */

describe('borrado de avisos', () => {
  it('solo el administrador borra, y el aviso se lleva sus partes y su cronología', async () => {
    const aviso = await nuevoAviso(bd, fichas, { estado: 'en_curso', tecnicoId: fichas.tecnicos.marta.id })
    await bd.insert(esquema.partes).values({
      avisoId: aviso.id,
      tecnicoId: fichas.tecnicos.marta.id,
      fecha: '2026-09-18',
      horas: 1,
      trabajoRealizado: 'Revisión',
    })
    await bd.insert(esquema.movimientos).values({ avisoId: aviso.id, estadoNuevo: 'en_curso' })

    entrarComo(fichas.usuarios.oficina)
    assert.deepEqual(await avisos.eliminarAviso(undefined, formulario({ id: aviso.id })), SIN_PERMISO)
    assert.ok(await leerAviso(aviso.id))

    entrarComo(fichas.usuarios.administrador)
    assert.equal(await redireccion(avisos.eliminarAviso(undefined, formulario({ id: aviso.id }))), '/avisos')
    assert.equal(await leerAviso(aviso.id), undefined)
    assert.equal((await partesDe(aviso.id)).length, 0)
    assert.equal((await cronologia(aviso.id)).length, 0)
  })
})

/* --------------------------------------------------------------- Partes */

describe('partes de trabajo', () => {
  it('un parte sobre un aviso asignado lo pasa a en curso', async () => {
    const aviso = await nuevoAviso(bd, fichas, { estado: 'asignado', tecnicoId: fichas.tecnicos.marta.id })
    entrarComo(fichas.usuarios.oficina)
    assert.equal(await redireccion(partes.crearParte(undefined, datosParte(aviso.id))), `/avisos/${aviso.id}`)

    const [parte] = await partesDe(aviso.id)
    assert.equal(parte.horas, 2.5, 'las horas con coma decimal se leen bien')
    assert.equal(parte.creadoPor, fichas.usuarios.oficina.id)
    assert.equal((await leerAviso(aviso.id)).estado, 'en_curso')

    const [linea] = await cronologia(aviso.id)
    assert.deepEqual(
      [linea.estadoAnterior, linea.estadoNuevo, linea.nota],
      ['asignado', 'en_curso', 'Trabajo iniciado con el parte del 18/09/2026'],
    )
  })

  it('en un aviso pendiente sin técnico, se queda con el técnico del parte', async () => {
    const aviso = await nuevoAviso(bd, fichas)
    entrarComo(fichas.usuarios.oficina)
    await redireccion(partes.crearParte(undefined, datosParte(aviso.id, { tecnicoId: fichas.tecnicos.sergio.id })))
    const guardado = await leerAviso(aviso.id)
    assert.equal(guardado.estado, 'en_curso')
    assert.equal(guardado.tecnicoId, fichas.tecnicos.sergio.id)
  })

  it('un parte resuelto finaliza el aviso con su texto como resumen', async () => {
    const aviso = await nuevoAviso(bd, fichas, {
      estado: 'en_espera',
      tecnicoId: fichas.tecnicos.marta.id,
      motivoEspera: 'Falta la pieza',
    })
    entrarComo(fichas.usuarios.oficina)
    await redireccion(partes.crearParte(undefined, datosParte(aviso.id, { resuelto: 'on' })))

    const guardado = await leerAviso(aviso.id)
    assert.equal(guardado.estado, 'finalizado')
    assert.equal(guardado.resumenCierre, 'Revisado el cuadro eléctrico y cambiado el diferencial')
    assert.equal(guardado.motivoEspera, null)
    assert.ok(guardado.fechaCierre)

    const [linea] = await cronologia(aviso.id)
    assert.deepEqual(
      [linea.estadoAnterior, linea.estadoNuevo, linea.nota],
      ['en_espera', 'finalizado', 'Finalizado con el parte del 18/09/2026'],
    )
  })

  it('un parte más sobre un aviso en curso o ya finalizado no cambia su estado', async () => {
    entrarComo(fichas.usuarios.oficina)

    const enCurso = await nuevoAviso(bd, fichas, { estado: 'en_curso', tecnicoId: fichas.tecnicos.marta.id })
    await redireccion(partes.crearParte(undefined, datosParte(enCurso.id)))
    assert.equal((await leerAviso(enCurso.id)).estado, 'en_curso')
    assert.equal((await cronologia(enCurso.id)).length, 0)

    const cerrado = await nuevoAviso(bd, fichas, {
      estado: 'finalizado',
      tecnicoId: fichas.tecnicos.marta.id,
      resumenCierre: 'Resumen original',
      fechaCierre: new Date(),
    })
    await redireccion(partes.crearParte(undefined, datosParte(cerrado.id, { resuelto: 'on' })))
    assert.equal((await leerAviso(cerrado.id)).resumenCierre, 'Resumen original')
    assert.equal((await cronologia(cerrado.id)).length, 0)
  })

  it('el técnico firma sus partes aunque el formulario traiga otro técnico', async () => {
    const aviso = await nuevoAviso(bd, fichas, { estado: 'asignado', tecnicoId: fichas.tecnicos.marta.id })
    entrarComo(fichas.usuarios.tecnico)
    await redireccion(partes.crearParte(undefined, datosParte(aviso.id, { tecnicoId: fichas.tecnicos.sergio.id })))
    const [parte] = await partesDe(aviso.id)
    assert.equal(parte.tecnicoId, fichas.tecnicos.marta.id)
    assert.equal(parte.creadoPor, fichas.usuarios.tecnico.id)
  })

  it('el técnico no anota partes en avisos ajenos ni cerrados', async () => {
    const ajeno = await nuevoAviso(bd, fichas, { estado: 'asignado', tecnicoId: fichas.tecnicos.sergio.id })
    const cerrado = await nuevoAviso(bd, fichas, {
      estado: 'finalizado',
      tecnicoId: fichas.tecnicos.marta.id,
      resumenCierre: 'Hecho',
      fechaCierre: new Date(),
    })
    entrarComo(fichas.usuarios.tecnico)
    assert.deepEqual(await partes.crearParte(undefined, datosParte(ajeno.id)), SIN_PERMISO)
    assert.deepEqual(await partes.crearParte(undefined, datosParte(cerrado.id)), SIN_PERMISO)
    assert.equal((await partesDe(ajeno.id)).length + (await partesDe(cerrado.id)).length, 0)
  })

  it('un parte que no pasa la validación no mueve el aviso', async () => {
    const aviso = await nuevoAviso(bd, fichas, { estado: 'asignado', tecnicoId: fichas.tecnicos.marta.id })
    entrarComo(fichas.usuarios.oficina)
    const resultado = await partes.crearParte(undefined, datosParte(aviso.id, { horas: '0' }))
    assert.equal(resultado.ok, false)
    assert.ok(resultado.errores?.horas)
    assert.equal((await partesDe(aviso.id)).length, 0)
    assert.equal((await leerAviso(aviso.id)).estado, 'asignado')
  })

  it('el técnico corrige y borra solo sus partes, y solo con el aviso abierto', async () => {
    const aviso = await nuevoAviso(bd, fichas, { estado: 'en_curso', tecnicoId: fichas.tecnicos.marta.id })
    const [suyo, deSergio] = await bd
      .insert(esquema.partes)
      .values([
        { avisoId: aviso.id, tecnicoId: fichas.tecnicos.marta.id, fecha: '2026-09-17', horas: 1, trabajoRealizado: 'Diagnóstico' },
        { avisoId: aviso.id, tecnicoId: fichas.tecnicos.sergio.id, fecha: '2026-09-17', horas: 1, trabajoRealizado: 'Apoyo' },
      ])
      .returning()
    const correccion = (parteId: number) => datosParte(aviso.id, { id: parteId, horas: '3' })

    entrarComo(fichas.usuarios.tecnico)
    assert.deepEqual(await partes.actualizarParte(undefined, correccion(deSergio.id)), SIN_PERMISO)
    assert.deepEqual(await partes.eliminarParte(undefined, formulario({ id: deSergio.id })), SIN_PERMISO)
    assert.equal(await redireccion(partes.actualizarParte(undefined, correccion(suyo.id))), `/avisos/${aviso.id}`)

    const horas = async (id: number) =>
      (await bd.select().from(esquema.partes).where(eq(esquema.partes.id, id)))[0]?.horas
    assert.equal(await horas(suyo.id), 3)
    assert.equal(await horas(deSergio.id), 1)

    // Con el aviso cerrado, el parte ya es historia.
    await bd.update(esquema.avisos).set({ estado: 'finalizado', resumenCierre: 'Hecho' }).where(eq(esquema.avisos.id, aviso.id))
    assert.deepEqual(await partes.actualizarParte(undefined, correccion(suyo.id)), SIN_PERMISO)
    assert.deepEqual(await partes.eliminarParte(undefined, formulario({ id: suyo.id })), SIN_PERMISO)

    // La oficina sí puede, en cualquier parte.
    entrarComo(fichas.usuarios.oficina)
    await redireccion(partes.eliminarParte(undefined, formulario({ id: deSergio.id })))
    assert.equal(await horas(deSergio.id), undefined)
  })
})

/* ----------------------------------------------------------- Atomicidad */

describe('cronología y cambio, juntos o ninguno', () => {
  it('si la cronología no se puede escribir, el cambio tampoco se guarda', async () => {
    const aviso = await nuevoAviso(bd, fichas, { estado: 'asignado', tecnicoId: fichas.tecnicos.marta.id })
    const avisosAntes = await numeroDeAvisos()

    // Un disparador que hace fallar cualquier línea nueva de la cronología.
    await bd.execute(sql`
      create function cronologia_rota() returns trigger language plpgsql
      as $$ begin raise exception 'cronología rota'; end $$
    `)
    await bd.execute(sql`
      create trigger cronologia_rota before insert on movimientos
      for each row execute function cronologia_rota()
    `)

    try {
      entrarComo(fichas.usuarios.oficina)
      await assert.rejects(avisos.cambiarEstado(aviso.id, 'en_espera', 'Falta material'))
      await assert.rejects(avisos.asignarAviso(undefined, formulario({ avisoId: aviso.id, tecnicoId: fichas.tecnicos.sergio.id })))
      await assert.rejects(partes.crearParte(undefined, datosParte(aviso.id)))
      await assert.rejects(avisos.crearAviso(undefined, datosAviso()))

      const guardado = await leerAviso(aviso.id)
      assert.equal(guardado.estado, 'asignado')
      assert.equal(guardado.motivoEspera, null)
      assert.equal(guardado.tecnicoId, fichas.tecnicos.marta.id)
      assert.equal((await partesDe(aviso.id)).length, 0, 'el parte se ha guardado sin su cambio de estado')
      assert.equal(await numeroDeAvisos(), avisosAntes, 'el aviso se ha dado de alta sin cronología')
    } finally {
      await bd.execute(sql`drop trigger cronologia_rota on movimientos`)
      await bd.execute(sql`drop function cronologia_rota()`)
    }
  })
})

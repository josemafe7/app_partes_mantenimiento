/**
 * Pruebas de las acciones de clientes, locales y técnicos, y de la carga de
 * los datos de ejemplo: el borrado protegido (lo que tiene historial no se
 * borra), el archivado y quién puede hacer cada cosa.
 *
 * Aquí un fallo es pérdida de datos: un borrado que se lleva el historial de
 * un cliente o una carga de ejemplos que vacía una base con datos de verdad.
 */

import assert from 'node:assert/strict'
import { before, beforeEach, describe, it } from 'node:test'

import { eq, sql } from 'drizzle-orm'

import * as esquema from '../src/db/esquema'
import { SIN_PERMISO } from '../src/lib/acciones'
import { crearFichas, nuevoAviso, usarBaseEnMemoria, type BaseDePruebas, type Fichas } from './ayudas/base'
import { entrarComo, formulario, redireccion, reiniciar, sustituirServidor } from './ayudas/servidor'

let bd: BaseDePruebas
let fichas: Fichas
let clientes: typeof import('../src/acciones/clientes')
let locales: typeof import('../src/acciones/locales')
let tecnicos: typeof import('../src/acciones/tecnicos')
let datos: typeof import('../src/acciones/datos')
let consultasClientes: typeof import('../src/db/consultas/clientes')
let consultasTecnicos: typeof import('../src/db/consultas/tecnicos')

before(async () => {
  bd = await usarBaseEnMemoria()
  sustituirServidor(bd)
  fichas = await crearFichas(bd)
  clientes = await import('../src/acciones/clientes')
  locales = await import('../src/acciones/locales')
  tecnicos = await import('../src/acciones/tecnicos')
  datos = await import('../src/acciones/datos')
  consultasClientes = await import('../src/db/consultas/clientes')
  consultasTecnicos = await import('../src/db/consultas/tecnicos')
})

beforeEach(() => reiniciar())

/* ---------------------------------------------------------------- Ayudas */

type Tabla = 'clientes' | 'locales' | 'tecnicos'

async function existe(tabla: Tabla, id: number): Promise<boolean> {
  const { rows } = await bd.execute(sql`select 1 from ${sql.identifier(tabla)} where id = ${id}`)
  return rows.length > 0
}

async function contar(tabla: Tabla): Promise<number> {
  const { rows } = await bd.execute<{ total: number }>(sql`select count(*)::int as total from ${sql.identifier(tabla)}`)
  return rows[0].total
}

/** Un cliente nuevo con los locales que se pidan, escrito directamente en la base. */
async function clienteConLocales(nombre: string, numLocales: number) {
  const [cliente] = await bd.insert(esquema.clientes).values({ nombre }).returning()
  const filas = await bd
    .insert(esquema.locales)
    .values(
      Array.from({ length: numLocales }, (_, i) => ({
        clienteId: cliente.id,
        nombre: `${nombre} — local ${i + 1}`,
        direccion: `Calle Falsa ${i + 1}`,
        ciudad: 'Madrid',
      })),
    )
    .returning()
  return { cliente, locales: filas }
}

async function tecnicoNuevo(nombre: string) {
  const [tecnico] = await bd.insert(esquema.tecnicos).values({ nombre, especialidades: ['pintura'] }).returning()
  return tecnico
}

function datosCliente(cambios: Record<string, string | number> = {}) {
  return formulario({
    nombre: 'Heladerías Polo Norte',
    cif: '',
    personaContacto: '',
    telefono: '',
    email: '',
    direccionFacturacion: '',
    notas: '',
    ...cambios,
  })
}

function datosLocal(clienteId: number, cambios: Record<string, string | number> = {}) {
  return formulario({
    clienteId,
    nombre: 'Polo Norte — Retiro',
    direccion: 'Calle de Alcalá 120',
    ciudad: 'Madrid',
    ...cambios,
  })
}

function datosTecnico(cambios: Record<string, string | number | string[]> = {}) {
  return formulario({
    nombre: 'Luis',
    apellidos: 'Gómez',
    telefono: '',
    email: '',
    especialidades: ['fontaneria', 'climatizacion'],
    zona: 'Norte',
    notas: '',
    ...cambios,
  })
}

/** Da de alta una ficha con la acción y devuelve su id (sale de la redirección). */
async function idCreado(accion: Promise<unknown>, ruta: string): Promise<number> {
  const destino = await redireccion(accion)
  const encontrado = new RegExp(`^/${ruta}/(\\d+)$`).exec(destino)
  assert.ok(encontrado, `redirige a ${destino}`)
  return Number(encontrado[1])
}

/* ------------------------------------------------------ Borrado protegido */

describe('borrado protegido', () => {
  it('un cliente con locales o avisos no se borra; sin nada, sí', async () => {
    const { cliente, locales: [local] } = await clienteConLocales('Con historial', 2)
    await nuevoAviso(bd, fichas, { clienteId: cliente.id, localId: local.id })
    const { cliente: soloLocal } = await clienteConLocales('Solo con local', 1)
    entrarComo(fichas.usuarios.administrador)

    const conHistorial = await clientes.eliminarCliente(undefined, formulario({ id: cliente.id }))
    assert.equal(conHistorial.ok, false)
    assert.match(conHistorial.mensaje ?? '', /tiene 2 locales y 1 aviso\. Archívalo/)
    const conLocal = await clientes.eliminarCliente(undefined, formulario({ id: soloLocal.id }))
    assert.match(conLocal.mensaje ?? '', /tiene 1 local\. Archívalo/)
    assert.ok(await existe('clientes', cliente.id))
    assert.ok(await existe('clientes', soloLocal.id))

    const id = await idCreado(clientes.crearCliente(undefined, datosCliente()), 'clientes')
    assert.equal(await redireccion(clientes.eliminarCliente(undefined, formulario({ id }))), '/clientes')
    assert.ok(!(await existe('clientes', id)))
  })

  it('un local con avisos no se borra; sin avisos, sí, y se vuelve a su cliente', async () => {
    const { cliente, locales: [conAvisos, libre] } = await clienteConLocales('Dos locales', 2)
    await nuevoAviso(bd, fichas, { clienteId: cliente.id, localId: conAvisos.id })
    entrarComo(fichas.usuarios.administrador)

    const resultado = await locales.eliminarLocal(undefined, formulario({ id: conAvisos.id }))
    assert.equal(resultado.ok, false)
    assert.match(resultado.mensaje ?? '', /tiene 1 aviso en el historial/)
    assert.ok(await existe('locales', conAvisos.id))

    assert.equal(await redireccion(locales.eliminarLocal(undefined, formulario({ id: libre.id }))), `/clientes/${cliente.id}`)
    assert.ok(!(await existe('locales', libre.id)))
  })

  it('un técnico con avisos o partes no se borra; sin nada, sí', async () => {
    const conAviso = await tecnicoNuevo('Con aviso')
    const conParte = await tecnicoNuevo('Con parte')
    const aviso = await nuevoAviso(bd, fichas, { estado: 'en_curso', tecnicoId: conAviso.id })
    // Sin avisos asignados, pero con un parte en el aviso de otro.
    await bd.insert(esquema.partes).values({
      avisoId: aviso.id,
      tecnicoId: conParte.id,
      fecha: '2026-09-18',
      horas: 1,
      trabajoRealizado: 'Apoyo',
    })
    entrarComo(fichas.usuarios.administrador)

    const primero = await tecnicos.eliminarTecnico(undefined, formulario({ id: conAviso.id }))
    assert.match(primero.mensaje ?? '', /tiene 1 aviso asignado\. Archívalo/)
    const segundo = await tecnicos.eliminarTecnico(undefined, formulario({ id: conParte.id }))
    assert.match(segundo.mensaje ?? '', /tiene 1 parte de trabajo\. Archívalo/)
    assert.ok(await existe('tecnicos', conAviso.id))
    assert.ok(await existe('tecnicos', conParte.id))

    const id = await idCreado(tecnicos.crearTecnico(undefined, datosTecnico()), 'tecnicos')
    assert.equal(await redireccion(tecnicos.eliminarTecnico(undefined, formulario({ id }))), '/tecnicos')
    assert.ok(!(await existe('tecnicos', id)))
  })

  it('borrar es del administrador: la oficina no borra nada, ni lo que no tiene historial', async () => {
    entrarComo(fichas.usuarios.administrador)
    const cliente = await idCreado(clientes.crearCliente(undefined, datosCliente({ nombre: 'Sin historial' })), 'clientes')
    const tecnico = await idCreado(tecnicos.crearTecnico(undefined, datosTecnico()), 'tecnicos')
    await redireccion(locales.crearLocal(undefined, datosLocal(cliente)))
    const [local] = await bd.select().from(esquema.locales).where(eq(esquema.locales.clienteId, cliente))

    entrarComo(fichas.usuarios.oficina)
    assert.deepEqual(await locales.eliminarLocal(undefined, formulario({ id: local.id })), SIN_PERMISO)
    assert.deepEqual(await clientes.eliminarCliente(undefined, formulario({ id: cliente })), SIN_PERMISO)
    assert.deepEqual(await tecnicos.eliminarTecnico(undefined, formulario({ id: tecnico })), SIN_PERMISO)
    assert.ok(await existe('locales', local.id))
    assert.ok(await existe('clientes', cliente))
    assert.ok(await existe('tecnicos', tecnico))
  })
})

/* ------------------------------------------------------------- Archivado */

describe('archivado', () => {
  it('un cliente o un local archivado sale de los desplegables, y vuelve al desarchivarlo', async () => {
    const { grano } = fichas.clientes
    const { granoSol } = fichas.locales
    entrarComo(fichas.usuarios.oficina)

    await clientes.alternarArchivadoCliente(formulario({ id: grano.id }))
    await locales.alternarArchivadoLocal(formulario({ id: granoSol.id }))
    const idsClientes = (await consultasClientes.clientesParaSelector()).map((cliente) => cliente.id)
    const idsLocales = (await consultasClientes.localesParaSelector()).map((local) => local.id)
    assert.ok(!idsClientes.includes(grano.id), 'el cliente archivado sigue en el desplegable')
    assert.ok(!idsLocales.includes(granoSol.id), 'el local archivado sigue en el desplegable')
    assert.ok(await existe('clientes', grano.id), 'archivar no borra')

    await clientes.alternarArchivadoCliente(formulario({ id: grano.id }))
    await locales.alternarArchivadoLocal(formulario({ id: granoSol.id }))
    assert.ok((await consultasClientes.clientesParaSelector()).some((cliente) => cliente.id === grano.id))
    assert.ok((await consultasClientes.localesParaSelector()).some((local) => local.id === granoSol.id))
  })

  it('archivar un técnico es del administrador, y lo quita de los desplegables', async () => {
    const { sergio } = fichas.tecnicos
    const disponible = async () =>
      (await consultasTecnicos.tecnicosParaSelector()).some((tecnico) => tecnico.id === sergio.id)

    entrarComo(fichas.usuarios.oficina)
    await tecnicos.alternarArchivadoTecnico(formulario({ id: sergio.id }))
    assert.ok(await disponible(), 'la oficina ha archivado un técnico')

    entrarComo(fichas.usuarios.administrador)
    await tecnicos.alternarArchivadoTecnico(formulario({ id: sergio.id }))
    assert.ok(!(await disponible()))
    await tecnicos.alternarArchivadoTecnico(formulario({ id: sergio.id }))
    assert.ok(await disponible())
  })

  it('un técnico no archiva clientes ni locales', async () => {
    entrarComo(fichas.usuarios.tecnico)
    await clientes.alternarArchivadoCliente(formulario({ id: fichas.clientes.grano.id }))
    await locales.alternarArchivadoLocal(formulario({ id: fichas.locales.granoSol.id }))
    assert.ok((await consultasClientes.clientesParaSelector()).some((cliente) => cliente.id === fichas.clientes.grano.id))
    assert.ok((await consultasClientes.localesParaSelector()).some((local) => local.id === fichas.locales.granoSol.id))
  })
})

/* ------------------------------------------------------ Altas y cambios */

describe('altas y cambios', () => {
  it('la oficina corrige las fichas de los técnicos, pero darlos de alta es del administrador', async () => {
    const antes = await contar('tecnicos')
    entrarComo(fichas.usuarios.oficina)
    assert.deepEqual(await tecnicos.crearTecnico(undefined, datosTecnico()), SIN_PERMISO)
    assert.equal(await contar('tecnicos'), antes)

    const { marta } = fichas.tecnicos
    const destino = await redireccion(
      tecnicos.actualizarTecnico(
        undefined,
        datosTecnico({ id: marta.id, nombre: 'Marta', apellidos: 'Ruiz Alcántara', especialidades: ['electricidad', 'multiservicio'] }),
      ),
    )
    assert.equal(destino, `/tecnicos/${marta.id}`)
    const [guardada] = await bd.select().from(esquema.tecnicos).where(eq(esquema.tecnicos.id, marta.id))
    assert.deepEqual(guardada.especialidades, ['electricidad', 'multiservicio'])
  })

  it('un alta con errores devuelve lo escrito, también las casillas marcadas', async () => {
    entrarComo(fichas.usuarios.administrador)
    const resultado = await tecnicos.crearTecnico(undefined, datosTecnico({ nombre: '' }))
    assert.equal(resultado.ok, false)
    assert.ok(resultado.errores?.nombre)
    assert.deepEqual(resultado.valores?.especialidades, ['fontaneria', 'climatizacion'])
  })

  it('un técnico no da de alta clientes ni locales', async () => {
    const antes = await contar('clientes')
    entrarComo(fichas.usuarios.tecnico)
    assert.deepEqual(await clientes.crearCliente(undefined, datosCliente()), SIN_PERMISO)
    assert.deepEqual(await locales.crearLocal(undefined, datosLocal(fichas.clientes.horno.id)), SIN_PERMISO)
    assert.deepEqual(
      await clientes.actualizarCliente(undefined, datosCliente({ id: fichas.clientes.horno.id, nombre: 'Otro' })),
      SIN_PERMISO,
    )
    assert.equal(await contar('clientes'), antes)
  })
})

/* ----------------------------------------------------- Datos de ejemplo */

describe('datos de ejemplo', () => {
  it('no se cargan sobre una base con datos, y solo los carga el administrador', async () => {
    const antes = await contar('clientes')
    entrarComo(fichas.usuarios.oficina)
    assert.deepEqual(await datos.cargarDatosEjemplo(), SIN_PERMISO)

    entrarComo(fichas.usuarios.administrador)
    assert.deepEqual(await datos.cargarDatosEjemplo(), {
      ok: false,
      mensaje: 'La base ya tiene datos: los de ejemplo solo se cargan en una vacía.',
    })
    assert.equal(await contar('clientes'), antes, 'se ha llevado por delante los clientes')
  })

  it('en una base vacía, el administrador los carga', async () => {
    await bd.delete(esquema.avisos)
    await bd.delete(esquema.locales)
    await bd.delete(esquema.clientes)

    entrarComo(fichas.usuarios.administrador)
    const resultado = await datos.cargarDatosEjemplo()
    assert.equal(resultado.ok, true)
    assert.match(resultado.mensaje ?? '', /^Cargados \d+ clientes, \d+ locales, \d+ técnicos, \d+ avisos y \d+ partes/)
    assert.ok((await contar('clientes')) > 0)
  })
})

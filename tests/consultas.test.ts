/**
 * Pruebas de las consultas contra los datos de ejemplo.
 *
 * Los contadores de clientes, técnicos y avisos se calculan con subconsultas
 * correlacionadas, y ahí es fácil que la correlación se rompa en silencio y
 * todos los números salgan a cero sin que nada falle. Estas pruebas comparan
 * cada número con el mismo cálculo hecho en JavaScript sobre las filas en
 * bruto: si la correlación se rompe, dejan de cuadrar.
 *
 * No tocan Supabase: trabajan sobre un Postgres en memoria (PGlite) al que se
 * le aplican las mismas migraciones de `supabase/migrations/`, así que de paso
 * comprueban que las migraciones se aplican de principio a fin.
 */

import assert from 'node:assert/strict'
import { before, describe, it } from 'node:test'

import { sql } from 'drizzle-orm'

import { usarBaseEnMemoria } from './ayudas/base'

type Modulos = {
  listarClientes: typeof import('../src/db/consultas/clientes')['listarClientes']
  localesDeCliente: typeof import('../src/db/consultas/clientes')['localesDeCliente']
  listarTecnicos: typeof import('../src/db/consultas/tecnicos')['listarTecnicos']
  listarAvisos: typeof import('../src/db/consultas/avisos')['listarAvisos']
  avisosProgramados: typeof import('../src/db/consultas/avisos')['avisosProgramados']
  avisosSinProgramar: typeof import('../src/db/consultas/avisos')['avisosSinProgramar']
  siguienteReferencia: typeof import('../src/db/consultas/avisos')['siguienteReferencia']
  cargaPorTecnico: typeof import('../src/db/consultas/panel')['cargaPorTecnico']
  contadoresPanel: typeof import('../src/db/consultas/panel')['contadoresPanel']
  resumenHoras: typeof import('../src/db/consultas/panel')['resumenHoras']
  lunesDe: typeof import('../src/lib/fechas')['lunesDe']
  bd: typeof import('../src/db/cliente')['bd']
  esquema: typeof import('../src/db/esquema')
  sembrar: typeof import('../src/db/semilla')['sembrar']
  FILTROS_VACIOS: typeof import('../src/lib/filtros')['FILTROS_VACIOS']
  hoyISO: typeof import('../src/lib/fechas')['hoyISO']
  sumarDias: typeof import('../src/lib/fechas')['sumarDias']
}

let m: Modulos

/** Las filas en bruto, para calcular lo esperado sin usar las consultas. */
let todosLosAvisos: Awaited<ReturnType<typeof obtenerAvisosBrutos>>
let todosLosPartes: Awaited<ReturnType<typeof obtenerPartesBrutos>>

async function obtenerAvisosBrutos() {
  return m.bd.select().from(m.esquema.avisos)
}

async function obtenerPartesBrutos() {
  return m.bd.select().from(m.esquema.partes)
}

function estaAbierto(estado: string): boolean {
  return estado !== 'finalizado' && estado !== 'cancelado'
}

before(async () => {
  const esquema = await import('../src/db/esquema')

  // La base en memoria tiene que estar puesta antes de importar nada que la use.
  await usarBaseEnMemoria()

  const [clientes, tecnicos, avisos, panel, cliente, filtros, fechas, semilla] = await Promise.all([
    import('../src/db/consultas/clientes'),
    import('../src/db/consultas/tecnicos'),
    import('../src/db/consultas/avisos'),
    import('../src/db/consultas/panel'),
    import('../src/db/cliente'),
    import('../src/lib/filtros'),
    import('../src/lib/fechas'),
    import('../src/db/semilla'),
  ])

  m = {
    listarClientes: clientes.listarClientes,
    localesDeCliente: clientes.localesDeCliente,
    listarTecnicos: tecnicos.listarTecnicos,
    listarAvisos: avisos.listarAvisos,
    avisosProgramados: avisos.avisosProgramados,
    avisosSinProgramar: avisos.avisosSinProgramar,
    siguienteReferencia: avisos.siguienteReferencia,
    cargaPorTecnico: panel.cargaPorTecnico,
    contadoresPanel: panel.contadoresPanel,
    resumenHoras: panel.resumenHoras,
    lunesDe: fechas.lunesDe,
    bd: cliente.bd,
    esquema,
    sembrar: semilla.sembrar,
    FILTROS_VACIOS: filtros.FILTROS_VACIOS,
    hoyISO: fechas.hoyISO,
    sumarDias: fechas.sumarDias,
  }

  await m.sembrar({ limpiar: true })
  todosLosAvisos = await obtenerAvisosBrutos()
  todosLosPartes = await obtenerPartesBrutos()
})

describe('datos de ejemplo', () => {
  it('carga avisos, partes y todos los estados', () => {
    assert.ok(todosLosAvisos.length >= 30, 'se esperaban unos 40 avisos')
    assert.ok(todosLosPartes.length >= 15, 'se esperaban unos 20 partes')

    const estados = new Set(todosLosAvisos.map((aviso) => aviso.estado))
    for (const estado of ['pendiente', 'asignado', 'en_curso', 'en_espera', 'finalizado', 'cancelado']) {
      assert.ok(estados.has(estado as never), `falta algún aviso en estado ${estado}`)
    }
  })

  it('deja trabajo para hoy, retrasado y sin asignar', async () => {
    const hoy = m.hoyISO()
    const abiertos = todosLosAvisos.filter((aviso) => estaAbierto(aviso.estado))

    assert.ok(
      abiertos.some((aviso) => aviso.fechaProgramada === hoy),
      'el panel de hoy saldría vacío',
    )
    assert.ok(
      abiertos.some((aviso) => aviso.fechaProgramada !== null && aviso.fechaProgramada < hoy),
      'el contador de retrasados saldría vacío',
    )
    assert.ok(
      abiertos.some((aviso) => aviso.tecnicoId === null),
      'no hay ningún aviso sin asignar',
    )
  })
})

describe('contadores de clientes', () => {
  it('los avisos abiertos y totales de cada cliente cuadran', async () => {
    const clientes = await m.listarClientes({ incluirArchivados: true })
    assert.ok(clientes.length > 0)

    for (const fila of clientes) {
      const suyos = todosLosAvisos.filter((aviso) => aviso.clienteId === fila.id)
      assert.equal(fila.numAvisos, suyos.length, `total de avisos de ${fila.nombre}`)
      assert.equal(
        fila.numAvisosAbiertos,
        suyos.filter((aviso) => estaAbierto(aviso.estado)).length,
        `avisos abiertos de ${fila.nombre}`,
      )
    }

    // Si la correlación se rompiera, todos estos números serían cero.
    assert.ok(
      clientes.some((fila) => fila.numAvisosAbiertos > 0),
      'ningún cliente tiene avisos abiertos: la subconsulta no está correlacionando',
    )
  })

  it('los avisos abiertos de cada local cuadran', async () => {
    const locales = await m.localesDeCliente(1, true)
    assert.ok(locales.length > 0)

    for (const local of locales) {
      const suyos = todosLosAvisos.filter(
        (aviso) => aviso.localId === local.id && estaAbierto(aviso.estado),
      )
      assert.equal(local.numAvisosAbiertos, suyos.length, `avisos abiertos de ${local.nombre}`)
    }
  })
})

describe('contadores de técnicos', () => {
  it('los avisos abiertos y las horas del último mes cuadran', async () => {
    const tecnicos = await m.listarTecnicos({ incluirArchivados: true })
    const hoy = m.hoyISO()
    const desde = m.sumarDias(hoy, -30)

    for (const fila of tecnicos) {
      const suyos = todosLosAvisos.filter((aviso) => aviso.tecnicoId === fila.id)
      assert.equal(
        fila.numAvisosAbiertos,
        suyos.filter((aviso) => estaAbierto(aviso.estado)).length,
        `avisos abiertos de ${fila.nombre}`,
      )
      assert.equal(
        fila.avisosHoy,
        suyos.filter((aviso) => aviso.fechaProgramada === hoy && estaAbierto(aviso.estado)).length,
        `avisos de hoy de ${fila.nombre}`,
      )

      const horas = todosLosPartes
        .filter((parte) => parte.tecnicoId === fila.id && parte.fecha >= desde)
        .reduce((total, parte) => total + parte.horas, 0)
      assert.ok(
        Math.abs(fila.horasUltimoMes - horas) < 0.001,
        `horas del último mes de ${fila.nombre}: ${fila.horasUltimoMes} en lugar de ${horas}`,
      )
    }

    assert.ok(
      tecnicos.some((fila) => fila.numAvisosAbiertos > 0),
      'ningún técnico tiene avisos abiertos: la subconsulta no está correlacionando',
    )
    assert.ok(
      tecnicos.some((fila) => fila.horasUltimoMes > 0),
      'ningún técnico tiene horas: la subconsulta no está correlacionando',
    )
  })

  it('la carga del panel coincide con el listado de técnicos', async () => {
    const [carga, tecnicos] = await Promise.all([m.cargaPorTecnico(), m.listarTecnicos()])

    for (const fila of carga) {
      const enListado = tecnicos.find((tecnico) => tecnico.id === fila.id)
      assert.ok(enListado, `el técnico ${fila.nombre} no está en el listado`)
      assert.equal(fila.abiertos, enListado.numAvisosAbiertos, `abiertos de ${fila.nombre}`)
    }
  })
})

describe('listado de avisos', () => {
  it('el número de partes y las horas de cada aviso cuadran', async () => {
    const avisos = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'todos' })
    assert.equal(avisos.length, todosLosAvisos.length)

    for (const fila of avisos) {
      const suyos = todosLosPartes.filter((parte) => parte.avisoId === fila.id)
      assert.equal(fila.numPartes, suyos.length, `partes de ${fila.referencia}`)
      const horas = suyos.reduce((total, parte) => total + parte.horas, 0)
      assert.ok(
        Math.abs(fila.horasTotales - horas) < 0.001,
        `horas de ${fila.referencia}: ${fila.horasTotales} en lugar de ${horas}`,
      )
    }

    assert.ok(
      avisos.some((fila) => fila.numPartes > 0),
      'ningún aviso tiene partes: la subconsulta no está correlacionando',
    )
  })

  it('cada atajo filtra lo que promete', async () => {
    const hoy = m.hoyISO()

    const paraHoy = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'hoy' })
    for (const aviso of paraHoy) {
      assert.equal(aviso.fechaProgramada, hoy)
      assert.ok(estaAbierto(aviso.estado))
    }

    const retrasados = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'retrasados' })
    for (const aviso of retrasados) {
      assert.ok(aviso.fechaProgramada !== null && aviso.fechaProgramada < hoy)
      assert.ok(estaAbierto(aviso.estado))
    }

    const sinAsignar = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'sin_asignar' })
    for (const aviso of sinAsignar) {
      assert.equal(aviso.tecnicoId, null)
      assert.ok(estaAbierto(aviso.estado))
    }

    const urgentes = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'urgentes' })
    for (const aviso of urgentes) {
      assert.ok(aviso.prioridad === 'alta' || aviso.prioridad === 'urgente')
    }

    assert.ok(paraHoy.length > 0 && retrasados.length > 0 && sinAsignar.length > 0)
  })

  it('la búsqueda encuentra sin acentos y sin distinguir mayúsculas', async () => {
    const conTilde = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'todos', q: 'cámara' })
    const sinTilde = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'todos', q: 'CAMARA' })
    assert.ok(conTilde.length > 0, 'la búsqueda con tilde no encuentra nada')
    assert.deepEqual(
      sinTilde.map((aviso) => aviso.id),
      conTilde.map((aviso) => aviso.id),
    )
  })

  it('busca también por referencia, cliente y técnico', async () => {
    const primero = todosLosAvisos[0]
    const porReferencia = await m.listarAvisos({
      ...m.FILTROS_VACIOS,
      vista: 'todos',
      q: primero.referencia,
    })
    assert.ok(porReferencia.some((aviso) => aviso.id === primero.id))

    const porCliente = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'todos', q: 'Frescal' })
    assert.ok(porCliente.length > 0)
    for (const aviso of porCliente) {
      const coincide =
        aviso.clienteNombre.includes('Frescal') || aviso.localNombre.includes('Frescal')
      assert.ok(coincide, `${aviso.referencia} no tiene nada que ver con «Frescal»`)
    }
  })

  it('los contadores del panel coinciden con los listados', async () => {
    const contadores = await m.contadoresPanel()

    const abiertos = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'abiertos' })
    const paraHoy = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'hoy' })
    const retrasados = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'retrasados' })
    const sinAsignar = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'sin_asignar' })
    const urgentes = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'urgentes' })
    const enEspera = await m.listarAvisos({ ...m.FILTROS_VACIOS, estado: 'en_espera' })

    assert.equal(contadores.abiertos, abiertos.length, 'sin cerrar')
    assert.equal(contadores.paraHoy, paraHoy.length, 'para hoy')
    assert.equal(contadores.retrasados, retrasados.length, 'retrasados')
    assert.equal(contadores.sinAsignar, sinAsignar.length, 'sin asignar')
    assert.equal(contadores.urgentes, urgentes.length, 'urgentes')
    assert.equal(contadores.enEspera, enEspera.length, 'en espera')
  })
})

describe('horas del panel', () => {
  it('las semanas del gráfico y los 30 días cuadran con los partes', async () => {
    const { semanas, ultimos30, anteriores30 } = await m.resumenHoras(8)
    const hoy = m.hoyISO()

    assert.equal(semanas.length, 8)
    assert.equal(semanas[7].lunes, m.lunesDe(hoy), 'la última barra es la semana actual')

    for (const semana of semanas) {
      const domingo = m.sumarDias(semana.lunes, 6)
      const suyos = todosLosPartes.filter(
        (parte) => parte.fecha >= semana.lunes && parte.fecha <= domingo && parte.fecha <= hoy,
      )
      const horas = suyos.reduce((total, parte) => total + parte.horas, 0)
      assert.ok(Math.abs(semana.horas - horas) < 0.001, `horas de la semana del ${semana.lunes}`)
      assert.equal(semana.partes, suyos.length, `partes de la semana del ${semana.lunes}`)
    }

    const sumaEntre = (desde: string, hasta: string) =>
      todosLosPartes
        .filter((parte) => parte.fecha >= desde && parte.fecha <= hasta)
        .reduce((total, parte) => total + parte.horas, 0)

    assert.ok(Math.abs(ultimos30 - sumaEntre(m.sumarDias(hoy, -29), hoy)) < 0.001, 'últimos 30 días')
    assert.ok(
      Math.abs(anteriores30 - sumaEntre(m.sumarDias(hoy, -59), m.sumarDias(hoy, -30))) < 0.001,
      '30 días anteriores',
    )
    assert.ok(semanas.some((semana) => semana.horas > 0), 'el gráfico saldría vacío')
  })
})

describe('cronología y numeración', () => {
  it('cada aviso tiene su cronología, que empieza al recibirlo', async () => {
    const todos = await m.bd.select().from(m.esquema.movimientos)
    for (const aviso of todosLosAvisos) {
      const suyos = todos
        .filter((movimiento) => movimiento.avisoId === aviso.id)
        .sort((a, b) => a.fecha.getTime() - b.fecha.getTime() || a.id - b.id)
      assert.ok(suyos.length > 0, `${aviso.referencia} no tiene cronología`)
      assert.equal(suyos[0].estadoAnterior, null, `${aviso.referencia} no empieza por la entrada`)
      assert.equal(suyos.at(-1)?.estadoNuevo, aviso.estado, `${aviso.referencia} no acaba en su estado`)
    }
  })

  it('la siguiente referencia continúa la numeración del año', async () => {
    const anio = new Date().getFullYear()
    const siguiente = await m.bd.transaction((tx) => m.siguienteReferencia(tx))
    const esperado = `AV-${anio}-${String(todosLosAvisos.length + 1).padStart(4, '0')}`
    assert.equal(siguiente, esperado)
  })

  it('volver a cargar los ejemplos reinicia los ids', async () => {
    await m.sembrar({ limpiar: true })
    const recargados = await obtenerAvisosBrutos()
    assert.deepEqual(
      recargados.map((aviso) => [aviso.id, aviso.referencia]).sort(),
      todosLosAvisos.map((aviso) => [aviso.id, aviso.referencia]).sort(),
    )
  })
})

describe('lo que ve un técnico', () => {
  function tecnicoConAvisos(): number {
    const id = todosLosAvisos.find((aviso) => aviso.tecnicoId !== null && estaAbierto(aviso.estado))?.tecnicoId
    assert.ok(id, 'los datos de ejemplo no tienen avisos asignados')
    return id
  }

  it('el listado solo trae sus avisos, y ningún filtro de la URL lo amplía', async () => {
    const tecnicoId = tecnicoConAvisos()
    const suyos = todosLosAvisos.filter((aviso) => aviso.tecnicoId === tecnicoId)

    const todos = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'todos' }, { tecnicoId })
    assert.deepEqual(todos.map((aviso) => aviso.id).sort(), suyos.map((aviso) => aviso.id).sort())

    // Pedir los de otro técnico o los sin asignar no devuelve nada.
    const otro = todosLosAvisos.find((aviso) => aviso.tecnicoId !== null && aviso.tecnicoId !== tecnicoId)
    assert.ok(otro?.tecnicoId)
    const ajenos = await m.listarAvisos(
      { ...m.FILTROS_VACIOS, vista: 'todos', tecnico: String(otro.tecnicoId) },
      { tecnicoId },
    )
    assert.equal(ajenos.length, 0)
    const sinAsignar = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'sin_asignar' }, { tecnicoId })
    assert.equal(sinAsignar.length, 0)
  })

  it('sin ficha vinculada no ve ningún aviso', async () => {
    const nada = await m.listarAvisos({ ...m.FILTROS_VACIOS, vista: 'todos' }, { tecnicoId: null })
    assert.equal(nada.length, 0)
    const contadores = await m.contadoresPanel({ tecnicoId: null })
    assert.equal(contadores.abiertos, 0)
  })

  it('su agenda y su trabajo sin programar solo traen lo suyo', async () => {
    const tecnicoId = tecnicoConAvisos()
    const desde = m.sumarDias(m.hoyISO(), -60)
    const hasta = m.sumarDias(m.hoyISO(), 60)

    const agenda = await m.avisosProgramados(desde, hasta, undefined, { tecnicoId })
    assert.ok(agenda.length > 0, 'los datos de ejemplo no le programan nada')
    for (const aviso of agenda) assert.equal(aviso.tecnicoId, tecnicoId)

    // El filtro de técnico de la agenda no amplía lo que ve.
    const otro = todosLosAvisos.find((aviso) => aviso.tecnicoId !== null && aviso.tecnicoId !== tecnicoId)
    assert.ok(otro?.tecnicoId)
    assert.equal((await m.avisosProgramados(desde, hasta, otro.tecnicoId, { tecnicoId })).length, 0)

    for (const aviso of await m.avisosSinProgramar(100, { tecnicoId })) assert.equal(aviso.tecnicoId, tecnicoId)
    assert.equal((await m.avisosProgramados(desde, hasta, undefined, { tecnicoId: null })).length, 0)
    assert.equal((await m.avisosSinProgramar(100, { tecnicoId: null })).length, 0)
  })

  it('sus contadores del panel cuentan solo lo suyo', async () => {
    const tecnicoId = tecnicoConAvisos()
    const contadores = await m.contadoresPanel({ tecnicoId })
    const abiertos = todosLosAvisos.filter(
      (aviso) => aviso.tecnicoId === tecnicoId && estaAbierto(aviso.estado),
    ).length
    assert.equal(contadores.abiertos, abiertos)
    assert.equal(contadores.sinAsignar, 0)
  })
})

describe('usuarios', () => {
  it('recargar los ejemplos conserva los usuarios y deja al técnico sin ficha', async () => {
    const id = '00000000-0000-4000-8000-000000000001'
    const tecnicoId = todosLosAvisos.find((aviso) => aviso.tecnicoId !== null)?.tecnicoId
    assert.ok(tecnicoId)

    await m.bd.execute(sql`insert into auth.users (id) values (${id})`)
    await m.bd.insert(m.esquema.perfiles).values({
      id,
      nombre: 'Técnico de prueba',
      email: 'tecnico@prueba.es',
      rol: 'tecnico',
      tecnicoId,
    })

    await m.sembrar({ limpiar: true })

    const [perfil] = await m.bd.select().from(m.esquema.perfiles).where(sql`id = ${id}`)
    assert.ok(perfil, 'la siembra se ha llevado el usuario')
    assert.equal(perfil.tecnicoId, null)
  })

  it('la base no deja un rol inventado ni una ficha en quien no es técnico', async () => {
    const id = '00000000-0000-4000-8000-000000000002'
    await m.bd.execute(sql`insert into auth.users (id) values (${id})`)
    await assert.rejects(
      m.bd.execute(sql`insert into perfiles (id, nombre, email, rol) values (${id}, 'X', 'x@x.es', 'jefe')`),
    )
    const tecnicoId = (await m.bd.select().from(m.esquema.tecnicos))[0]?.id
    await assert.rejects(
      m.bd.execute(
        sql`insert into perfiles (id, nombre, email, rol, tecnico_id) values (${id}, 'X', 'x@x.es', 'oficina', ${tecnicoId})`,
      ),
    )
  })
})

describe('agenda', () => {
  it('dentro de cada día van primero los avisos sin hora, y después por hora', async () => {
    // Postgres pone los NULL al final en «asc»: la consulta lo pide al revés a propósito.
    const dia = '2030-01-15'
    const { clienteId, localId } = todosLosAvisos[0]
    const comunes = { clienteId, localId, titulo: 'Prueba de agenda', categoria: 'otros' as const, fechaProgramada: dia }
    const insertados = await m.bd
      .insert(m.esquema.avisos)
      .values([
        { ...comunes, referencia: 'PR-AGENDA-1', horaProgramada: '12:00' },
        { ...comunes, referencia: 'PR-AGENDA-2', horaProgramada: '08:30' },
        { ...comunes, referencia: 'PR-AGENDA-3', horaProgramada: null },
      ])
      .returning({ id: m.esquema.avisos.id })
    try {
      const agenda = await m.avisosProgramados(dia, dia)
      assert.deepEqual(
        agenda.map((aviso) => aviso.horaProgramada),
        [null, '08:30', '12:00'],
      )
    } finally {
      const ids = insertados.map((fila) => fila.id)
      await m.bd.delete(m.esquema.avisos).where(sql`${m.esquema.avisos.id} in ${ids}`)
    }
  })
})

describe('ids que llegan de la URL', () => {
  // /avisos/abc, /avisos/1.5 o /avisos/99999999999 se convierten con Number(): a
  // Postgres le llegaba «NaN» o un número que no cabe en un integer, la consulta
  // fallaba y salía la pantalla de error en vez de «no existe».
  const RAROS = [Number('abc'), Number('1.png'), 1.5, 0, -3, 99_999_999_999, Infinity]

  it('lo que no puede ser un id «no existe», sin preguntar a la base', async () => {
    const avisos = await import('../src/db/consultas/avisos')
    const clientes = await import('../src/db/consultas/clientes')
    const tecnicos = await import('../src/db/consultas/tecnicos')

    for (const raro of RAROS) {
      assert.equal(await avisos.obtenerAviso(raro), null, `obtenerAviso(${raro})`)
      assert.equal(await avisos.obtenerParte(raro), null, `obtenerParte(${raro})`)
      assert.equal(await clientes.obtenerCliente(raro), null, `obtenerCliente(${raro})`)
      assert.equal(await clientes.obtenerLocal(raro), null, `obtenerLocal(${raro})`)
      assert.equal(await tecnicos.obtenerTecnico(raro), null, `obtenerTecnico(${raro})`)
    }
  })

  it('un id de verdad sigue encontrando su ficha', async () => {
    const avisos = await import('../src/db/consultas/avisos')
    const { id } = todosLosAvisos[0]
    assert.equal((await avisos.obtenerAviso(id))?.id, id)
  })

  it('un id que cabe pero no existe tampoco da error', async () => {
    const avisos = await import('../src/db/consultas/avisos')
    assert.equal(await avisos.obtenerAviso(2_147_483_647), null)
  })
})

describe('permisos del rol de la aplicación (app_avisos)', () => {
  // Las pruebas corren como superusuario de PGlite, que se salta permisos y RLS:
  // sin esto, un UPDATE nuevo sobre la cronología pasaría todas las pruebas y
  // fallaría en Supabase con «permission denied». Aquí se entra con el rol de
  // verdad, el de las migraciones, y se comprueba lo que puede y lo que no.
  async function comoLaAplicacion<T>(tarea: () => Promise<T>): Promise<T> {
    await m.bd.execute(sql`set role app_avisos`)
    try {
      return await tarea()
    } finally {
      await m.bd.execute(sql`reset role`)
    }
  }

  const denegado = /permission denied/i

  it('la cronología solo crece: puede añadir y leer movimientos, pero no modificarlos', async () => {
    const { id: avisoId, estado } = todosLosAvisos[0]
    await comoLaAplicacion(async () => {
      const [movimiento] = await m.bd
        .insert(m.esquema.movimientos)
        .values({ avisoId, estadoAnterior: estado, estadoNuevo: estado, nota: 'Prueba de permisos', fecha: new Date() })
        .returning({ id: m.esquema.movimientos.id })
      assert.ok(movimiento.id > 0)

      await assert.rejects(
        m.bd.execute(sql`update movimientos set nota = 'reescrita' where id = ${movimiento.id}`),
        (error: Error) => denegado.test(String(error.cause ?? error.message)),
        'app_avisos ha podido reescribir la cronología',
      )
      await m.bd.execute(sql`delete from movimientos where id = ${movimiento.id}`)
    })
  })

  it('en lecturas_ia anota, cuenta y borra, pero no corrige', async () => {
    // El perfil cuelga de su cuenta en auth.users (que en las pruebas solo tiene el id).
    const id = '00000000-0000-4000-8000-0000000000aa'
    await m.bd.execute(sql`insert into auth.users (id) values (${id})`)
    const [perfil] = await m.bd
      .insert(m.esquema.perfiles)
      .values({ id, nombre: 'Permisos', email: 'permisos@empresa.es', rol: 'oficina' })
      .returning({ id: m.esquema.perfiles.id })
    try {
      await comoLaAplicacion(async () => {
        await m.bd.insert(m.esquema.lecturasIa).values({ usuarioId: perfil.id })
        assert.equal((await m.bd.select().from(m.esquema.lecturasIa)).length, 1)
        await assert.rejects(
          m.bd.execute(sql`update lecturas_ia set fecha = now()`),
          (error: Error) => denegado.test(String(error.cause ?? error.message)),
        )
        await m.bd.execute(sql`delete from lecturas_ia`)
      })
    } finally {
      // Borrar la cuenta se lleva el perfil (y sus lecturas) en cascada.
      await m.bd.execute(sql`delete from auth.users where id = ${perfil.id}`)
    }
  })

  it('los usuarios no se borran, y las tablas no se pueden cambiar', async () => {
    await comoLaAplicacion(async () => {
      for (const sentencia of [sql`delete from perfiles`, sql`drop table movimientos`, sql`alter table avisos add column x int`]) {
        await assert.rejects(m.bd.execute(sentencia), (error: Error) =>
          /permission denied|must be owner/i.test(String(error.cause ?? error.message)),
        )
      }
    })
  })
})

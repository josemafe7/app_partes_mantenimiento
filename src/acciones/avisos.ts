'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { bd, type Transaccion } from '@/db/cliente'
import { avisoBloqueado, siguienteReferencia } from '@/db/consultas/avisos'
import { avisos, locales, movimientos, tecnicos, type Aviso } from '@/db/esquema'
import { ESTADO_INICIAL, SIN_PERMISO, texto, valoresDe, type ResultadoAccion } from '@/lib/acciones'
import { ESTADO, esEstado, type Estado } from '@/lib/dominio'
import { puede, puedeCambiarEstado, puedeVerAviso } from '@/lib/permisos'
import { usuarioDeLaAccion } from '@/lib/sesion'
import { erroresDe, esquemaAsignacion, esquemaAviso, esquemaCambioEstado } from '@/lib/validaciones'

/*
 * Las acciones que cambian un aviso leen, comprueban y escriben dentro de una
 * sola transacción: el cambio y su anotación en la cronología se guardan juntos
 * o no se guarda ninguno. El aviso se lee con `avisoBloqueado`, que lo reserva
 * hasta el final de la transacción: si dos personas lo cambian a la vez, la
 * segunda espera y ve lo que dejó la primera. `refrescar` y `redirect` van
 * siempre después, fuera: `redirect` lanza una excepción y dentro desharía todo
 * lo escrito.
 *
 * Cada acción empieza comprobando quién la pide (ver src/lib/permisos.ts): se
 * pueden llamar a mano sin pasar por la página, así que no basta con esconder
 * los botones. Cada movimiento de la cronología guarda quién lo hizo.
 */

function refrescar(id?: number) {
  revalidatePath('/')
  revalidatePath('/avisos')
  revalidatePath('/agenda')
  revalidatePath('/tablero')
  if (id) revalidatePath(`/avisos/${id}`)
}

/** Deja constancia del cambio en la cronología del aviso, con quién lo hizo. */
async function registrarMovimiento(
  tx: Transaccion,
  avisoId: number,
  estadoAnterior: Estado | null,
  estadoNuevo: Estado,
  nota: string | null,
  usuarioId: string,
) {
  await tx
    .insert(movimientos)
    .values({ avisoId, estadoAnterior, estadoNuevo, nota, usuarioId, fecha: new Date() })
}

/** Nombre del técnico para las notas de la cronología. */
async function nombreTecnico(tx: Transaccion, id: number | null): Promise<string | null> {
  if (!id) return null
  const tecnico = await tx.query.tecnicos.findFirst({ where: eq(tecnicos.id, id) })
  if (!tecnico) return null
  return [tecnico.nombre, tecnico.apellidos].filter(Boolean).join(' ')
}

function datosDelFormulario(formData: FormData) {
  return {
    clienteId: texto(formData, 'clienteId'),
    localId: texto(formData, 'localId'),
    tecnicoId: texto(formData, 'tecnicoId'),
    titulo: texto(formData, 'titulo'),
    descripcion: texto(formData, 'descripcion'),
    categoria: texto(formData, 'categoria'),
    prioridad: texto(formData, 'prioridad'),
    estado: texto(formData, 'estado'),
    canalEntrada: texto(formData, 'canalEntrada'),
    contactoAviso: texto(formData, 'contactoAviso'),
    fechaProgramada: texto(formData, 'fechaProgramada'),
    horaProgramada: texto(formData, 'horaProgramada'),
    motivoEspera: texto(formData, 'motivoEspera'),
    resumenCierre: texto(formData, 'resumenCierre'),
  }
}

/** El local elegido tiene que pertenecer al cliente elegido. */
async function localDelCliente(tx: Transaccion, localId: number, clienteId: number): Promise<boolean> {
  const local = await tx.query.locales.findFirst({ where: eq(locales.id, localId) })
  return local?.clienteId === clienteId
}

/* -------------------------------------------------------------------- Crear */

export async function crearAviso(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  const usuario = await usuarioDeLaAccion()
  if (!usuario || !puede(usuario, 'gestionarAvisos')) return SIN_PERMISO

  const analisis = esquemaAviso.safeParse(datosDelFormulario(formData))
  if (!analisis.success) {
    return { ok: false, errores: erroresDe(analisis.error), valores: valoresDe(formData) }
  }

  const datos = analisis.data

  // Devuelve el id del aviso creado, o null si el local no es de ese cliente.
  const avisoId = await bd.transaction(async (tx) => {
    if (!(await localDelCliente(tx, datos.localId, datos.clienteId))) return null

    const ahora = new Date()
    const [creado] = await tx
      .insert(avisos)
      .values({
        ...datos,
        referencia: await siguienteReferencia(tx),
        motivoEspera: datos.estado === 'en_espera' ? datos.motivoEspera : null,
        resumenCierre: datos.estado === 'finalizado' ? datos.resumenCierre : null,
        fechaCierre: datos.estado === 'finalizado' ? ahora : null,
        fechaAviso: ahora,
      })
      .returning({ id: avisos.id })

    const tecnico = await nombreTecnico(tx, datos.tecnicoId)
    await registrarMovimiento(
      tx,
      creado.id,
      null,
      datos.estado,
      tecnico ? `Aviso registrado y asignado a ${tecnico}` : 'Aviso registrado',
      usuario.id,
    )
    return creado.id
  })

  if (avisoId === null) {
    return {
      ok: false,
      errores: { localId: 'Ese local no pertenece al cliente seleccionado' },
      valores: valoresDe(formData),
    }
  }

  refrescar(avisoId)
  redirect(`/avisos/${avisoId}`)
}

/* --------------------------------------------------------------- Modificar */

export async function actualizarAviso(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  const usuario = await usuarioDeLaAccion()
  if (!usuario || !puede(usuario, 'gestionarAvisos')) return SIN_PERMISO

  const id = Number(texto(formData, 'id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, mensaje: 'Aviso no válido' }

  const resultado = await bd.transaction(async (tx): Promise<ResultadoAccion> => {
    const anterior = await avisoBloqueado(tx, id)
    if (!anterior) return { ok: false, mensaje: 'El aviso ya no existe' }

    const analisis = esquemaAviso.safeParse(datosDelFormulario(formData))
    if (!analisis.success) {
      return { ok: false, errores: erroresDe(analisis.error), valores: valoresDe(formData) }
    }

    const datos = analisis.data
    if (!(await localDelCliente(tx, datos.localId, datos.clienteId))) {
      return {
        ok: false,
        errores: { localId: 'Ese local no pertenece al cliente seleccionado' },
        valores: valoresDe(formData),
      }
    }

    await tx
      .update(avisos)
      .set({
        ...datos,
        motivoEspera: datos.estado === 'en_espera' ? datos.motivoEspera : null,
        resumenCierre: datos.estado === 'finalizado' ? datos.resumenCierre : null,
        // Si ya estaba cerrado se respeta su fecha de cierre original.
        fechaCierre:
          datos.estado === 'finalizado' ? (anterior.fechaCierre ?? new Date()) : null,
        actualizadoEn: new Date(),
      })
      .where(eq(avisos.id, id))

    await registrarCambiosDeLaEdicion(tx, anterior, datos.estado, datos.tecnicoId, usuario.id)
    return { ok: true }
  })

  if (!resultado.ok) return resultado

  refrescar(id)
  redirect(`/avisos/${id}`)
}

/** Anota en la cronología lo que ha cambiado al editar: estado y/o técnico. */
async function registrarCambiosDeLaEdicion(
  tx: Transaccion,
  anterior: Aviso,
  estadoNuevo: Estado,
  tecnicoNuevoId: number | null,
  usuarioId: string,
) {
  const cambioEstado = anterior.estado !== estadoNuevo
  const cambioTecnico = (anterior.tecnicoId ?? null) !== tecnicoNuevoId
  if (!cambioEstado && !cambioTecnico) return

  const notas: string[] = []
  if (cambioTecnico) {
    const nombre = await nombreTecnico(tx, tecnicoNuevoId)
    notas.push(nombre ? `Asignado a ${nombre}` : 'Asignación retirada')
  }
  if (cambioEstado) notas.push(`Estado cambiado a ${ESTADO[estadoNuevo].etiqueta.toLowerCase()}`)

  await registrarMovimiento(
    tx,
    anterior.id,
    cambioEstado ? anterior.estado : estadoNuevo,
    estadoNuevo,
    notas.join('. '),
    usuarioId,
  )
}

/* ------------------------------------------------------- Cambio de estado */

/**
 * Cambia el estado de un aviso aplicando las reglas del negocio.
 * La usan el detalle del aviso y el tablero, así que se puede llamar
 * directamente desde un componente de cliente.
 */
export async function cambiarEstado(
  avisoId: number,
  estado: Estado,
  nota: string,
): Promise<ResultadoAccion> {
  if (!esEstado(estado)) return { ok: false, mensaje: 'Estado no válido' }
  if (!Number.isInteger(avisoId) || avisoId <= 0) return { ok: false, mensaje: 'Aviso no válido' }

  const usuario = await usuarioDeLaAccion()
  if (!usuario) return SIN_PERMISO

  const resultado = await bd.transaction(async (tx): Promise<ResultadoAccion> => {
    const aviso = await avisoBloqueado(tx, avisoId)
    if (!aviso || !puedeVerAviso(usuario, aviso)) return { ok: false, mensaje: 'El aviso ya no existe' }
    if (aviso.estado === estado) return { ok: true }
    // El técnico solo mueve sus avisos en marcha, y solo a en curso, en espera o finalizado.
    if (!puedeCambiarEstado(usuario, aviso, estado)) return SIN_PERMISO

    const analisis = esquemaCambioEstado.safeParse({ estado, nota })
    if (!analisis.success) {
      return { ok: false, errores: erroresDe(analisis.error) }
    }

    // Un aviso no puede estar «en curso» sin alguien que lo esté haciendo.
    if (!aviso.tecnicoId && estado !== 'pendiente' && estado !== 'cancelado') {
      return {
        ok: false,
        mensaje: `Asigna primero un técnico para poder pasar el aviso a «${ESTADO[estado].etiqueta}».`,
      }
    }

    const limpia = analisis.data.nota
    await tx
      .update(avisos)
      .set({
        estado,
        motivoEspera: estado === 'en_espera' ? limpia : null,
        resumenCierre: estado === 'finalizado' ? limpia : null,
        fechaCierre: estado === 'finalizado' ? (aviso.fechaCierre ?? new Date()) : null,
        actualizadoEn: new Date(),
      })
      .where(eq(avisos.id, avisoId))

    await registrarMovimiento(tx, avisoId, aviso.estado, estado, limpia, usuario.id)
    return { ok: true }
  })

  if (resultado.ok) refrescar(avisoId)
  return resultado
}

/** Versión para formularios del cambio de estado. */
export async function accionCambiarEstado(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  const avisoId = Number(texto(formData, 'avisoId'))
  const estado = texto(formData, 'estado')
  if (!esEstado(estado)) return { ok: false, mensaje: 'Estado no válido' }
  return cambiarEstado(avisoId, estado, texto(formData, 'nota'))
}

/* ------------------------------------------------------------- Asignación */

/** Asigna técnico y fecha desde el detalle del aviso. */
export async function asignarAviso(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  const usuario = await usuarioDeLaAccion()
  if (!usuario || !puede(usuario, 'gestionarAvisos')) return SIN_PERMISO

  const avisoId = Number(texto(formData, 'avisoId'))
  if (!Number.isInteger(avisoId) || avisoId <= 0) return { ok: false, mensaje: 'Aviso no válido' }

  const resultado = await bd.transaction(async (tx): Promise<ResultadoAccion> => {
    const aviso = await avisoBloqueado(tx, avisoId)
    if (!aviso) return { ok: false, mensaje: 'El aviso ya no existe' }

    const analisis = esquemaAsignacion.safeParse({
      tecnicoId: texto(formData, 'tecnicoId'),
      fechaProgramada: texto(formData, 'fechaProgramada'),
      horaProgramada: texto(formData, 'horaProgramada'),
    })
    if (!analisis.success) {
      return { ok: false, errores: erroresDe(analisis.error), valores: valoresDe(formData) }
    }

    const { tecnicoId, fechaProgramada, horaProgramada } = analisis.data

    // Asignar un técnico a un aviso recién entrado lo pone «asignado»;
    // quitarlo lo devuelve a «pendiente». El resto de estados no se tocan.
    let estado = aviso.estado
    if (tecnicoId && aviso.estado === 'pendiente') estado = 'asignado'
    if (!tecnicoId && aviso.estado === 'asignado') estado = 'pendiente'

    // Salvo pendiente y cancelado, todo estado necesita técnico: a un aviso en
    // marcha o cerrado se le puede cambiar, pero no quitar.
    if (!tecnicoId && estado !== 'pendiente' && estado !== 'cancelado') {
      return {
        ok: false,
        errores: {
          tecnicoId: `Un aviso ${ESTADO[estado].etiqueta.toLowerCase()} necesita técnico: elige otro, o pásalo antes a pendiente o cancelado.`,
        },
        valores: valoresDe(formData),
      }
    }

    await tx
      .update(avisos)
      .set({ tecnicoId, fechaProgramada, horaProgramada, estado, actualizadoEn: new Date() })
      .where(eq(avisos.id, avisoId))

    const cambioTecnico = (aviso.tecnicoId ?? null) !== tecnicoId
    if (cambioTecnico || estado !== aviso.estado) {
      const nombre = await nombreTecnico(tx, tecnicoId)
      await registrarMovimiento(
        tx,
        avisoId,
        aviso.estado,
        estado,
        nombre ? `Asignado a ${nombre}` : 'Asignación retirada',
        usuario.id,
      )
    }
    return { ok: true }
  })

  if (resultado.ok) refrescar(avisoId)
  return resultado
}

/* ------------------------------------------------------------------ Borrar */

export async function eliminarAviso(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  const usuario = await usuarioDeLaAccion()
  if (!puede(usuario, 'borrarAvisos')) return SIN_PERMISO

  const id = Number(texto(formData, 'id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, mensaje: 'Aviso no válido' }

  const aviso = await bd.query.avisos.findFirst({ where: eq(avisos.id, id) })
  if (!aviso) return { ok: false, mensaje: 'El aviso ya no existe' }

  // Los partes y la cronología se van con el aviso (borrado en cascada).
  await bd.delete(avisos).where(eq(avisos.id, id))
  refrescar()
  redirect('/avisos')
}

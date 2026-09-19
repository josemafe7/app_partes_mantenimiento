'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { bd } from '@/db/cliente'
import { avisoBloqueado } from '@/db/consultas/avisos'
import { avisos, movimientos, partes } from '@/db/esquema'
import { casilla, ESTADO_INICIAL, SIN_PERMISO, texto, valoresDe, type ResultadoAccion } from '@/lib/acciones'
import { fechaCorta } from '@/lib/fechas'
import { puedeAnotarParte, puedeEditarParte, type Usuario } from '@/lib/permisos'
import { usuarioDeLaAccion } from '@/lib/sesion'
import { erroresDe, esquemaParte } from '@/lib/validaciones'

function refrescar(avisoId: number) {
  revalidatePath('/')
  revalidatePath('/avisos')
  revalidatePath(`/avisos/${avisoId}`)
  revalidatePath('/tecnicos')
  revalidatePath('/tablero')
}

/**
 * Datos del parte. Un técnico solo firma partes a su nombre: aunque el
 * formulario traiga otro técnico, se usa el suyo.
 */
function datosDelFormulario(formData: FormData, usuario: Usuario) {
  const tecnicoId =
    usuario.rol === 'tecnico' ? String(usuario.tecnicoId ?? '') : texto(formData, 'tecnicoId')
  return {
    tecnicoId,
    fecha: texto(formData, 'fecha'),
    horas: texto(formData, 'horas'),
    trabajoRealizado: texto(formData, 'trabajoRealizado'),
    materiales: texto(formData, 'materiales'),
    resuelto: casilla(formData, 'resuelto'),
    observaciones: texto(formData, 'observaciones'),
  }
}

export async function crearParte(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  const usuario = await usuarioDeLaAccion()
  if (!usuario) return SIN_PERMISO

  const avisoId = Number(texto(formData, 'avisoId'))
  if (!Number.isInteger(avisoId) || avisoId <= 0) return { ok: false, mensaje: 'Aviso no válido' }

  // El parte, el cambio de estado que provoca y su movimiento se guardan
  // juntos o no se guarda nada (ver la nota de src/acciones/avisos.ts).
  const resultado = await bd.transaction(async (tx): Promise<ResultadoAccion> => {
    const aviso = await avisoBloqueado(tx, avisoId)
    if (!aviso) return { ok: false, mensaje: 'El aviso ya no existe' }
    if (!puedeAnotarParte(usuario, aviso)) return SIN_PERMISO

    const analisis = esquemaParte.safeParse(datosDelFormulario(formData, usuario))
    if (!analisis.success) {
      return { ok: false, errores: erroresDe(analisis.error), valores: valoresDe(formData) }
    }

    const datos = analisis.data
    await tx.insert(partes).values({ ...datos, avisoId, creadoPor: usuario.id })

    // Un parte es trabajo hecho: mueve el aviso solo cuando tiene sentido.
    if (datos.resuelto && aviso.estado !== 'finalizado') {
      await tx
        .update(avisos)
        .set({
          estado: 'finalizado',
          resumenCierre: datos.trabajoRealizado,
          fechaCierre: new Date(),
          motivoEspera: null,
          tecnicoId: aviso.tecnicoId ?? datos.tecnicoId,
          actualizadoEn: new Date(),
        })
        .where(eq(avisos.id, avisoId))
      await tx.insert(movimientos).values({
        avisoId,
        estadoAnterior: aviso.estado,
        estadoNuevo: 'finalizado',
        nota: `Finalizado con el parte del ${fechaCorta(datos.fecha)}`,
        usuarioId: usuario.id,
        fecha: new Date(),
      })
    } else if (!datos.resuelto && (aviso.estado === 'pendiente' || aviso.estado === 'asignado')) {
      await tx
        .update(avisos)
        .set({
          estado: 'en_curso',
          tecnicoId: aviso.tecnicoId ?? datos.tecnicoId,
          actualizadoEn: new Date(),
        })
        .where(eq(avisos.id, avisoId))
      await tx.insert(movimientos).values({
        avisoId,
        estadoAnterior: aviso.estado,
        estadoNuevo: 'en_curso',
        nota: `Trabajo iniciado con el parte del ${fechaCorta(datos.fecha)}`,
        usuarioId: usuario.id,
        fecha: new Date(),
      })
    }
    return { ok: true }
  })

  if (!resultado.ok) return resultado

  refrescar(avisoId)
  redirect(`/avisos/${avisoId}`)
}

export async function actualizarParte(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  const usuario = await usuarioDeLaAccion()
  if (!usuario) return SIN_PERMISO

  const id = Number(texto(formData, 'id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, mensaje: 'Parte no válido' }

  // El aviso sale del parte guardado, no del formulario.
  const parte = await bd.query.partes.findFirst({ where: eq(partes.id, id), with: { aviso: true } })
  if (!parte) return { ok: false, mensaje: 'El parte ya no existe' }
  if (!puedeEditarParte(usuario, parte.aviso, parte)) return SIN_PERMISO

  const analisis = esquemaParte.safeParse(datosDelFormulario(formData, usuario))
  if (!analisis.success) {
    return { ok: false, errores: erroresDe(analisis.error), valores: valoresDe(formData) }
  }

  await bd
    .update(partes)
    .set({ ...analisis.data, actualizadoEn: new Date() })
    .where(eq(partes.id, id))

  refrescar(parte.avisoId)
  redirect(`/avisos/${parte.avisoId}`)
}

export async function eliminarParte(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  const usuario = await usuarioDeLaAccion()
  if (!usuario) return SIN_PERMISO

  const id = Number(texto(formData, 'id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, mensaje: 'Parte no válido' }

  const parte = await bd.query.partes.findFirst({ where: eq(partes.id, id), with: { aviso: true } })
  if (!parte) return { ok: false, mensaje: 'El parte ya no existe' }
  if (!puedeEditarParte(usuario, parte.aviso, parte)) return SIN_PERMISO

  await bd.delete(partes).where(eq(partes.id, id))
  refrescar(parte.avisoId)
  redirect(`/avisos/${parte.avisoId}`)
}

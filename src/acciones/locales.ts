'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { bd } from '@/db/cliente'
import { dependenciasLocal } from '@/db/consultas/clientes'
import { locales } from '@/db/esquema'
import { ESTADO_INICIAL, SIN_PERMISO, texto, valoresDe, type ResultadoAccion } from '@/lib/acciones'
import { puede } from '@/lib/permisos'
import { usuarioDeLaAccion } from '@/lib/sesion'
import { plural } from '@/lib/utils'
import { erroresDe, esquemaLocal } from '@/lib/validaciones'

function datosDelFormulario(formData: FormData) {
  return {
    clienteId: texto(formData, 'clienteId'),
    nombre: texto(formData, 'nombre'),
    direccion: texto(formData, 'direccion'),
    ciudad: texto(formData, 'ciudad'),
    provincia: texto(formData, 'provincia'),
    codigoPostal: texto(formData, 'codigoPostal'),
    telefono: texto(formData, 'telefono'),
    personaContacto: texto(formData, 'personaContacto'),
    horario: texto(formData, 'horario'),
    notasAcceso: texto(formData, 'notasAcceso'),
  }
}

function refrescar(clienteId: number, localId?: number) {
  revalidatePath('/clientes')
  revalidatePath(`/clientes/${clienteId}`)
  revalidatePath('/avisos')
  if (localId) revalidatePath(`/locales/${localId}`)
}

export async function crearLocal(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  if (!puede(await usuarioDeLaAccion(), 'gestionarClientes')) return SIN_PERMISO

  const analisis = esquemaLocal.safeParse(datosDelFormulario(formData))
  if (!analisis.success) {
    return { ok: false, errores: erroresDe(analisis.error), valores: valoresDe(formData) }
  }

  const [creado] = await bd.insert(locales).values(analisis.data).returning({ id: locales.id })
  refrescar(analisis.data.clienteId, creado.id)
  redirect(`/clientes/${analisis.data.clienteId}`)
}

export async function actualizarLocal(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  if (!puede(await usuarioDeLaAccion(), 'gestionarClientes')) return SIN_PERMISO

  const id = Number(texto(formData, 'id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, mensaje: 'Local no válido' }

  const analisis = esquemaLocal.safeParse(datosDelFormulario(formData))
  if (!analisis.success) {
    return { ok: false, errores: erroresDe(analisis.error), valores: valoresDe(formData) }
  }

  await bd
    .update(locales)
    .set({ ...analisis.data, actualizadoEn: new Date() })
    .where(eq(locales.id, id))

  refrescar(analisis.data.clienteId, id)
  redirect(`/locales/${id}`)
}

export async function alternarArchivadoLocal(formData: FormData): Promise<void> {
  if (!puede(await usuarioDeLaAccion(), 'gestionarClientes')) return

  const id = Number(texto(formData, 'id'))
  if (!Number.isInteger(id) || id <= 0) return

  const local = await bd.query.locales.findFirst({ where: eq(locales.id, id) })
  if (!local) return

  await bd
    .update(locales)
    .set({ archivado: !local.archivado, actualizadoEn: new Date() })
    .where(eq(locales.id, id))

  refrescar(local.clienteId, id)
}

export async function eliminarLocal(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  if (!puede(await usuarioDeLaAccion(), 'borrarClientes')) return SIN_PERMISO

  const id = Number(texto(formData, 'id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, mensaje: 'Local no válido' }

  const local = await bd.query.locales.findFirst({ where: eq(locales.id, id) })
  if (!local) return { ok: false, mensaje: 'El local ya no existe' }

  const { numAvisos } = await dependenciasLocal(id)
  if (numAvisos > 0) {
    return {
      ok: false,
      mensaje: `No se puede eliminar: este local tiene ${plural(numAvisos, 'aviso', 'avisos')} en el historial. Archívalo para dejar de usarlo sin perder esos datos.`,
    }
  }

  await bd.delete(locales).where(eq(locales.id, id))
  refrescar(local.clienteId)
  redirect(`/clientes/${local.clienteId}`)
}

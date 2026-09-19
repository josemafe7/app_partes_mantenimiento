'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { bd } from '@/db/cliente'
import { dependenciasTecnico } from '@/db/consultas/tecnicos'
import { tecnicos } from '@/db/esquema'
import { ESTADO_INICIAL, SIN_PERMISO, texto, textos, valoresDe, type ResultadoAccion } from '@/lib/acciones'
import { puede } from '@/lib/permisos'
import { usuarioDeLaAccion } from '@/lib/sesion'
import { plural } from '@/lib/utils'
import { erroresDe, esquemaTecnico } from '@/lib/validaciones'

function datosDelFormulario(formData: FormData) {
  return {
    nombre: texto(formData, 'nombre'),
    apellidos: texto(formData, 'apellidos'),
    telefono: texto(formData, 'telefono'),
    email: texto(formData, 'email'),
    especialidades: textos(formData, 'especialidades'),
    zona: texto(formData, 'zona'),
    notas: texto(formData, 'notas'),
  }
}

function refrescar(id?: number) {
  revalidatePath('/tecnicos')
  revalidatePath('/avisos')
  revalidatePath('/agenda')
  if (id) revalidatePath(`/tecnicos/${id}`)
}

export async function crearTecnico(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  if (!puede(await usuarioDeLaAccion(), 'altaTecnicos')) return SIN_PERMISO

  const analisis = esquemaTecnico.safeParse(datosDelFormulario(formData))
  if (!analisis.success) {
    return { ok: false, errores: erroresDe(analisis.error), valores: valoresDe(formData) }
  }

  const [creado] = await bd.insert(tecnicos).values(analisis.data).returning({ id: tecnicos.id })
  refrescar(creado.id)
  redirect(`/tecnicos/${creado.id}`)
}

export async function actualizarTecnico(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  if (!puede(await usuarioDeLaAccion(), 'gestionarTecnicos')) return SIN_PERMISO

  const id = Number(texto(formData, 'id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, mensaje: 'Técnico no válido' }

  const analisis = esquemaTecnico.safeParse(datosDelFormulario(formData))
  if (!analisis.success) {
    return { ok: false, errores: erroresDe(analisis.error), valores: valoresDe(formData) }
  }

  await bd
    .update(tecnicos)
    .set({ ...analisis.data, actualizadoEn: new Date() })
    .where(eq(tecnicos.id, id))

  refrescar(id)
  redirect(`/tecnicos/${id}`)
}

/** Un técnico archivado deja de aparecer para asignar, pero conserva su historial. */
export async function alternarArchivadoTecnico(formData: FormData): Promise<void> {
  if (!puede(await usuarioDeLaAccion(), 'altaTecnicos')) return

  const id = Number(texto(formData, 'id'))
  if (!Number.isInteger(id) || id <= 0) return

  const tecnico = await bd.query.tecnicos.findFirst({ where: eq(tecnicos.id, id) })
  if (!tecnico) return

  await bd
    .update(tecnicos)
    .set({ archivado: !tecnico.archivado, actualizadoEn: new Date() })
    .where(eq(tecnicos.id, id))

  refrescar(id)
}

export async function eliminarTecnico(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  if (!puede(await usuarioDeLaAccion(), 'altaTecnicos')) return SIN_PERMISO

  const id = Number(texto(formData, 'id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, mensaje: 'Técnico no válido' }

  const { numAvisos, numPartes } = await dependenciasTecnico(id)
  if (numAvisos > 0 || numPartes > 0) {
    const detalles = [
      numAvisos > 0 ? plural(numAvisos, 'aviso asignado', 'avisos asignados') : null,
      numPartes > 0 ? plural(numPartes, 'parte de trabajo', 'partes de trabajo') : null,
    ].filter(Boolean)
    return {
      ok: false,
      mensaje: `No se puede eliminar: este técnico tiene ${detalles.join(' y ')}. Archívalo para que no aparezca al asignar trabajos.`,
    }
  }

  await bd.delete(tecnicos).where(eq(tecnicos.id, id))
  refrescar()
  redirect('/tecnicos')
}

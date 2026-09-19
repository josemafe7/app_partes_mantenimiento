'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { bd } from '@/db/cliente'
import { dependenciasCliente } from '@/db/consultas/clientes'
import { clientes } from '@/db/esquema'
import { ESTADO_INICIAL, SIN_PERMISO, texto, valoresDe, type ResultadoAccion } from '@/lib/acciones'
import { puede } from '@/lib/permisos'
import { usuarioDeLaAccion } from '@/lib/sesion'
import { plural } from '@/lib/utils'
import { erroresDe, esquemaCliente } from '@/lib/validaciones'

function datosDelFormulario(formData: FormData) {
  return {
    nombre: texto(formData, 'nombre'),
    cif: texto(formData, 'cif'),
    personaContacto: texto(formData, 'personaContacto'),
    telefono: texto(formData, 'telefono'),
    email: texto(formData, 'email'),
    direccionFacturacion: texto(formData, 'direccionFacturacion'),
    notas: texto(formData, 'notas'),
  }
}

function refrescar(id?: number) {
  revalidatePath('/clientes')
  revalidatePath('/avisos')
  if (id) revalidatePath(`/clientes/${id}`)
}

export async function crearCliente(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  if (!puede(await usuarioDeLaAccion(), 'gestionarClientes')) return SIN_PERMISO

  const analisis = esquemaCliente.safeParse(datosDelFormulario(formData))
  if (!analisis.success) {
    return { ok: false, errores: erroresDe(analisis.error), valores: valoresDe(formData) }
  }

  const [creado] = await bd.insert(clientes).values(analisis.data).returning({ id: clientes.id })
  refrescar(creado.id)
  redirect(`/clientes/${creado.id}`)
}

export async function actualizarCliente(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  if (!puede(await usuarioDeLaAccion(), 'gestionarClientes')) return SIN_PERMISO

  const id = Number(texto(formData, 'id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, mensaje: 'Cliente no válido' }

  const analisis = esquemaCliente.safeParse(datosDelFormulario(formData))
  if (!analisis.success) {
    return { ok: false, errores: erroresDe(analisis.error), valores: valoresDe(formData) }
  }

  await bd
    .update(clientes)
    .set({ ...analisis.data, actualizadoEn: new Date() })
    .where(eq(clientes.id, id))

  refrescar(id)
  redirect(`/clientes/${id}`)
}

/** Archivar oculta el cliente de listados y desplegables sin perder su historial. */
export async function alternarArchivadoCliente(formData: FormData): Promise<void> {
  if (!puede(await usuarioDeLaAccion(), 'gestionarClientes')) return

  const id = Number(texto(formData, 'id'))
  if (!Number.isInteger(id) || id <= 0) return

  const cliente = await bd.query.clientes.findFirst({ where: eq(clientes.id, id) })
  if (!cliente) return

  await bd
    .update(clientes)
    .set({ archivado: !cliente.archivado, actualizadoEn: new Date() })
    .where(eq(clientes.id, id))

  refrescar(id)
}

export async function eliminarCliente(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  if (!puede(await usuarioDeLaAccion(), 'borrarClientes')) return SIN_PERMISO

  const id = Number(texto(formData, 'id'))
  if (!Number.isInteger(id) || id <= 0) return { ok: false, mensaje: 'Cliente no válido' }

  // Borrado protegido: si hay historial colgando, se archiva en lugar de borrar.
  const { numLocales, numAvisos } = await dependenciasCliente(id)
  if (numLocales > 0 || numAvisos > 0) {
    const partes = [
      numLocales > 0 ? plural(numLocales, 'local', 'locales') : null,
      numAvisos > 0 ? plural(numAvisos, 'aviso', 'avisos') : null,
    ].filter(Boolean)
    return {
      ok: false,
      mensaje: `No se puede eliminar: este cliente tiene ${partes.join(' y ')}. Archívalo para quitarlo de los listados sin perder el historial.`,
    }
  }

  await bd.delete(clientes).where(eq(clientes.id, id))
  refrescar()
  redirect('/clientes')
}

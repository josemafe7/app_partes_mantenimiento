'use server'

import { revalidatePath } from 'next/cache'

import { bdVacia } from '@/db/consultas/panel'
import { sembrar } from '@/db/semilla'
import { ESTADO_INICIAL, SIN_PERMISO, type ResultadoAccion } from '@/lib/acciones'
import { puede } from '@/lib/permisos'
import { usuarioDeLaAccion } from '@/lib/sesion'

/**
 * Carga los datos de ejemplo desde la propia aplicación.
 * Es el atajo para no tener que ir a la terminal la primera vez.
 *
 * Solo un administrador y solo con la base vacía: la siembra borra lo que haya,
 * así que llamada a mano sobre una base con datos se los llevaría por delante.
 */
export async function cargarDatosEjemplo(
  _previo: ResultadoAccion = ESTADO_INICIAL,
): Promise<ResultadoAccion> {
  if (!puede(await usuarioDeLaAccion(), 'cargarDatosEjemplo')) return SIN_PERMISO
  if (!(await bdVacia())) {
    return { ok: false, mensaje: 'La base ya tiene datos: los de ejemplo solo se cargan en una vacía.' }
  }

  const resumen = await sembrar({ limpiar: true })

  revalidatePath('/', 'layout')

  return {
    ok: true,
    mensaje: `Cargados ${resumen.clientes} clientes, ${resumen.locales} locales, ${resumen.tecnicos} técnicos, ${resumen.avisos} avisos y ${resumen.partes} partes de trabajo.`,
  }
}

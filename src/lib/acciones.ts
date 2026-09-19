/**
 * Contrato común de las acciones de servidor (crear, modificar, borrar).
 *
 * Todas devuelven lo mismo, así los formularios pintan errores de la misma forma.
 */

import type { ErroresCampo } from './validaciones'

export type ResultadoAccion = {
  ok: boolean
  /** Mensaje general: un error que no pertenece a ningún campo concreto. */
  mensaje?: string
  /** Errores por nombre de campo del formulario. */
  errores?: ErroresCampo
  /**
   * Lo que el usuario había escrito. React 19 limpia los campos del formulario
   * al terminar la acción, así que los devolvemos para no perder el trabajo
   * cuando la validación falla.
   */
  valores?: Record<string, string | string[]>
  /**
   * Un dato que se enseña una sola vez y no se guarda en ningún sitio: la
   * contraseña temporal de un usuario nuevo o restablecido.
   */
  secreto?: string
}

export const ESTADO_INICIAL: ResultadoAccion = { ok: false }

/**
 * Respuesta de una acción a quien no puede hacerla. Las páginas ya no enseñan
 * esos botones, así que solo llega aquí quien fabrica la petición a mano o
 * quien ha perdido el permiso con la página abierta.
 */
export const SIN_PERMISO: ResultadoAccion = {
  ok: false,
  mensaje: 'No tienes permiso para hacer esto. Si crees que es un error, habla con el administrador.',
}

/** Copia el contenido del formulario a un objeto plano (repetidos → array). */
export function valoresDe(formData: FormData): Record<string, string | string[]> {
  const valores: Record<string, string | string[]> = {}
  for (const [clave, valor] of formData.entries()) {
    if (typeof valor !== 'string') continue
    const actual = valores[clave]
    if (actual === undefined) {
      valores[clave] = valor
    } else if (Array.isArray(actual)) {
      actual.push(valor)
    } else {
      valores[clave] = [actual, valor]
    }
  }
  return valores
}

/** Texto de un campo del formulario, siempre como cadena. */
export function texto(formData: FormData, campo: string): string {
  const valor = formData.get(campo)
  return typeof valor === 'string' ? valor : ''
}

/** Valores repetidos de un campo (grupos de casillas). */
export function textos(formData: FormData, campo: string): string[] {
  return formData.getAll(campo).filter((valor): valor is string => typeof valor === 'string')
}

/** Una casilla marcada llega como «on»; si no está marcada, no llega. */
export function casilla(formData: FormData, campo: string): boolean {
  return formData.get(campo) !== null
}

/** Recupera un valor previo para repintar el formulario tras un error. */
export function valorPrevio(
  resultado: ResultadoAccion | null | undefined,
  campo: string,
): string | undefined {
  const valor = resultado?.valores?.[campo]
  if (typeof valor === 'string') return valor
  return undefined
}

/** Igual que `valorPrevio` pero para grupos de casillas. */
export function valoresPrevios(
  resultado: ResultadoAccion | null | undefined,
  campo: string,
): string[] | undefined {
  const valor = resultado?.valores?.[campo]
  if (Array.isArray(valor)) return valor
  if (typeof valor === 'string') return [valor]
  return undefined
}

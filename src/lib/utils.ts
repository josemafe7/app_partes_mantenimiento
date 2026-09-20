import { clsx, type ClassValue } from 'clsx'
import { extendTailwindMerge } from 'tailwind-merge'

/*
 * tailwind-merge solo conoce los radios y sombras de Tailwind. Sin decirle los
 * del tema (globals.css), en `rounded-control rounded-full` dejaría las dos
 * clases y ganaría la que el CSS ponga después, no la que se pidió.
 */
const unirClases = extendTailwindMerge({
  extend: {
    theme: {
      radius: ['panel', 'tarjeta', 'control'],
      shadow: ['tarjeta', 'flotante'],
    },
  },
})

/** Combina clases de Tailwind resolviendo los conflictos. */
export function cn(...clases: ClassValue[]): string {
  return unirClases(clsx(clases))
}

/** `4` → `4 avisos`, `1` → `1 aviso` */
export function plural(cantidad: number, singular: string, plural: string): string {
  return `${cantidad} ${cantidad === 1 ? singular : plural}`
}

/**
 * ¿Puede ser el id de una fila? Los ids son `integer` de Postgres: enteros
 * positivos de 32 bits. Lo que llega de la URL (`/avisos/abc`, `1.5`,
 * `99999999999`) se convierte con `Number()` y, sin este filtro, Postgres lo
 * rechaza con un error y sale la pantalla de fallo en vez de «no existe».
 */
export function esIdValido(valor: number): boolean {
  return Number.isInteger(valor) && valor > 0 && valor <= 2_147_483_647
}

/** Quita acentos y pasa a minúsculas, para buscar «climatizacion» y encontrar «climatización». */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/** Iniciales para los avatares de técnico: «Marta Ruiz» → «MR». */
export function iniciales(nombre: string, apellidos?: string | null): string {
  const primera = nombre.trim().charAt(0)
  const segunda = (apellidos?.trim() || nombre.trim().split(' ')[1] || '').charAt(0)
  return (primera + segunda).toUpperCase()
}

const PALABRAS_VACIAS = new Set(['el', 'la', 'los', 'las', 'de', 'del', 'y', '&', 'e'])

/**
 * Iniciales de una empresa saltándose artículos y preposiciones:
 * «Panaderías El Horno de Lucía» → «PH», no «PE».
 */
export function inicialesEmpresa(nombre: string): string {
  const palabras = nombre
    .trim()
    .split(/\s+/)
    .filter((palabra, indice) => indice === 0 || !PALABRAS_VACIAS.has(palabra.toLowerCase()))
  return ((palabras[0]?.charAt(0) ?? '') + (palabras[1]?.charAt(0) ?? '')).toUpperCase()
}

/**
 * Reglas de las contraseñas y generador de contraseñas temporales.
 *
 * Las mismas reglas se configuran en Supabase Auth (longitud mínima y tipos de
 * carácter), que las vuelve a exigir por su cuenta. Aquí se comprueban antes
 * para dar un mensaje claro en español, campo a campo. Además, al guardar una
 * contraseña nueva el servidor mira si aparece en filtraciones conocidas
 * (`contrasenaFiltrada`, en `src/lib/filtraciones.ts`).
 */

/** Longitud mínima: la longitud es lo que más cuesta adivinar. */
export const LONGITUD_MINIMA = 12

/** Supabase Auth guarda las contraseñas con bcrypt, que ignora lo que pase de 72 bytes. */
export const LONGITUD_MAXIMA = 72

/**
 * Los símbolos que cuenta Supabase Auth: si aquí valiera otro (una ñ, un €),
 * la contraseña pasaría esta comprobación y Supabase la rechazaría después.
 */
const SIMBOLOS = /[!@#$%^&*()_+\-=[\]{};'\\:"|<>?,./`~]/

type Regla = {
  /** Cómo se enseña en la lista de requisitos del formulario (sin texto, no se enseña). */
  requisito?: string
  /** El error cuando no se cumple. */
  mensaje: string
  cumple: (contrasena: string) => boolean
}

export const REGLAS_CONTRASENA: readonly Regla[] = [
  {
    requisito: `Al menos ${LONGITUD_MINIMA} caracteres`,
    mensaje: `Tiene que tener al menos ${LONGITUD_MINIMA} caracteres`,
    cumple: (contrasena) => contrasena.length >= LONGITUD_MINIMA,
  },
  {
    mensaje: `Como máximo ${LONGITUD_MAXIMA} caracteres`,
    cumple: (contrasena) => new TextEncoder().encode(contrasena).length <= LONGITUD_MAXIMA,
  },
  {
    requisito: 'Una letra minúscula',
    mensaje: 'Añade alguna letra minúscula',
    cumple: (contrasena) => /[a-z]/.test(contrasena),
  },
  {
    requisito: 'Una letra mayúscula',
    mensaje: 'Añade alguna letra mayúscula',
    cumple: (contrasena) => /[A-Z]/.test(contrasena),
  },
  { requisito: 'Un número', mensaje: 'Añade algún número', cumple: (contrasena) => /\d/.test(contrasena) },
  {
    requisito: 'Un símbolo, como - _ . ! ? o #',
    mensaje: 'Añade algún símbolo, como - _ . ! ? o #',
    cumple: (contrasena) => SIMBOLOS.test(contrasena),
  },
]

/**
 * El primer problema de la contraseña, o `null` si es válida. Se da solo uno
 * para no abrumar: al corregirlo aparece el siguiente.
 */
export function problemaContrasena(contrasena: string, email?: string): string | null {
  for (const regla of REGLAS_CONTRASENA) {
    if (!regla.cumple(contrasena)) return regla.mensaje
  }

  // Ni el email ni su parte de delante: es lo primero que prueba un atacante.
  const usuario = email?.split('@')[0]?.toLowerCase() ?? ''
  if (usuario.length >= 3 && contrasena.toLowerCase().includes(usuario)) {
    return 'No puede contener tu email'
  }

  // Un mismo carácter repetido muchas veces (aaaaaaa…) no aporta nada.
  if (/(.)\1{5,}/.test(contrasena)) return 'Evita repetir el mismo carácter tantas veces'

  return null
}

/* ----------------------------------------------------- Contraseñas temporales */

/*
 * Sin caracteres que se confundan al dictarlos o copiarlos a mano (0/O, 1/l/I).
 * Cuatro bloques de cuatro separados por guiones: unos 90 bits de azar, y el
 * guion cuenta como símbolo para las reglas de Supabase.
 */
const MINUSCULAS = 'abcdefghijkmnpqrstuvwxyz'
const MAYUSCULAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ'
const NUMEROS = '23456789'
const ALFABETO = MINUSCULAS + MAYUSCULAS + NUMEROS

/** Un índice al azar en [0, tope) sin el sesgo del módulo. */
function indiceAlAzar(tope: number): number {
  const limite = Math.floor(256 / tope) * tope
  const byte = new Uint8Array(1)
  do {
    crypto.getRandomValues(byte)
  } while (byte[0] >= limite)
  return byte[0] % tope
}

/**
 * Contraseña para un usuario nuevo o restablecido. Se le da en mano y la tiene
 * que cambiar al entrar por primera vez.
 */
export function generarContrasenaTemporal(): string {
  for (;;) {
    const bloques = Array.from({ length: 4 }, () =>
      Array.from({ length: 4 }, () => ALFABETO[indiceAlAzar(ALFABETO.length)]).join(''),
    )
    const contrasena = bloques.join('-')
    if (problemaContrasena(contrasena) === null) return contrasena
  }
}

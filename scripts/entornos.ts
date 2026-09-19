/**
 * Los dos entornos del proyecto, y las guardias para no confundirlos.
 *
 * - **desarrollo** (`.env.local`): el proyecto «App de Partes - Desarrollo».
 *   Es el destino por defecto de todo: `pnpm dev`, `pnpm db:reset`, los
 *   usuarios de prueba y la copia de datos.
 * - **producción** (`.env.produccion.local`): el proyecto «App de Partes», el
 *   que usa la web publicada en Vercel. Solo se toca pidiéndolo expresamente,
 *   con `--entorno=produccion`.
 *
 * Aquí no hay efectos: este archivo solo lee archivos y decide. Cargar el
 * entorno en `process.env` es cosa de `entorno.ts`, y así estas funciones se
 * pueden probar (`tests/entornos.test.ts`).
 *
 * La guardia importante es `exigirDesarrollo`: `pnpm db:reset` borra la base
 * antes de sembrarla, y sin esto un `.env.local` apuntando a producción se la
 * lleva por delante sin preguntar.
 */

import { existsSync, readFileSync } from 'node:fs'
import { parseEnv } from 'node:util'

/** Proyecto de Supabase de producción: el de la web publicada. */
export const REF_PRODUCCION = 'qiydpgnryyypnkhuqzyv'

/** Proyecto de Supabase de desarrollo: el de trabajar en local. */
export const REF_DESARROLLO = 'ujftpokeijrivicdwpnx'

export type Entorno = 'desarrollo' | 'produccion'

export const ENTORNOS: readonly Entorno[] = ['desarrollo', 'produccion']

/** De qué archivo salen las variables de cada entorno. */
export const ARCHIVO: Record<Entorno, string> = {
  desarrollo: '.env.local',
  produccion: '.env.produccion.local',
}

export type Variables = Record<string, string | undefined>

/* ------------------------------------------------- Línea de órdenes */

/** Las banderas (`--algo`) de los argumentos, sin el `--`. */
export function banderas(argumentos: readonly string[] = process.argv.slice(2)): Set<string> {
  const encontradas = new Set<string>()
  for (const argumento of argumentos) {
    if (!argumento.startsWith('--')) continue
    encontradas.add(argumento.slice(2).split('=')[0])
  }
  return encontradas
}

/** Los argumentos de verdad, quitando las banderas (`--entorno=produccion`…). */
export function argumentosSueltos(argumentos: readonly string[] = process.argv.slice(2)): string[] {
  return argumentos.filter((argumento) => !argumento.startsWith('--'))
}

/**
 * El entorno pedido en `--entorno=<nombre>` o en la variable `ENTORNO`. Si no
 * se dice nada, desarrollo: lo normal es trabajar contra la base de pruebas.
 */
export function entornoPedido(
  argumentos: readonly string[] = process.argv.slice(2),
  variablesDelProceso: Variables = process.env,
): Entorno {
  const enArgumentos = argumentos.find((argumento) => argumento.startsWith('--entorno='))
  const escrito = enArgumentos?.slice('--entorno='.length) ?? variablesDelProceso.ENTORNO
  if (!escrito) return 'desarrollo'

  const nombre = escrito.trim().toLowerCase()
  if ((ENTORNOS as readonly string[]).includes(nombre)) return nombre as Entorno

  throw new Error(`Entorno desconocido: «${escrito}». Los que hay: ${ENTORNOS.join(', ')}.`)
}

/* ----------------------------------------------------- Las variables */

/** Las variables de un entorno, leídas de su archivo. No toca `process.env`. */
export function variablesDe(entorno: Entorno): Variables {
  const archivo = ARCHIVO[entorno]
  if (!existsSync(archivo)) {
    throw new Error(
      `Falta ${archivo}, el archivo del entorno de ${entorno}. ` +
        'Cópialo de .env.example y rellénalo (ver README, «Los dos entornos»).',
    )
  }
  return parseEnv(readFileSync(archivo, 'utf8')) as Variables
}

/* -------------------------------------------- Qué proyecto hay detrás */

/**
 * El ref del proyecto de Supabase de una cadena de conexión. Sale del usuario
 * del pooler (`app_avisos.<ref>`) o del host de la conexión directa
 * (`db.<ref>.supabase.co`). Devuelve `null` si no es una base de Supabase.
 */
export function refDeConexion(url: string | undefined): string | null {
  if (!url) return null
  let direccion: URL
  try {
    direccion = new URL(url)
  } catch {
    return null
  }

  const trasElPunto = decodeURIComponent(direccion.username).split('.')[1]
  if (trasElPunto) return trasElPunto

  return direccion.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/)?.[1] ?? null
}

/** El ref del proyecto de una URL de Supabase (`https://<ref>.supabase.co`). */
export function refDeApi(url: string | undefined): string | null {
  if (!url) return null
  try {
    return new URL(url).hostname.match(/^([a-z0-9]+)\.supabase\.co$/)?.[1] ?? null
  } catch {
    return null
  }
}

/** Los proyectos que nombran unas variables: el de la base y el de Auth. */
export function refsDe(variables: Variables): { base: string | null; api: string | null } {
  return { base: refDeConexion(variables.DATABASE_URL), api: refDeApi(variables.SUPABASE_URL) }
}

/** Si unas variables apuntan al proyecto de producción, por la base o por Auth. */
export function esProduccion(variables: Variables): boolean {
  const { base, api } = refsDe(variables)
  return base === REF_PRODUCCION || api === REF_PRODUCCION
}

/** Cómo se enseña un destino antes de escribir en él. */
export function describirDestino(variables: Variables): string {
  const { base } = refsDe(variables)
  const servidor = servidorDe(variables.DATABASE_URL)
  const proyecto =
    base === REF_PRODUCCION
      ? `proyecto ${base} (PRODUCCIÓN)`
      : base === REF_DESARROLLO
        ? `proyecto ${base} (desarrollo)`
        : base
          ? `proyecto ${base}`
          : 'proyecto desconocido'
  return `${proyecto} en ${servidor}`
}

function servidorDe(url: string | undefined): string {
  try {
    return new URL(url ?? '').host
  } catch {
    return '(sin DATABASE_URL)'
  }
}

/* -------------------------------------------------------- Las guardias */

/**
 * La base y Auth tienen que ser del mismo proyecto. Mezclarlos deja la
 * aplicación leyendo los datos de un sitio y las sesiones de otro: los tokens
 * no valdrían y, peor, un script podría crear usuarios en el proyecto
 * equivocado.
 */
export function exigirCoherencia(variables: Variables, entorno: Entorno): void {
  const { base, api } = refsDe(variables)
  if (base && api && base !== api) {
    throw new Error(
      `${ARCHIVO[entorno]} mezcla dos proyectos: la base es ${base} y Supabase Auth es ${api}. ` +
        'Las dos tienen que ser del mismo proyecto.',
    )
  }
}

/**
 * Corta si el destino es producción. `permitido` es la salida de emergencia,
 * y por eso no basta con una bandera: hay que decir además el entorno.
 */
export function exigirDesarrollo(
  variables: Variables,
  accion: string,
  { permitido = false }: { permitido?: boolean } = {},
): void {
  if (!esProduccion(variables)) return
  if (permitido) return

  throw new Error(
    `${accion} apunta a PRODUCCIÓN (${describirDestino(variables)}), y ahí no se hace.\n` +
      'Lo normal es trabajar contra desarrollo: revisa a qué proyecto apunta .env.local.',
  )
}

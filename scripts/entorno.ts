/**
 * Carga el entorno en los scripts de terminal: Next.js lee `.env.local` solo
 * con `pnpm dev`, pero `tsx` no. Se importa el primero, antes que la conexión.
 *
 * Por defecto carga `.env.local` (desarrollo). Con `--entorno=produccion` (o
 * `ENTORNO=produccion`) carga `.env.produccion.local` y trabaja contra la base
 * de verdad, que es justo lo que hay que escribir a mano para que pase.
 *
 * Las funciones que deciden todo esto están en `entornos.ts`, sin efectos.
 */

import { ARCHIVO, entornoPedido, exigirCoherencia, variablesDe, type Entorno, type Variables } from './entornos'

/** El entorno que se ha cargado. */
export const ENTORNO: Entorno = entornoPedido()

/** Las variables de ese entorno, ya leídas de su archivo. */
export const VARIABLES: Variables = variablesDe(ENTORNO)

exigirCoherencia(VARIABLES, ENTORNO)

process.loadEnvFile(ARCHIVO[ENTORNO])

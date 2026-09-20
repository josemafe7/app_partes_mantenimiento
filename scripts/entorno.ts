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

import { aplicarVariables, entornoPedido, exigirCoherencia, variablesDe, type Entorno, type Variables } from './entornos'

/** El entorno que se ha cargado. */
export const ENTORNO: Entorno = entornoPedido()

/** Las variables de ese entorno, ya leídas de su archivo. */
export const VARIABLES: Variables = variablesDe(ENTORNO)

exigirCoherencia(VARIABLES, ENTORNO)

// Mandan las del archivo, también sobre lo que ya hubiera en la terminal: las
// guardias miran VARIABLES y la conexión usa process.env, y tienen que coincidir.
aplicarVariables(VARIABLES)

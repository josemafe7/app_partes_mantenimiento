/**
 * Deja la base de datos como recién instalada: borra todo y carga los datos de
 * ejemplo. Trabaja sobre la base del entorno de desarrollo (`.env.local`), y
 * se niega a hacerlo contra producción: esto se lleva por delante lo que haya.
 *
 * La salida de emergencia, para cuando de verdad se quiera sembrar la base de
 * verdad, es escribir las dos cosas:
 *
 *   pnpm db:reset --entorno=produccion --si-borrar-produccion
 */

import { ENTORNO, VARIABLES } from './entorno'

import { bd } from '../src/db/cliente'
import { sembrar } from '../src/db/semilla'
import { banderas, describirDestino, exigirDesarrollo } from './entornos'

async function principal() {
  exigirDesarrollo(VARIABLES, 'pnpm db:reset', {
    permitido: ENTORNO === 'produccion' && banderas().has('si-borrar-produccion'),
  })

  console.log(`Reiniciando la base de datos: ${describirDestino(VARIABLES)}…`)
  const inicio = Date.now()
  const resumen = await sembrar({ limpiar: true })
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1)

  console.log(`Datos de ejemplo cargados en ${segundos} s:`)
  console.log(`  ${resumen.clientes} clientes, ${resumen.locales} locales, ${resumen.tecnicos} técnicos`)
  console.log(`  ${resumen.avisos} avisos y ${resumen.partes} partes de trabajo`)
}

principal()
  .catch((error) => {
    console.error(error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  // Sin cerrar el pool, el proceso esperaría a que caducasen las conexiones.
  .finally(() => bd.$client.end())

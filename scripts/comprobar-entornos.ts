/**
 * Dice a qué proyecto de Supabase apunta cada entorno y si de verdad se puede
 * entrar. Es la respuesta rápida a «¿sobre qué base estoy trabajando?», que
 * con dos proyectos iguales por dentro no se ve a simple vista.
 *
 *   pnpm entornos
 *
 * Solo lee: abre una conexión, cuenta filas y la cierra. No escribe nada, así
 * que se puede lanzar contra producción sin miedo.
 */

import postgres from 'postgres'

import { cifrado } from '../src/db/cifrado'
import {
  ARCHIVO,
  describirDestino,
  ENTORNOS,
  esProduccion,
  exigirCoherencia,
  variablesDe,
  type Entorno,
  type Variables,
} from './entornos'

type Recuento = { tabla: string; filas: number }

async function contar(variables: Variables): Promise<Recuento[]> {
  const url = variables.DATABASE_URL ?? ''
  const bd = postgres(url, { ...cifrado(url), max: 1, connect_timeout: 15, idle_timeout: 1 })
  try {
    const [fila] = await bd<Record<string, number>[]>`
      select
        (select count(*) from clientes)::int as clientes,
        (select count(*) from locales)::int as locales,
        (select count(*) from tecnicos)::int as tecnicos,
        (select count(*) from avisos)::int as avisos,
        (select count(*) from partes)::int as partes,
        (select count(*) from movimientos)::int as movimientos,
        (select count(*) from perfiles)::int as perfiles`
    return Object.entries(fila).map(([tabla, filas]) => ({ tabla, filas }))
  } finally {
    await bd.end({ timeout: 2 })
  }
}

async function revisar(entorno: Entorno): Promise<void> {
  console.log(`\n${entorno.toUpperCase()}  (${ARCHIVO[entorno]})`)

  let variables: Variables
  try {
    variables = variablesDe(entorno)
  } catch (error) {
    console.log(`  ${error instanceof Error ? error.message : error}`)
    return
  }

  console.log(`  destino:  ${describirDestino(variables)}`)

  try {
    exigirCoherencia(variables, entorno)
  } catch (error) {
    console.log(`  ¡OJO!     ${error instanceof Error ? error.message : error}`)
  }

  if (entorno === 'desarrollo' && esProduccion(variables)) {
    console.log('  ¡OJO!     .env.local apunta a PRODUCCIÓN. `pnpm dev` estaría escribiendo en los datos de verdad.')
  }

  const secreta = variables.SUPABASE_SECRET_KEY ?? ''
  console.log(`  claves:   SUPABASE_SECRET_KEY ${secreta ? 'puesta' : 'SIN PONER (los usuarios no se podrán crear)'}`)

  try {
    const recuentos = await contar(variables)
    console.log(`  conexión: bien — ${recuentos.map(({ tabla, filas }) => `${filas} ${tabla}`).join(', ')}`)
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : String(error)
    console.log(`  conexión: NO — ${mensaje}`)
    if (mensaje.includes('user not found in the database')) {
      console.log("            (falta «alter role app_avisos with login password '…'» en ese proyecto)")
    }
  }
}

async function principal() {
  console.log('Los dos entornos del proyecto (solo lectura):')
  for (const entorno of ENTORNOS) await revisar(entorno)
  console.log('')
}

principal().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exitCode = 1
})

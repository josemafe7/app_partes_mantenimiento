/**
 * Deja la base de datos como recién instalada: borra todo y carga los datos de
 * ejemplo. Trabaja sobre la base de `DATABASE_URL` (la de Supabase, en
 * `.env.local`), así que se lleva por delante lo que hubiera.
 */

import './entorno'

import { bd } from '../src/db/cliente'
import { sembrar } from '../src/db/semilla'

function servidor(): string {
  try {
    return new URL(process.env.DATABASE_URL ?? '').host
  } catch {
    return '(sin DATABASE_URL)'
  }
}

async function principal() {
  console.log(`Reiniciando la base de datos en ${servidor()}…`)
  const inicio = Date.now()
  const resumen = await sembrar({ limpiar: true })
  const segundos = ((Date.now() - inicio) / 1000).toFixed(1)

  console.log(`Datos de ejemplo cargados en ${segundos} s:`)
  console.log(`  ${resumen.clientes} clientes, ${resumen.locales} locales, ${resumen.tecnicos} técnicos`)
  console.log(`  ${resumen.avisos} avisos y ${resumen.partes} partes de trabajo`)
}

principal()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  // Sin cerrar el pool, el proceso esperaría a que caducasen las conexiones.
  .finally(() => bd.$client.end())

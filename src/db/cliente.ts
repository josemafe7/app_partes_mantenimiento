/**
 * Conexión a la base de datos (PostgreSQL en Supabase).
 *
 * La cadena de conexión llega en `DATABASE_URL` (en `.env.local`): es la del
 * pooler de Supabase en modo sesión, con el rol `app_avisos`, que solo puede
 * leer y escribir filas. Las migraciones no se aplican desde aquí: van por
 * separado (ver `supabase/migrations/`).
 *
 * Se reutiliza la misma conexión en todo el proceso (y se guarda en `globalThis`
 * para que el recargado en caliente de Next no abra un pool nuevo en cada
 * cambio). Las pruebas dejan ahí una base en memoria antes de importar nada.
 */

import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

import * as esquema from './esquema'

function abrirConexion() {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error(
      'Falta DATABASE_URL: copia .env.example como .env.local y pon la cadena de conexión de Supabase.',
    )
  }

  // Modo sesión (5432) y no modo transacción (6543): postgres.js encadena
  // consultas en la misma conexión, y en modo transacción el pooler suelta la
  // conexión del servidor a mitad de una de ellas. La página se queda cargando
  // para siempre sin ningún error, así que mejor fallar aquí con un aviso claro.
  if (new URL(url).port === '6543') {
    throw new Error(
      'DATABASE_URL usa el puerto 6543 (modo transacción del pooler): cámbialo al 5432 (modo sesión).',
    )
  }

  const cliente = postgres(url, {
    max: 10,
    // Suelta las conexiones que llevan un rato sin usarse.
    idle_timeout: 20,
    connect_timeout: 15,
  })
  return drizzle(cliente, { schema: esquema })
}

type Conexion = ReturnType<typeof abrirConexion>

/**
 * Transacción sobre esta conexión, para lo que escribe en varias tablas a la vez.
 *
 * El callback de `bd.transaction` es `async` y cada consulta de dentro lleva
 * su `await`: una consulta sin esperar se ejecutaría fuera de la transacción,
 * o después de que termine.
 */
export type Transaccion = Parameters<Parameters<Conexion['transaction']>[0]>[0]

const almacen = globalThis as unknown as { __bdAvisos?: Conexion }

export const bd: Conexion = almacen.__bdAvisos ?? abrirConexion()

if (process.env.NODE_ENV !== 'production') {
  almacen.__bdAvisos = bd
}

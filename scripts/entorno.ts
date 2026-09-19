/**
 * Carga `.env.local` en los scripts de terminal: Next.js lo hace solo con
 * `pnpm dev`, pero `tsx` no. Se importa el primero, antes que la conexión.
 */

import { existsSync } from 'node:fs'

if (existsSync('.env.local')) process.loadEnvFile('.env.local')

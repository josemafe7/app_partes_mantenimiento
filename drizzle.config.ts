import type { Config } from 'drizzle-kit'

/**
 * `pnpm db:generar` compara `src/db/esquema.ts` con la última instantánea y
 * escribe la migración SQL en `supabase/migrations/`, con el prefijo de fecha
 * que espera Supabase. No necesita conexión: aplicar la migración al proyecto
 * es un paso aparte (conector de Supabase, `supabase db push` o el editor SQL).
 */
export default {
  schema: './src/db/esquema.ts',
  out: './supabase/migrations',
  dialect: 'postgresql',
  migrations: {
    prefix: 'supabase',
  },
} satisfies Config

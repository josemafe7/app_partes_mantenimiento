/**
 * La base de datos del modo local: un Postgres de verdad (PGlite, compilado a
 * WebAssembly) guardado en `.datos/`, con las mismas migraciones de
 * `supabase/migrations/` y los mismos datos de ejemplo de `semilla.ts`.
 *
 * Es el mismo planteamiento que usan las pruebas (`tests/ayudas/base.ts`), con
 * dos diferencias: aquí la base se guarda en disco en vez de en memoria, y
 * además guarda las cuentas, porque en local no hay Supabase Auth
 * (`src/lib/supabase/authLocal.ts` las usa).
 *
 * Todo esto solo existe cuando `esModoLocal()` dice que sí, y el paquete de
 * PGlite se carga con un `import()` dentro de la preparación: en una
 * compilación de producción no se importa nunca, ni siquiera para resolverlo.
 *
 * ## La preparación y la barrera
 *
 * `bd` se exporta de forma síncrona (`src/db/cliente.ts`), pero abrir Postgres,
 * aplicar las migraciones y sembrar es asíncrono. Así que `abrirBaseLocal()`
 * devuelve la conexión enseguida y pone una barrera delante del cliente: cada
 * consulta espera a que la preparación termine. Como la siembra son consultas
 * más (y pasan por `bd`), se marcan con un `AsyncLocalStorage` para que crucen
 * la barrera en vez de esperarse a sí mismas.
 */

import { AsyncLocalStorage } from 'node:async_hooks'
import { randomBytes, randomUUID, scrypt, timingSafeEqual } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { and, eq, isNull, sql } from 'drizzle-orm'
import { boolean, pgSchema, text, uuid } from 'drizzle-orm/pg-core'
import { drizzle } from 'drizzle-orm/pglite'

import type { PGlite } from '@electric-sql/pglite'

import { CARPETA_DATOS, CONTRASENA_LOCAL, USUARIOS_LOCALES } from '@/lib/modoLocal'

import { bd } from './cliente'
import * as esquema from './esquema'
import { perfiles, tecnicos } from './esquema'

/* ------------------------------------------------------------- Las cuentas */

/**
 * Las cuentas del modo local: lo que en la aplicación de verdad vive en
 * Supabase Auth. Van en el esquema `auth` y no en `public` para que se note que
 * no son parte del modelo de datos: ninguna migración las conoce, no salen en
 * `pnpm db:generar` y en Supabase no existen.
 */
const auth = pgSchema('auth')

export const cuentasLocales = auth.table('cuentas_locales', {
  id: uuid('id').primaryKey(),
  email: text('email').notNull().unique(),
  /** `sal:derivada`, en hexadecimal (scrypt). Nunca la contraseña en claro. */
  contrasena: text('contrasena').notNull(),
  /** Lo que en Supabase hace `ban_duration`: la cuenta existe pero no entra. */
  bloqueada: boolean('bloqueada').notNull().default(false),
})

/* -------------------------------------------------------------- Contraseñas */

const LONGITUD_CLAVE = 64

function derivar(contrasena: string, sal: string): Promise<Buffer> {
  return new Promise((cumplir, fallar) => {
    scrypt(contrasena, sal, LONGITUD_CLAVE, (error, clave) => (error ? fallar(error) : cumplir(clave)))
  })
}

/** Guarda la contraseña como `sal:derivada`, nunca en claro (aunque sea local). */
export async function cifrarContrasena(contrasena: string): Promise<string> {
  const sal = randomBytes(16).toString('hex')
  return `${sal}:${(await derivar(contrasena, sal)).toString('hex')}`
}

/** Comparación en tiempo constante, para no filtrar la contraseña por lo que tarda. */
export async function contrasenaCorrecta(contrasena: string, guardada: string): Promise<boolean> {
  const [sal, esperada] = guardada.split(':')
  if (!sal || !esperada) return false
  const calculada = await derivar(contrasena, sal)
  const referencia = Buffer.from(esperada, 'hex')
  if (referencia.length !== calculada.length) return false
  return timingSafeEqual(referencia, calculada)
}

/* -------------------------------------------------------- Abrir la conexión */

/** Marca las consultas de la propia preparación, que no pueden esperarse a sí mismas. */
const preparando = new AsyncLocalStorage<true>()

/**
 * Abre la base de `.datos/` y devuelve la conexión de Drizzle. No espera: la
 * preparación va por detrás y la barrera hace esperar a la primera consulta,
 * que es justo la primera página que se abra.
 */
export function abrirBaseLocal() {
  const carpeta = join(process.cwd(), CARPETA_DATOS, 'pglite')
  const nueva = !existsSync(carpeta)

  let base: PGlite | null = null
  let fallo: unknown = null

  // La promesa nunca se rechaza (si lo hiciera sin que nadie la espere todavía,
  // Node avisaría de una promesa sin capturar): el error se guarda y lo lanza
  // cada consulta, con su mensaje original.
  const preparacion = (async () => {
    const { PGlite } = await import('@electric-sql/pglite')
    // PGlite crea su carpeta, pero no la de encima: sin esto falla con un
    // ENOENT la primera vez, cuando `.datos/` todavía no existe.
    mkdirSync(carpeta, { recursive: true })
    base = new PGlite(carpeta)
    await base.waitReady
    await aplicarMigraciones(base)
    await preparando.run(true, () => sembrarSiHaceFalta(nueva))
  })().catch((error: unknown) => {
    fallo = error
  })

  async function esperar() {
    if (preparando.getStore()) return
    await preparacion
    if (fallo) throw fallo
  }

  const cliente = {
    query: async (...argumentos: Parameters<PGlite['query']>) => {
      await esperar()
      return base!.query(...argumentos)
    },
    exec: async (...argumentos: Parameters<PGlite['exec']>) => {
      await esperar()
      return base!.exec(...argumentos)
    },
    transaction: async (...argumentos: Parameters<PGlite['transaction']>) => {
      await esperar()
      return base!.transaction(...argumentos)
    },
    close: async () => {
      await preparacion
      await base?.close()
    },
  }

  // Drizzle solo llama a `query()` y a `transaction()`, pero su tipo pide un
  // PGlite entero: el cliente de aquí es ese PGlite con la barrera delante.
  return drizzle(cliente as unknown as PGlite, { schema: esquema })
}

/* ------------------------------------------------------------- Preparación */

/**
 * Aplica las migraciones que falten, en orden, y anota cuáles. Así una
 * migración nueva entra en la base que ya existe sin tener que borrar `.datos/`.
 */
async function aplicarMigraciones(base: PGlite) {
  // Lo que Supabase trae de serie y las migraciones nombran: los roles de la
  // API de datos y la tabla de cuentas de Auth (aquí, solo su id). Y lo que es
  // solo del modo local: las cuentas y el registro de migraciones.
  await base.exec(`
    do $do$ begin
      if not exists (select 1 from pg_roles where rolname = 'anon') then create role anon nologin; end if;
      if not exists (select 1 from pg_roles where rolname = 'authenticated') then create role authenticated nologin; end if;
    end $do$;
    create schema if not exists auth;
    create table if not exists auth.users (id uuid primary key);
    create table if not exists auth.cuentas_locales (
      id uuid primary key references auth.users (id) on delete cascade,
      email text not null unique,
      contrasena text not null,
      bloqueada boolean not null default false
    );
    create table if not exists auth.migraciones_locales (
      archivo text primary key,
      aplicada timestamptz not null default now()
    );
  `)

  const aplicadas = await base.query<{ archivo: string }>('select archivo from auth.migraciones_locales')
  const yaEstan = new Set(aplicadas.rows.map((fila) => fila.archivo))

  const carpeta = join(process.cwd(), 'supabase', 'migrations')
  const pendientes = readdirSync(carpeta)
    .filter((archivo) => archivo.endsWith('.sql') && !yaEstan.has(archivo))
    .sort()

  if (pendientes.length > 0) {
    console.log(`Modo local: preparando la base de datos en ${CARPETA_DATOS}/ (${pendientes.length} migraciones)…`)
  }
  for (const archivo of pendientes) {
    await base.exec(readFileSync(join(carpeta, archivo), 'utf8'))
    await base.query('insert into auth.migraciones_locales (archivo) values ($1)', [archivo])
  }
}

/** Datos de ejemplo y usuarios, solo si la base está vacía. */
async function sembrarSiHaceFalta(nueva: boolean) {
  const [conteo] = await bd.select({ total: sql<number>`count(*)::int` }).from(esquema.clientes)
  if ((conteo?.total ?? 0) === 0) {
    const { sembrar } = await import('./semilla')
    const resumen = await sembrar({ limpiar: false })
    console.log(
      `Modo local: datos de ejemplo cargados (${resumen.clientes} clientes, ${resumen.avisos} avisos, ${resumen.partes} partes).`,
    )
  }

  await crearUsuariosLocales(nueva)
}

/**
 * Un usuario de cada rol, con su cuenta. Se puede repetir: los que ya están se
 * dejan como estén (por si alguien cambió su contraseña desde «Mi cuenta»), y
 * al técnico se le busca ficha si se quedó sin ella al recargar los ejemplos.
 */
async function crearUsuariosLocales(nueva: boolean) {
  const contrasena = await cifrarContrasena(CONTRASENA_LOCAL)
  let creados = 0

  for (const usuario of USUARIOS_LOCALES) {
    const perfil = await bd.query.perfiles.findFirst({ where: eq(perfiles.email, usuario.email) })
    const fichaTecnico = usuario.rol === 'tecnico' ? (perfil?.tecnicoId ?? (await tecnicoLibre())) : null

    if (perfil) {
      // Solo se repara el vínculo con la ficha, que se pierde al recargar los
      // datos de ejemplo (la clave ajena lo deja en nulo). Lo demás es suyo.
      if (perfil.tecnicoId !== fichaTecnico) {
        await bd.update(perfiles).set({ tecnicoId: fichaTecnico }).where(eq(perfiles.id, perfil.id))
      }
      continue
    }

    await bd.execute(sql`insert into auth.users (id) values (${usuario.id}) on conflict do nothing`)
    await bd
      .insert(cuentasLocales)
      .values({ id: usuario.id, email: usuario.email, contrasena })
      .onConflictDoNothing()
    await bd.insert(perfiles).values({
      id: usuario.id,
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.rol,
      tecnicoId: fichaTecnico,
      // Son cuentas de ejemplo con la contraseña escrita en el README: no tiene
      // sentido mandar a cambiarla nada más entrar.
      debeCambiarContrasena: false,
    })
    creados += 1
  }

  if (creados > 0 && nueva) {
    console.log(`Modo local: ${creados} usuarios listos. Entra con ${USUARIOS_LOCALES[0].email} / ${CONTRASENA_LOCAL}`)
  }
}

/** La primera ficha de técnico que no tenga ya usuario, como en `pnpm usuarios:prueba`. */
async function tecnicoLibre(): Promise<number | null> {
  const [libre] = await bd
    .select({ id: tecnicos.id })
    .from(tecnicos)
    .leftJoin(perfiles, eq(perfiles.tecnicoId, tecnicos.id))
    .where(and(eq(tecnicos.archivado, false), isNull(perfiles.id)))
    .orderBy(tecnicos.id)
    .limit(1)
  return libre?.id ?? null
}

/* -------------------------------------------------- Operaciones con cuentas */

export type CuentaLocal = typeof cuentasLocales.$inferSelect

export async function cuentaPorEmail(email: string): Promise<CuentaLocal | null> {
  const [cuenta] = await bd.select().from(cuentasLocales).where(eq(cuentasLocales.email, email)).limit(1)
  return cuenta ?? null
}

export async function cuentaPorId(id: string): Promise<CuentaLocal | null> {
  const [cuenta] = await bd.select().from(cuentasLocales).where(eq(cuentasLocales.id, id)).limit(1)
  return cuenta ?? null
}

/** Crea la cuenta (y su fila en `auth.users`, que es a quien apunta `perfiles`). */
export async function crearCuentaLocal(email: string, contrasena: string): Promise<string> {
  const id = randomUUID()
  const cifrada = await cifrarContrasena(contrasena)
  await bd.transaction(async (tx) => {
    await tx.execute(sql`insert into auth.users (id) values (${id})`)
    await tx.insert(cuentasLocales).values({ id, email, contrasena: cifrada })
  })
  return id
}

export async function borrarCuentaLocal(id: string) {
  // En cascada desde `auth.users`, como en Supabase: se lleva la cuenta y el perfil.
  await bd.execute(sql`delete from auth.users where id = ${id}`)
}

export async function cambiarContrasenaLocal(id: string, contrasena: string) {
  const cifrada = await cifrarContrasena(contrasena)
  await bd.update(cuentasLocales).set({ contrasena: cifrada }).where(eq(cuentasLocales.id, id))
}

export async function bloquearCuentaLocal(id: string, bloqueada: boolean) {
  await bd.update(cuentasLocales).set({ bloqueada }).where(eq(cuentasLocales.id, id))
}

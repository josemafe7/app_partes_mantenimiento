/**
 * La base de datos de las pruebas: un Postgres en memoria (PGlite) con las
 * mismas migraciones de `supabase/migrations/`, así que no se toca Supabase.
 *
 * `src/db/cliente.ts` usa la conexión que encuentre en `globalThis.__bdAvisos`
 * antes de abrir una nueva: `usarBaseEnMemoria()` la deja ahí, y hay que
 * llamarla antes de importar nada de `src/db/` (o de `src/acciones/`, que lo
 * importan). Para las consultas, PGlite y postgres.js se manejan igual.
 */

import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

import { PGlite } from '@electric-sql/pglite'
import { sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/pglite'

import * as esquema from '../../src/db/esquema'
import type { Usuario } from '../../src/lib/permisos'

/** Postgres en memoria con las migraciones del proyecto aplicadas en orden. */
export async function baseEnMemoria(): Promise<PGlite> {
  const pglite = new PGlite()
  // Lo que Supabase trae de serie y nombran las migraciones: los roles de la API
  // de datos y la tabla de cuentas de Supabase Auth (aquí, solo su id).
  await pglite.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    create table auth.users (id uuid primary key);
  `)

  const carpeta = join(process.cwd(), 'supabase', 'migrations')
  const archivos = readdirSync(carpeta)
    .filter((archivo) => archivo.endsWith('.sql'))
    .sort()
  for (const archivo of archivos) {
    await pglite.exec(readFileSync(join(carpeta, archivo), 'utf8'))
  }
  return pglite
}

function conectar(pglite: PGlite) {
  return drizzle(pglite, { schema: esquema })
}

export type BaseDePruebas = ReturnType<typeof conectar>

/** Deja una base en memoria donde la aplicación la va a buscar y la devuelve. */
export async function usarBaseEnMemoria(): Promise<BaseDePruebas> {
  const bd = conectar(await baseEnMemoria())
  const almacen = globalThis as unknown as { __bdAvisos?: unknown }
  almacen.__bdAvisos = bd
  return bd
}

/* ----------------------------------------------------------------- Usuarios */

type DatosCuenta = {
  id: string
  nombre: string
  email: string
  rol: Usuario['rol']
  tecnicoId?: number | null
  activo?: boolean
  debeCambiarContrasena?: boolean
}

/**
 * Una cuenta en `auth.users` (lo que en Supabase crea Auth) con su perfil. Por
 * defecto, activa y con la contraseña ya cambiada: lista para actuar.
 */
export async function crearCuenta(bd: BaseDePruebas, datos: DatosCuenta): Promise<Usuario> {
  await bd.execute(sql`insert into auth.users (id) values (${datos.id})`)
  const [perfil] = await bd
    .insert(esquema.perfiles)
    .values({
      id: datos.id,
      nombre: datos.nombre,
      email: datos.email,
      rol: datos.rol,
      tecnicoId: datos.tecnicoId ?? null,
      activo: datos.activo ?? true,
      debeCambiarContrasena: datos.debeCambiarContrasena ?? false,
    })
    .returning()
  return {
    id: perfil.id,
    nombre: perfil.nombre,
    email: perfil.email,
    rol: perfil.rol,
    tecnicoId: perfil.tecnicoId,
    debeCambiarContrasena: perfil.debeCambiarContrasena,
  }
}

/* ------------------------------------------------------------------- Fichas */

/**
 * Lo mínimo para trabajar con avisos: dos clientes (el primero con dos
 * locales), dos técnicos y un usuario de cada rol. El técnico es Marta.
 */
export async function crearFichas(bd: BaseDePruebas) {
  const [horno, grano] = await bd
    .insert(esquema.clientes)
    .values([{ nombre: 'Panaderías El Horno de Lucía' }, { nombre: 'Cafeterías Grano & Co.' }])
    .returning()
  const [hornoCentro, hornoChamberi, granoSol] = await bd
    .insert(esquema.locales)
    .values([
      { clienteId: horno.id, nombre: 'El Horno — Centro', direccion: 'Calle Mayor 14', ciudad: 'Madrid' },
      { clienteId: horno.id, nombre: 'El Horno — Chamberí', direccion: 'Fuencarral 172', ciudad: 'Madrid' },
      { clienteId: grano.id, nombre: 'Grano — Sol', direccion: 'Puerta del Sol 3', ciudad: 'Madrid' },
    ])
    .returning()
  const [marta, sergio] = await bd
    .insert(esquema.tecnicos)
    .values([
      { nombre: 'Marta', apellidos: 'Ruiz Alcántara', especialidades: ['electricidad'] },
      { nombre: 'Sergio', apellidos: 'Pardo', especialidades: ['fontaneria'] },
    ])
    .returning()

  const administrador = await crearCuenta(bd, {
    id: '00000000-0000-4000-8000-00000000000a',
    nombre: 'Ana Admin',
    email: 'ana@empresa.es',
    rol: 'administrador',
  })
  const oficina = await crearCuenta(bd, {
    id: '00000000-0000-4000-8000-00000000000b',
    nombre: 'Olga Oficina',
    email: 'olga@empresa.es',
    rol: 'oficina',
  })
  const tecnico = await crearCuenta(bd, {
    id: '00000000-0000-4000-8000-00000000000c',
    nombre: 'Marta Ruiz',
    email: 'marta@empresa.es',
    rol: 'tecnico',
    tecnicoId: marta.id,
  })

  return {
    clientes: { horno, grano },
    locales: { hornoCentro, hornoChamberi, granoSol },
    tecnicos: { marta, sergio },
    usuarios: { administrador, oficina, tecnico },
  }
}

export type Fichas = Awaited<ReturnType<typeof crearFichas>>

let numeroAviso = 0

/**
 * Un aviso escrito directamente en la base, sin pasar por las acciones. Lleva
 * una referencia `PR-…` para no mezclarse con la numeración `AV-…` de las altas.
 */
export async function nuevoAviso(
  bd: BaseDePruebas,
  fichas: Fichas,
  cambios: Partial<typeof esquema.avisos.$inferInsert> = {},
) {
  numeroAviso += 1
  const [aviso] = await bd
    .insert(esquema.avisos)
    .values({
      referencia: `PR-${String(numeroAviso).padStart(4, '0')}`,
      clienteId: fichas.clientes.horno.id,
      localId: fichas.locales.hornoCentro.id,
      titulo: 'El horno grande no calienta',
      categoria: 'electricidad',
      prioridad: 'alta',
      estado: 'pendiente',
      canalEntrada: 'telefono',
      ...cambios,
    })
    .returning()
  return aviso
}

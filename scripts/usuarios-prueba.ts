/**
 * Crea en desarrollo un usuario de cada rol, para poder entrar y probar la
 * aplicación con los tres puntos de vista.
 *
 *   pnpm usuarios:prueba              # crea los que falten
 *   pnpm usuarios:prueba --renovar    # además, cambia las contraseñas
 *
 * Se niega a ejecutarse contra producción: estas cuentas son de mentira y no
 * pintan nada en la aplicación de verdad (ahí se usa `pnpm usuarios:admin`).
 *
 * Las contraseñas se generan al azar y se escriben en la terminal. No se
 * piden cambiar al entrar, para que sirvan mientras dure el entorno; si se
 * pierden, `--renovar` da unas nuevas.
 *
 * Es repetible: se puede volver a lanzar después de `pnpm db:reset` o de
 * `pnpm datos:copiar`, que borran los técnicos y dejan suelto al usuario
 * técnico, para que vuelva a quedar enganchado a una ficha.
 */

import { ENTORNO, VARIABLES } from './entorno'

import { createClient } from '@supabase/supabase-js'
import { and, asc, eq, isNull } from 'drizzle-orm'

import { bd } from '../src/db/cliente'
import { perfiles, tecnicos } from '../src/db/esquema'
import { generarContrasenaTemporal } from '../src/lib/contrasenas'
import type { Rol } from '../src/lib/dominio'
import { banderas, describirDestino, exigirDesarrollo } from './entornos'

/** Los tres usuarios de prueba. El dominio `example.com` está reservado: no existe. */
const USUARIOS: readonly { email: string; nombre: string; rol: Rol }[] = [
  { email: 'admin@example.com', nombre: 'Ada Administradora', rol: 'administrador' },
  { email: 'oficina@example.com', nombre: 'Olga Oficina', rol: 'oficina' },
  { email: 'tecnico@example.com', nombre: 'Tomás Técnico', rol: 'tecnico' },
]

type Novedad = { email: string; rol: Rol; contrasena: string | null; nota: string }

/** La primera ficha de técnico que no tenga ya un usuario. */
async function tecnicoLibre(): Promise<number | null> {
  const [libre] = await bd
    .select({ id: tecnicos.id })
    .from(tecnicos)
    .leftJoin(perfiles, eq(perfiles.tecnicoId, tecnicos.id))
    .where(and(eq(tecnicos.archivado, false), isNull(perfiles.id)))
    .orderBy(asc(tecnicos.id))
    .limit(1)
  return libre?.id ?? null
}

async function principal() {
  exigirDesarrollo(VARIABLES, 'pnpm usuarios:prueba')

  const url = process.env.SUPABASE_URL
  const claveSecreta = process.env.SUPABASE_SECRET_KEY
  if (!url || !claveSecreta) {
    throw new Error(`Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en el archivo del entorno de ${ENTORNO}.`)
  }

  const renovar = banderas().has('renovar')
  console.log(`Usuarios de prueba en ${describirDestino(VARIABLES)}…\n`)

  const admin = createClient(url, claveSecreta, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })

  // Una sola lectura de Auth: así el script se puede repetir sin duplicar nada.
  const { data: enAuth, error: errorLista } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 })
  if (errorLista) throw new Error(`Supabase no ha podido listar los usuarios: ${errorLista.message}`)
  const idPorEmail = new Map(enAuth.users.map((usuario) => [usuario.email?.toLowerCase() ?? '', usuario.id]))

  const novedades: Novedad[] = []

  for (const usuario of USUARIOS) {
    const perfil = await bd.query.perfiles.findFirst({ where: eq(perfiles.email, usuario.email) })
    let id = idPorEmail.get(usuario.email)
    let contrasena: string | null = null

    if (!id) {
      contrasena = generarContrasenaTemporal()
      const { data, error } = await admin.auth.admin.createUser({
        email: usuario.email,
        password: contrasena,
        email_confirm: true,
      })
      if (error || !data.user) {
        throw new Error(`Supabase no ha podido crear ${usuario.email}: ${error?.message ?? 'sin respuesta'}`)
      }
      id = data.user.id
    } else if (renovar || !perfil) {
      // Sin perfil, la cuenta de Auth no sirve para entrar y nadie conoce su
      // contraseña: se le pone una nueva.
      contrasena = generarContrasenaTemporal()
      const { error } = await admin.auth.admin.updateUserById(id, { password: contrasena })
      if (error) throw new Error(`Supabase no ha podido cambiar la contraseña de ${usuario.email}: ${error.message}`)
    }

    const fichaTecnico = usuario.rol === 'tecnico' ? (perfil?.tecnicoId ?? (await tecnicoLibre())) : null

    if (perfil) {
      await bd
        .update(perfiles)
        .set({ nombre: usuario.nombre, rol: usuario.rol, tecnicoId: fichaTecnico, activo: true, actualizadoEn: new Date() })
        .where(eq(perfiles.id, perfil.id))
    } else {
      await bd.insert(perfiles).values({
        id,
        nombre: usuario.nombre,
        email: usuario.email,
        rol: usuario.rol,
        tecnicoId: fichaTecnico,
        debeCambiarContrasena: false,
      })
    }

    novedades.push({
      email: usuario.email,
      rol: usuario.rol,
      contrasena,
      nota: perfil ? (contrasena ? 'contraseña nueva' : 'ya existía') : 'creado',
    })
  }

  console.log('Usuario                  Rol             Contraseña')
  console.log('─'.repeat(72))
  for (const novedad of novedades) {
    const contrasena = novedad.contrasena ?? `(la de siempre — ${novedad.nota})`
    console.log(`${novedad.email.padEnd(24)} ${novedad.rol.padEnd(15)} ${contrasena}`)
  }
  console.log('')
  console.log('Las contraseñas no se vuelven a enseñar. Si se pierden: pnpm usuarios:prueba --renovar')
}

principal()
  .catch((error) => {
    console.error(`\n${error instanceof Error ? error.message : error}`)
    process.exitCode = 1
  })
  .finally(() => bd.$client.end())

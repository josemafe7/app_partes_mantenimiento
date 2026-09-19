/**
 * Crea un administrador desde la terminal. Es la forma de dar de alta al
 * primero (los demás usuarios se crean desde la aplicación, en «Usuarios») y
 * la salida de emergencia si alguna vez no queda ningún administrador activo.
 *
 * Uso: pnpm usuarios:admin tu@email.com "Nombre y apellidos"
 *
 * Genera una contraseña temporal y la escribe en la terminal, una sola vez: al
 * entrar con ella, la aplicación obliga a elegir una nueva. Necesita
 * DATABASE_URL, SUPABASE_URL y SUPABASE_SECRET_KEY en `.env.local`.
 */

import './entorno'

import { createClient } from '@supabase/supabase-js'
import { eq } from 'drizzle-orm'

import { bd } from '../src/db/cliente'
import { perfiles } from '../src/db/esquema'
import { generarContrasenaTemporal } from '../src/lib/contrasenas'

async function principal() {
  const [emailEscrito, ...palabras] = process.argv.slice(2)
  const email = emailEscrito?.trim().toLowerCase() ?? ''
  const nombre = palabras.join(' ').trim()

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || !nombre) {
    console.error('Uso: pnpm usuarios:admin tu@email.com "Nombre y apellidos"')
    process.exitCode = 1
    return
  }

  const url = process.env.SUPABASE_URL
  const claveSecreta = process.env.SUPABASE_SECRET_KEY
  if (!url || !claveSecreta) {
    console.error('Faltan SUPABASE_URL o SUPABASE_SECRET_KEY en .env.local (ver README).')
    process.exitCode = 1
    return
  }

  if (await bd.query.perfiles.findFirst({ where: eq(perfiles.email, email) })) {
    console.error(`Ya hay un usuario con el email ${email}. Si ha olvidado la contraseña, otro administrador puede restablecerla.`)
    process.exitCode = 1
    return
  }

  const admin = createClient(url, claveSecreta, {
    auth: { autoRefreshToken: false, persistSession: false, detectSessionInUrl: false },
  })
  const contrasena = generarContrasenaTemporal()
  const { data, error } = await admin.auth.admin.createUser({ email, password: contrasena, email_confirm: true })
  if (error || !data.user) {
    console.error(`Supabase no ha podido crear la cuenta: ${error?.message ?? 'sin respuesta'}`)
    process.exitCode = 1
    return
  }

  try {
    await bd.insert(perfiles).values({
      id: data.user.id,
      nombre,
      email,
      rol: 'administrador',
      debeCambiarContrasena: true,
    })
  } catch (errorPerfil) {
    // Sin perfil la cuenta no sirve: se deshace para poder repetir.
    await admin.auth.admin.deleteUser(data.user.id)
    throw errorPerfil
  }

  console.log('')
  console.log(`Administrador creado: ${nombre} <${email}>`)
  console.log('')
  console.log(`  Contraseña temporal:  ${contrasena}`)
  console.log('')
  console.log('Entra en la aplicación con ella: te pedirá que elijas una tuya.')
  console.log('No se vuelve a mostrar y no se guarda en ningún sitio.')
}

principal()
  .catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
  .finally(() => bd.$client.end())

/**
 * Pruebas del acceso y de los usuarios: quién puede actuar (`src/lib/sesion.ts`,
 * con el perfil leído de la base), la gestión de usuarios
 * (`src/acciones/usuarios.ts`) y el inicio de sesión y el cambio de contraseña
 * (`src/acciones/sesion.ts`), con un Supabase Auth de mentira.
 *
 * Es la parte donde un fallo no se ve: si alguien desactivado sigue actuando o
 * se pueden probar contraseñas sin freno, todo parece funcionar igual.
 */

import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { before, beforeEach, describe, it } from 'node:test'

import { eq } from 'drizzle-orm'

import * as esquema from '../src/db/esquema'
import { SIN_PERMISO } from '../src/lib/acciones'
import { problemaContrasena } from '../src/lib/contrasenas'
import type { Usuario } from '../src/lib/permisos'
import { crearCuenta, crearFichas, usarBaseEnMemoria, type BaseDePruebas, type Fichas } from './ayudas/base'
import {
  clienteAdmin,
  clienteSupabase,
  entrarComo,
  formulario,
  llamadasA,
  redireccion,
  reiniciar,
  servidor,
  supabase,
  sustituirServidor,
} from './ayudas/servidor'

let bd: BaseDePruebas
let fichas: Fichas
let usuarios: typeof import('../src/acciones/usuarios')
let sesion: typeof import('../src/acciones/sesion')

before(async () => {
  bd = await usarBaseEnMemoria()
  sustituirServidor(bd)
  fichas = await crearFichas(bd)
  usuarios = await import('../src/acciones/usuarios')
  sesion = await import('../src/acciones/sesion')
})

beforeEach(() => reiniciar())

/* ---------------------------------------------------------------- Ayudas */

const CONTRASENA = 'Tejado-Verde-2026'
const CREDENCIALES_INCORRECTAS = 'El email o la contraseña no son correctos.'

let numeroCuenta = 0

/** Una persona más, con su perfil y su cuenta en el Supabase de mentira. */
async function otraPersona(datos: Partial<Parameters<typeof crearCuenta>[1]> = {}): Promise<Usuario> {
  numeroCuenta += 1
  const usuario = await crearCuenta(bd, {
    id: `00000000-0000-4000-9000-${String(numeroCuenta).padStart(12, '0')}`,
    nombre: `Persona ${numeroCuenta}`,
    email: `persona${numeroCuenta}@empresa.es`,
    rol: 'oficina',
    ...datos,
  })
  supabase.cuentas.set(usuario.email, { id: usuario.id, contrasena: CONTRASENA })
  return usuario
}

async function perfilDe(id: string) {
  const [perfil] = await bd.select().from(esquema.perfiles).where(eq(esquema.perfiles.id, id))
  return perfil
}

/**
 * Un formulario de alta de usuario que no pasa la validación: sirve para saber
 * si quien lo manda puede gestionar usuarios sin llegar a crear nada.
 */
async function puedeGestionarUsuarios(): Promise<boolean> {
  const resultado = await usuarios.crearUsuario(undefined, formulario({ nombre: '', email: '', rol: '' }))
  return resultado.mensaje !== SIN_PERMISO.mensaje
}

/** Deja las sesiones del usuario válidas desde hace una hora y devuelve ese instante. */
async function sesionesDesdeHaceUnaHora(id: string): Promise<number> {
  const haceUnaHora = new Date(Date.now() - 3_600_000)
  await bd.update(esquema.perfiles).set({ sesionesValidasDesde: haceUnaHora }).where(eq(esquema.perfiles.id, id))
  return haceUnaHora.getTime()
}

/* ------------------------------------------------------- Quién actúa */

describe('quién puede actuar', () => {
  it('un usuario desactivado deja de poder actuar al momento, aunque su token siga valiendo', async () => {
    const admin = await otraPersona({ rol: 'administrador' })
    entrarComo(admin)
    assert.ok(await puedeGestionarUsuarios())

    await bd.update(esquema.perfiles).set({ activo: false }).where(eq(esquema.perfiles.id, admin.id))
    assert.ok(!(await puedeGestionarUsuarios()))
  })

  it('un cambio de rol se nota en la siguiente petición', async () => {
    const admin = await otraPersona({ rol: 'administrador' })
    entrarComo(admin)
    await bd.update(esquema.perfiles).set({ rol: 'oficina' }).where(eq(esquema.perfiles.id, admin.id))
    assert.ok(!(await puedeGestionarUsuarios()))
  })

  it('con la contraseña temporal sin cambiar no puede hacer nada más', async () => {
    const admin = await otraPersona({ rol: 'administrador', debeCambiarContrasena: true })
    entrarComo(admin)
    assert.ok(!(await puedeGestionarUsuarios()))
  })

  it('una sesión abierta antes de anular las sesiones ya no vale; una nueva, sí', async () => {
    const admin = await otraPersona({ rol: 'administrador' })
    await bd
      .update(esquema.perfiles)
      .set({ sesionesValidasDesde: new Date() })
      .where(eq(esquema.perfiles.id, admin.id))

    entrarComo(admin, Date.now() - 3_600_000)
    assert.ok(!(await puedeGestionarUsuarios()))
    entrarComo(admin)
    assert.ok(await puedeGestionarUsuarios())
  })
})

/* ------------------------------------------------------ Alta de usuarios */

describe('alta de usuarios', () => {
  it('el administrador da de alta a alguien con una contraseña temporal que solo se enseña una vez', async () => {
    entrarComo(fichas.usuarios.administrador)
    const resultado = await usuarios.crearUsuario(
      undefined,
      formulario({ nombre: 'Luis Gómez', email: ' Luis.Gomez@Empresa.es ', rol: 'oficina', tecnicoId: '' }),
    )
    assert.equal(resultado.ok, true)
    assert.ok(resultado.secreto)
    assert.equal(problemaContrasena(resultado.secreto), null, 'la temporal no cumple las reglas')
    assert.ok(!JSON.stringify(resultado.valores).includes(resultado.secreto), 'la contraseña va también en valores')

    const cuenta = supabase.cuentas.get('luis.gomez@empresa.es')
    assert.ok(cuenta, 'no se ha creado la cuenta en Supabase (o no con el email en minúsculas)')
    assert.equal(cuenta.contrasena, resultado.secreto)
    const perfil = await perfilDe(cuenta.id)
    assert.equal(perfil.rol, 'oficina')
    assert.equal(perfil.debeCambiarContrasena, true)
  })

  it('la oficina no da de alta usuarios', async () => {
    entrarComo(fichas.usuarios.oficina)
    const resultado = await usuarios.crearUsuario(
      undefined,
      formulario({ nombre: 'Luis', email: 'luis@empresa.es', rol: 'administrador', tecnicoId: '' }),
    )
    assert.deepEqual(resultado, SIN_PERMISO)
    assert.equal(llamadasA('createUser').length, 0)
  })

  it('no repite email ni vincula una ficha ocupada o archivada', async () => {
    const [archivada] = await bd
      .insert(esquema.tecnicos)
      .values({ nombre: 'Jubilado', especialidades: ['pintura'], archivado: true })
      .returning()
    entrarComo(fichas.usuarios.administrador)
    const alta = (email: string, rol: string, tecnicoId: number | '') =>
      usuarios.crearUsuario(undefined, formulario({ nombre: 'Luis', email, rol, tecnicoId }))

    assert.equal((await alta('OLGA@empresa.es', 'oficina', '')).errores?.email, 'Ya hay un usuario con este email')
    assert.equal(
      (await alta('luis@empresa.es', 'tecnico', fichas.tecnicos.marta.id)).errores?.tecnicoId,
      'Esa ficha ya está vinculada a otro usuario',
    )
    assert.equal(
      (await alta('luis@empresa.es', 'tecnico', archivada.id)).errores?.tecnicoId,
      'Esa ficha de técnico no existe o está archivada',
    )
    assert.equal(llamadasA('createUser').length, 0)
  })

  it('si Supabase ya tiene una cuenta con ese email, lo dice en el email', async () => {
    supabase.cuentas.set('huerfana@empresa.es', { id: randomUUID(), contrasena: CONTRASENA })
    entrarComo(fichas.usuarios.administrador)
    const resultado = await usuarios.crearUsuario(
      undefined,
      formulario({ nombre: 'Huérfana', email: 'huerfana@empresa.es', rol: 'oficina', tecnicoId: '' }),
    )
    assert.equal(resultado.errores?.email, 'Ya hay una cuenta de Supabase con este email')
  })

  it('si el perfil no se puede guardar, se borra la cuenta de Supabase para poder repetir', async (t) => {
    // Supabase devuelve una cuenta que no está en auth.users: el perfil falla.
    const perdida = randomUUID()
    t.mock.method(clienteAdmin.auth.admin, 'createUser', async () => ({ data: { user: { id: perdida } }, error: null }))
    entrarComo(fichas.usuarios.administrador)
    await assert.rejects(
      usuarios.crearUsuario(undefined, formulario({ nombre: 'Rosa', email: 'rosa@empresa.es', rol: 'oficina', tecnicoId: '' })),
    )
    assert.deepEqual(llamadasA('deleteUser'), [{ id: perdida }])
  })
})

/* ---------------------------------------------------- Cambios de usuarios */

describe('cambios de usuarios', () => {
  const cambio = (usuario: Usuario, rol: string, tecnicoId: number | '' = '') =>
    formulario({ id: usuario.id, nombre: usuario.nombre, rol, tecnicoId })

  it('nadie se cambia su propio rol', async () => {
    const admin = await otraPersona({ rol: 'administrador' })
    entrarComo(admin)
    const resultado = await usuarios.actualizarUsuario(undefined, cambio(admin, 'oficina'))
    assert.match(resultado.errores?.rol ?? '', /No puedes cambiar tu propio rol/)
    assert.equal((await perfilDe(admin.id)).rol, 'administrador')

    // Su nombre sí.
    const nombre = formulario({ id: admin.id, nombre: 'Nombre nuevo', rol: 'administrador', tecnicoId: '' })
    assert.equal(await redireccion(usuarios.actualizarUsuario(undefined, nombre)), '/usuarios')
    assert.equal((await perfilDe(admin.id)).nombre, 'Nombre nuevo')
  })

  it('un técnico va con su ficha, y una ficha no la comparten dos usuarios', async () => {
    const [ficha] = await bd.insert(esquema.tecnicos).values({ nombre: 'Rubén', especialidades: ['pintura'] }).returning()
    const primera = await otraPersona()
    const segunda = await otraPersona()
    entrarComo(fichas.usuarios.administrador)

    assert.ok((await usuarios.actualizarUsuario(undefined, cambio(primera, 'tecnico'))).errores?.tecnicoId)
    await redireccion(usuarios.actualizarUsuario(undefined, cambio(primera, 'tecnico', ficha.id)))
    assert.equal((await perfilDe(primera.id)).tecnicoId, ficha.id)

    const repetida = await usuarios.actualizarUsuario(undefined, cambio(segunda, 'tecnico', ficha.id))
    assert.equal(repetida.errores?.tecnicoId, 'Esa ficha ya está vinculada a otro usuario')
    assert.equal((await perfilDe(segunda.id)).rol, 'oficina')
  })

  it('la oficina no cambia usuarios', async () => {
    const persona = await otraPersona()
    entrarComo(fichas.usuarios.oficina)
    assert.deepEqual(await usuarios.actualizarUsuario(undefined, cambio(persona, 'administrador')), SIN_PERMISO)
    assert.equal((await perfilDe(persona.id)).rol, 'oficina')
  })
})

/* ------------------------------------------- Restablecer y desactivar */

describe('restablecer la contraseña', () => {
  it('le da una temporal nueva, le obliga a cambiarla y anula sus sesiones abiertas', async () => {
    const persona = await otraPersona()
    const antes = await sesionesDesdeHaceUnaHora(persona.id)
    entrarComo(fichas.usuarios.administrador)

    const resultado = await usuarios.restablecerContrasena(undefined, formulario({ id: persona.id }))
    assert.equal(resultado.ok, true)
    assert.ok(resultado.secreto)
    assert.equal(supabase.cuentas.get(persona.email)?.contrasena, resultado.secreto)

    const perfil = await perfilDe(persona.id)
    assert.equal(perfil.debeCambiarContrasena, true)
    assert.ok(perfil.sesionesValidasDesde.getTime() > antes, 'las sesiones abiertas siguen valiendo')
  })

  it('la suya no: la propia se cambia desde «Mi cuenta»', async () => {
    entrarComo(fichas.usuarios.administrador)
    const resultado = await usuarios.restablecerContrasena(undefined, formulario({ id: fichas.usuarios.administrador.id }))
    assert.equal(resultado.ok, false)
    assert.equal(llamadasA('updateUserById').length, 0)
  })

  it('si Supabase no la cambia, el perfil no se toca', async (t) => {
    const persona = await otraPersona()
    t.mock.method(clienteAdmin.auth.admin, 'updateUserById', async () => ({
      data: { user: null },
      error: { status: 500, code: 'unexpected_failure', message: '' },
    }))
    entrarComo(fichas.usuarios.administrador)
    const resultado = await usuarios.restablecerContrasena(undefined, formulario({ id: persona.id }))
    assert.equal(resultado.ok, false)
    assert.equal(resultado.secreto, undefined)
    assert.equal((await perfilDe(persona.id)).debeCambiarContrasena, false)
  })
})

describe('desactivar usuarios', () => {
  it('desactivado, deja de poder actuar y queda bloqueado en Supabase; reactivado, vuelve', async () => {
    const admin = await otraPersona({ rol: 'administrador' })
    entrarComo(fichas.usuarios.administrador)
    const alternar = () => usuarios.alternarActivoUsuario(undefined, formulario({ id: admin.id }))

    assert.deepEqual(await alternar(), { ok: true, mensaje: 'Usuario desactivado.' })
    assert.equal((await perfilDe(admin.id)).activo, false)
    assert.deepEqual(llamadasA('updateUserById').at(-1), { id: admin.id, ban_duration: '876000h' })

    entrarComo(admin)
    assert.ok(!(await puedeGestionarUsuarios()), 'sigue actuando después de desactivarlo')

    entrarComo(fichas.usuarios.administrador)
    assert.deepEqual(await alternar(), { ok: true, mensaje: 'Usuario reactivado.' })
    assert.equal((await perfilDe(admin.id)).activo, true)
    assert.deepEqual(llamadasA('updateUserById').at(-1), { id: admin.id, ban_duration: 'none' })
  })

  it('nadie se desactiva a sí mismo', async () => {
    entrarComo(fichas.usuarios.administrador)
    const resultado = await usuarios.alternarActivoUsuario(undefined, formulario({ id: fichas.usuarios.administrador.id }))
    assert.deepEqual(resultado, { ok: false, mensaje: 'No puedes desactivar tu propio usuario.' })
    assert.equal((await perfilDe(fichas.usuarios.administrador.id)).activo, true)
  })

  it('si Supabase no levanta el bloqueo, sigue desactivado', async (t) => {
    const persona = await otraPersona({ activo: false })
    t.mock.method(clienteAdmin.auth.admin, 'updateUserById', async () => ({
      data: { user: null },
      error: { status: 500, code: 'unexpected_failure', message: '' },
    }))
    entrarComo(fichas.usuarios.administrador)
    const resultado = await usuarios.alternarActivoUsuario(undefined, formulario({ id: persona.id }))
    assert.equal(resultado.ok, false)
    assert.equal((await perfilDe(persona.id)).activo, false)
  })
})

/* ------------------------------------------------------ Inicio de sesión */

describe('inicio de sesión', () => {
  let ip = 0
  // Cada prueba entra desde su propia IP: los fallos se cuentan también por IP.
  beforeEach(() => {
    ip += 1
    servidor.ip = `198.51.100.${ip}`
  })

  const entrar = (email: string, contrasena: string, siguiente = '') =>
    sesion.iniciarSesion(undefined, formulario({ email, contrasena, siguiente }))

  async function intentos(email: string) {
    return bd.select().from(esquema.intentosAcceso).where(eq(esquema.intentosAcceso.email, email))
  }

  it('sin email o sin contraseña lo dice en cada campo, sin preguntar a Supabase', async () => {
    const resultado = await entrar('  ', '')
    assert.deepEqual(Object.keys(resultado.errores ?? {}).sort(), ['contrasena', 'email'])
    assert.equal(llamadasA('signInWithPassword').length, 0)
  })

  it('con las credenciales buenas entra y vuelve a donde iba, pero nunca a otra web', async () => {
    const persona = await otraPersona()
    assert.equal(await redireccion(entrar(` ${persona.email.toUpperCase()} `, CONTRASENA, '/avisos/3?vista=hoy')), '/avisos/3?vista=hoy')
    assert.ok((await perfilDe(persona.id)).ultimoAcceso, 'no se ha anotado el último acceso')
    assert.equal(await redireccion(entrar(persona.email, CONTRASENA, 'https://otra-web.com')), '/')
  })

  it('con la contraseña temporal, lo primero es cambiarla', async () => {
    const persona = await otraPersona({ debeCambiarContrasena: true })
    assert.equal(await redireccion(entrar(persona.email, CONTRASENA, '/avisos')), '/cambiar-contrasena')
  })

  it('el mismo mensaje si el email no existe, si la contraseña está mal o si está desactivado', async () => {
    const persona = await otraPersona()
    const desactivada = await otraPersona({ activo: false })

    for (const [email, contrasena] of [
      ['nadie@empresa.es', CONTRASENA],
      [persona.email, 'Otra-Contrasena-1'],
      [desactivada.email, CONTRASENA],
    ]) {
      const resultado = await entrar(email, contrasena)
      assert.equal(resultado.mensaje, CREDENCIALES_INCORRECTAS, email)
      assert.deepEqual(resultado.valores, { email }, 'la contraseña vuelve al navegador')
    }
    // Supabase dejó entrar a la desactivada: se cierra esa sesión en el acto.
    assert.deepEqual(llamadasA('signOut'), [{ scope: 'local' }])
    assert.equal(servidor.claims, null)
  })

  it('tras cinco fallos con un email espera, aunque acierte, y ya ni pregunta a Supabase', async () => {
    const persona = await otraPersona()
    for (let i = 0; i < 5; i++) await entrar(persona.email, 'Mal-Escrita-2026')
    assert.equal((await intentos(persona.email)).filter((intento) => !intento.exito).length, 5)

    const bloqueado = await entrar(persona.email, CONTRASENA)
    assert.match(bloqueado.mensaje ?? '', /Demasiados intentos fallidos/)
    assert.equal(llamadasA('signInWithPassword').length, 5)

    // Desde la misma IP, otra persona sí entra (el freno por IP pide más fallos).
    const otra = await otraPersona()
    await redireccion(entrar(otra.email, CONTRASENA))
  })

  it('un acceso correcto borra los fallos anteriores de ese email', async () => {
    const persona = await otraPersona()
    for (let i = 0; i < 4; i++) await entrar(persona.email, 'Mal-Escrita-2026')
    await redireccion(entrar(persona.email, CONTRASENA))
    for (let i = 0; i < 4; i++) await entrar(persona.email, 'Mal-Escrita-2026')
    await redireccion(entrar(persona.email, CONTRASENA))
  })

  it('muchos fallos desde una misma IP la frenan, con cualquier email', async () => {
    for (let i = 0; i < 20; i++) await entrar(`prueba${i}@otra-web.com`, 'Mal-Escrita-2026')
    const persona = await otraPersona()
    assert.match((await entrar(persona.email, CONTRASENA)).mensaje ?? '', /Demasiados intentos fallidos/)

    servidor.ip = '192.0.2.1'
    await redireccion(entrar(persona.email, CONTRASENA))
  })

  it('si Supabase falla, no es culpa de quien entra: no cuenta como intento', async (t) => {
    const persona = await otraPersona()
    let status: number | undefined
    t.mock.method(clienteSupabase.auth, 'signInWithPassword', async () => ({
      data: { user: null, session: null },
      error: { status, code: 'unexpected_failure', message: '' },
    }))
    // Caído, con límite de peticiones o sin respuesta (error de red, sin status).
    for (status of [500, 429, undefined]) {
      const resultado = await entrar(persona.email, CONTRASENA)
      assert.match(resultado.mensaje ?? '', /Ahora mismo no se puede iniciar sesión/, `status ${status}`)
    }
    assert.equal((await intentos(persona.email)).length, 0)
  })

  it('cerrar sesión cierra solo la de este dispositivo', async () => {
    const persona = await otraPersona()
    entrarComo(persona)
    assert.equal(await redireccion(sesion.cerrarSesion()), '/login')
    assert.deepEqual(llamadasA('signOut'), [{ scope: 'local' }])
  })
})

/* ---------------------------------------------------- Cambiar contraseña */

describe('cambiar la contraseña', () => {
  const NUEVA = 'Ventana-Azul-2027'
  const cambiar = (campos: Record<string, string>) => sesion.cambiarContrasena(undefined, formulario(campos))

  it('con la temporal no pide la actual; al cambiarla cierra las demás sesiones y entra de nuevo', async () => {
    const persona = await otraPersona({ debeCambiarContrasena: true })
    const antes = await sesionesDesdeHaceUnaHora(persona.id)
    entrarComo(persona)

    assert.equal(await redireccion(cambiar({ nueva: NUEVA, repetir: NUEVA })), '/')
    const perfil = await perfilDe(persona.id)
    assert.equal(perfil.debeCambiarContrasena, false)
    assert.ok(perfil.sesionesValidasDesde.getTime() > antes, 'las otras sesiones siguen valiendo')
    assert.equal(supabase.cuentas.get(persona.email)?.contrasena, NUEVA)
    assert.deepEqual(llamadasA('signOut'), [{ scope: 'global' }])
    assert.equal(servidor.claims?.sub, persona.id, 'no ha vuelto a entrar con la nueva')
  })

  it('desde «Mi cuenta» pide la actual, la comprueba y cuenta los fallos', async () => {
    const persona = await otraPersona()
    entrarComo(persona)

    assert.equal((await cambiar({ nueva: NUEVA, repetir: NUEVA })).errores?.actual, 'Escribe tu contraseña actual')
    const mal = await cambiar({ actual: 'No-Es-Esta-2026', nueva: NUEVA, repetir: NUEVA })
    assert.equal(mal.errores?.actual, 'La contraseña actual no es correcta')
    const fallos = await bd.select().from(esquema.intentosAcceso).where(eq(esquema.intentosAcceso.email, persona.email))
    assert.equal(fallos.length, 1)
    assert.equal(supabase.cuentas.get(persona.email)?.contrasena, CONTRASENA)

    const bien = await cambiar({ actual: CONTRASENA, nueva: NUEVA, repetir: NUEVA })
    assert.equal(bien.ok, true)
    assert.equal(supabase.cuentas.get(persona.email)?.contrasena, NUEVA)
  })

  it('no admite una contraseña filtrada ni la misma que ya tenía', async () => {
    const persona = await otraPersona()
    entrarComo(persona)
    servidor.filtradas.add(NUEVA)
    const filtrada = await cambiar({ actual: CONTRASENA, nueva: NUEVA, repetir: NUEVA })
    assert.match(filtrada.errores?.nueva ?? '', /filtraciones de datos/)
    const igual = await cambiar({ actual: CONTRASENA, nueva: CONTRASENA, repetir: CONTRASENA })
    assert.equal(igual.errores?.nueva, 'Tiene que ser distinta de la actual')
    assert.equal(llamadasA('updateUser').length, 0)
  })

  it('sin sesión, al login', async () => {
    assert.equal(await redireccion(cambiar({ nueva: NUEVA, repetir: NUEVA })), '/login?sesion=cerrada')
  })
})

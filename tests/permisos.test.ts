/**
 * Pruebas de los permisos, las contraseñas y la sesión.
 *
 * Es la parte donde un fallo no se ve en pantalla: si una regla deja pasar a
 * quien no debe, todo sigue funcionando, solo que para quien no toca.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import { generarContrasenaTemporal, problemaContrasena } from '../src/lib/contrasenas'
import { ESTADOS, ROLES, type Estado } from '../src/lib/dominio'
import {
  ambitoDe,
  estadosPermitidos,
  PERMISOS,
  puede,
  puedeAnotarParte,
  puedeCambiarEstado,
  puedeEditarParte,
  puedeVerAviso,
  type Permiso,
} from '../src/lib/permisos'
import { momentoDelAcceso, rutaDeVuelta, sesionAnulada } from '../src/lib/sesiones'
import { esquemaUsuario, esquemaUsuarioNuevo } from '../src/lib/validaciones'

const administrador = { rol: 'administrador', tecnicoId: null } as const
const oficina = { rol: 'oficina', tecnicoId: null } as const
const tecnico = { rol: 'tecnico', tecnicoId: 7 } as const
const tecnicoSinFicha = { rol: 'tecnico', tecnicoId: null } as const

const avisoSuyo = (estado: Estado) => ({ tecnicoId: 7, estado })
const avisoAjeno = (estado: Estado) => ({ tecnicoId: 3, estado })

describe('permisos por rol', () => {
  it('cada permiso lo tiene al menos el administrador', () => {
    for (const permiso of Object.keys(PERMISOS) as Permiso[]) {
      assert.ok(puede(administrador, permiso), `el administrador no tiene «${permiso}»`)
    }
  })

  it('la oficina gestiona avisos, clientes y técnicos, pero no borra ni toca usuarios', () => {
    assert.ok(puede(oficina, 'gestionarAvisos'))
    assert.ok(puede(oficina, 'gestionarClientes'))
    assert.ok(puede(oficina, 'gestionarTecnicos'))
    assert.ok(!puede(oficina, 'borrarAvisos'))
    assert.ok(!puede(oficina, 'borrarClientes'))
    assert.ok(!puede(oficina, 'altaTecnicos'))
    assert.ok(!puede(oficina, 'gestionarUsuarios'))
    assert.ok(!puede(oficina, 'cargarDatosEjemplo'))
  })

  it('el técnico solo ve avisos: nada de gestión', () => {
    const suyos = (Object.keys(PERMISOS) as Permiso[]).filter((permiso) => puede(tecnico, permiso))
    assert.deepEqual(suyos, ['verAvisos'])
  })

  it('sin usuario no se puede nada', () => {
    for (const permiso of Object.keys(PERMISOS) as Permiso[]) {
      assert.ok(!puede(null, permiso))
    }
  })

  it('los roles de los permisos son roles que existen', () => {
    for (const roles of Object.values(PERMISOS)) {
      for (const rol of roles) assert.ok((ROLES as readonly string[]).includes(rol))
    }
  })
})

describe('qué avisos ve cada uno', () => {
  it('la oficina ve todos; el técnico, solo los suyos', () => {
    assert.ok(puedeVerAviso(oficina, avisoAjeno('pendiente')))
    assert.ok(puedeVerAviso(tecnico, avisoSuyo('en_curso')))
    assert.ok(!puedeVerAviso(tecnico, avisoAjeno('en_curso')))
    assert.ok(!puedeVerAviso(tecnico, { tecnicoId: null, estado: 'pendiente' }))
  })

  it('un técnico sin ficha vinculada no ve ninguno', () => {
    assert.ok(!puedeVerAviso(tecnicoSinFicha, { tecnicoId: null, estado: 'pendiente' }))
    assert.deepEqual(ambitoDe(tecnicoSinFicha), { tecnicoId: null })
  })

  it('el ámbito de las consultas: todo para la oficina, su ficha para el técnico', () => {
    assert.equal(ambitoDe(administrador), undefined)
    assert.equal(ambitoDe(oficina), undefined)
    assert.deepEqual(ambitoDe(tecnico), { tecnicoId: 7 })
  })
})

describe('cambios de estado', () => {
  it('la oficina puede llevar un aviso a cualquier estado', () => {
    assert.deepEqual(estadosPermitidos(oficina, avisoAjeno('finalizado')), [...ESTADOS])
  })

  it('el técnico mueve sus avisos en marcha a en curso, en espera o finalizado', () => {
    for (const actual of ['asignado', 'en_curso', 'en_espera'] as const) {
      assert.deepEqual(estadosPermitidos(tecnico, avisoSuyo(actual)), ['en_curso', 'en_espera', 'finalizado'])
    }
    assert.ok(!puedeCambiarEstado(tecnico, avisoSuyo('en_curso'), 'cancelado'))
    assert.ok(!puedeCambiarEstado(tecnico, avisoSuyo('en_curso'), 'pendiente'))
    assert.ok(!puedeCambiarEstado(tecnico, avisoSuyo('en_curso'), 'asignado'))
  })

  it('el técnico no reabre lo cerrado ni toca avisos ajenos', () => {
    assert.deepEqual(estadosPermitidos(tecnico, avisoSuyo('finalizado')), [])
    assert.deepEqual(estadosPermitidos(tecnico, avisoSuyo('cancelado')), [])
    assert.deepEqual(estadosPermitidos(tecnico, avisoAjeno('en_curso')), [])
  })
})

describe('partes de trabajo', () => {
  it('el técnico anota partes en sus avisos abiertos', () => {
    assert.ok(puedeAnotarParte(tecnico, avisoSuyo('asignado')))
    assert.ok(!puedeAnotarParte(tecnico, avisoSuyo('finalizado')))
    assert.ok(!puedeAnotarParte(tecnico, avisoAjeno('en_curso')))
    assert.ok(puedeAnotarParte(oficina, avisoAjeno('finalizado')))
  })

  it('el técnico corrige solo sus partes y solo con el aviso abierto', () => {
    assert.ok(puedeEditarParte(tecnico, avisoSuyo('en_curso'), { tecnicoId: 7 }))
    assert.ok(!puedeEditarParte(tecnico, avisoSuyo('en_curso'), { tecnicoId: 3 }))
    assert.ok(!puedeEditarParte(tecnico, avisoSuyo('finalizado'), { tecnicoId: 7 }))
    assert.ok(puedeEditarParte(oficina, avisoAjeno('finalizado'), { tecnicoId: 3 }))
  })
})

describe('contraseñas', () => {
  it('pide longitud y variedad', () => {
    assert.match(problemaContrasena('Corta-1') ?? '', /al menos 12/)
    assert.match(problemaContrasena('todo-minusculas-1') ?? '', /mayúscula/)
    assert.match(problemaContrasena('TODO-MAYUSCULAS-1') ?? '', /minúscula/)
    assert.match(problemaContrasena('Sin-Numeros-Aqui') ?? '', /número/)
    assert.match(problemaContrasena('SinSimbolos12345') ?? '', /símbolo/)
    // Los mismos símbolos que cuenta Supabase: una ñ o un € no bastan.
    assert.match(problemaContrasena('Montaña€Verde2026') ?? '', /símbolo/)
    assert.equal(problemaContrasena('Tejado-Verde-2026'), null)
  })

  it('no admite el email dentro ni caracteres repetidos sin fin', () => {
    assert.match(problemaContrasena('Marta.lopez-2026!', 'marta.lopez@empresa.es') ?? '', /email/)
    assert.match(problemaContrasena('Aaaaaaaaaa-1b') ?? '', /repetir/)
  })

  it('rechaza lo que bcrypt no llegaría a leer (más de 72 bytes)', () => {
    assert.match(problemaContrasena(`Aa1-${'x'.repeat(80)}`) ?? '', /72/)
  })

  it('las temporales cumplen las reglas y no se repiten', () => {
    const generadas = new Set<string>()
    for (let i = 0; i < 200; i++) {
      const contrasena = generarContrasenaTemporal()
      assert.equal(problemaContrasena(contrasena), null, contrasena)
      assert.match(contrasena, /^[A-Za-z2-9]{4}(-[A-Za-z2-9]{4}){3}$/)
      assert.doesNotMatch(contrasena, /[01OIl]/, 'sin caracteres que se confunden')
      generadas.add(contrasena)
    }
    assert.equal(generadas.size, 200)
  })
})

describe('sesión', () => {
  const acceso = Date.UTC(2026, 8, 19, 10, 0, 0) // 19-09-2026 10:00:00
  const claims = { amr: [{ method: 'password', timestamp: acceso / 1000 }] }

  it('el momento del acceso sale de amr, sin contar las renovaciones', () => {
    assert.equal(momentoDelAcceso(claims), acceso)
    assert.equal(
      momentoDelAcceso({ amr: [{ method: 'token_refresh', timestamp: acceso / 1000 + 3600 }, ...claims.amr] }),
      acceso,
    )
    assert.equal(momentoDelAcceso({}), null)
    assert.equal(momentoDelAcceso({ amr: 'no es una lista' }), null)
  })

  it('una sesión abierta antes de restablecer la contraseña ya no vale', () => {
    assert.ok(sesionAnulada(claims, new Date(acceso + 60_000)))
    assert.ok(!sesionAnulada(claims, new Date(acceso - 60_000)))
  })

  it('el segundo del acceso cuenta a favor de la sesión (el token redondea)', () => {
    assert.ok(!sesionAnulada(claims, new Date(acceso + 400)))
    assert.ok(sesionAnulada(claims, new Date(acceso + 1000)))
  })

  it('sin saber cuándo se abrió, la sesión no vale', () => {
    assert.ok(sesionAnulada({}, new Date(0)))
  })

  it('tras el login solo se vuelve a rutas de la propia aplicación', () => {
    assert.equal(rutaDeVuelta('/avisos/12?vista=todos'), '/avisos/12?vista=todos')
    assert.equal(rutaDeVuelta('https://otra-web.com'), '/')
    assert.equal(rutaDeVuelta('//otra-web.com'), '/')
    assert.equal(rutaDeVuelta('/\\otra-web.com'), '/')
    assert.equal(rutaDeVuelta('/login'), '/')
    assert.equal(rutaDeVuelta(undefined), '/')
  })
})

describe('validación de usuarios', () => {
  it('un técnico necesita su ficha', () => {
    const sinFicha = esquemaUsuarioNuevo.safeParse({ nombre: 'Luis', email: 'luis@x.es', rol: 'tecnico', tecnicoId: '' })
    assert.ok(!sinFicha.success)
    const conFicha = esquemaUsuarioNuevo.safeParse({ nombre: 'Luis', email: 'Luis@X.es ', rol: 'tecnico', tecnicoId: '4' })
    assert.ok(conFicha.success)
    assert.equal(conFicha.data.email, 'luis@x.es')
    assert.equal(conFicha.data.tecnicoId, 4)
  })

  it('los demás roles no llevan ficha aunque llegue una', () => {
    const resultado = esquemaUsuario.safeParse({ nombre: 'Ana', rol: 'oficina', tecnicoId: '4' })
    assert.ok(resultado.success)
    assert.equal(resultado.data.tecnicoId, null)
  })

  it('no acepta roles inventados', () => {
    assert.ok(!esquemaUsuario.safeParse({ nombre: 'Ana', rol: 'superusuario', tecnicoId: '' }).success)
  })
})

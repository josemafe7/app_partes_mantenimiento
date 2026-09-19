/**
 * Pruebas de la guardia que separa desarrollo de producción.
 *
 * Aquí lo que falla no da un error raro: borra la base de la aplicación de
 * verdad. `pnpm db:reset` vacía las tablas antes de sembrarlas, así que la
 * única barrera entre un `.env.local` mal apuntado y perder los datos es que
 * `esProduccion` reconozca el proyecto y `exigirDesarrollo` corte.
 */

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'

import {
  argumentosSueltos,
  banderas,
  describirDestino,
  entornoPedido,
  esProduccion,
  exigirCoherencia,
  exigirDesarrollo,
  refDeApi,
  refDeConexion,
  REF_DESARROLLO,
  REF_PRODUCCION,
} from '../scripts/entornos'

const POOLER = 'aws-0-eu-central-1.pooler.supabase.com:5432'

function conexion(ref: string): string {
  return `postgresql://app_avisos.${ref}:secreto@${POOLER}/postgres`
}

function variables(ref: string) {
  return { DATABASE_URL: conexion(ref), SUPABASE_URL: `https://${ref}.supabase.co` }
}

describe('refDeConexion', () => {
  it('saca el proyecto del usuario del pooler', () => {
    assert.equal(refDeConexion(conexion(REF_PRODUCCION)), REF_PRODUCCION)
  })

  it('saca el proyecto de la conexión directa', () => {
    assert.equal(
      refDeConexion(`postgresql://postgres:secreto@db.${REF_DESARROLLO}.supabase.co:5432/postgres`),
      REF_DESARROLLO,
    )
  })

  it('descodifica el usuario antes de partirlo', () => {
    assert.equal(refDeConexion(`postgresql://app%5Favisos.${REF_PRODUCCION}:x@${POOLER}/postgres`), REF_PRODUCCION)
  })

  it('no inventa un proyecto donde no lo hay', () => {
    assert.equal(refDeConexion('postgresql://postgres:secreto@localhost:5432/avisos'), null)
    assert.equal(refDeConexion('no es una url'), null)
    assert.equal(refDeConexion(undefined), null)
  })
})

describe('refDeApi', () => {
  it('saca el proyecto de la URL de Supabase', () => {
    assert.equal(refDeApi(`https://${REF_PRODUCCION}.supabase.co`), REF_PRODUCCION)
  })

  it('no confunde otros dominios', () => {
    assert.equal(refDeApi('https://supabase.co'), null)
    assert.equal(refDeApi('https://ejemplo.com'), null)
    assert.equal(refDeApi(undefined), null)
  })
})

describe('esProduccion', () => {
  it('reconoce producción por la base de datos', () => {
    assert.equal(esProduccion({ DATABASE_URL: conexion(REF_PRODUCCION) }), true)
  })

  it('reconoce producción por Supabase Auth, aunque la base sea otra', () => {
    assert.equal(
      esProduccion({ DATABASE_URL: conexion(REF_DESARROLLO), SUPABASE_URL: `https://${REF_PRODUCCION}.supabase.co` }),
      true,
    )
  })

  it('desarrollo no es producción', () => {
    assert.equal(esProduccion(variables(REF_DESARROLLO)), false)
  })

  it('sin variables no es producción', () => {
    assert.equal(esProduccion({}), false)
  })
})

describe('exigirDesarrollo', () => {
  it('deja pasar desarrollo', () => {
    assert.doesNotThrow(() => exigirDesarrollo(variables(REF_DESARROLLO), 'la prueba'))
  })

  it('corta en producción y dice a dónde apuntaba', () => {
    assert.throws(
      () => exigirDesarrollo(variables(REF_PRODUCCION), 'pnpm db:reset'),
      (error: Error) => error.message.includes('PRODUCCIÓN') && error.message.includes(REF_PRODUCCION),
    )
  })

  it('solo se salta con el permiso expreso', () => {
    assert.doesNotThrow(() => exigirDesarrollo(variables(REF_PRODUCCION), 'pnpm db:reset', { permitido: true }))
  })
})

describe('exigirCoherencia', () => {
  it('acepta la base y Auth del mismo proyecto', () => {
    assert.doesNotThrow(() => exigirCoherencia(variables(REF_DESARROLLO), 'desarrollo'))
  })

  it('no deja mezclar la base de un proyecto con las sesiones de otro', () => {
    assert.throws(
      () =>
        exigirCoherencia(
          { DATABASE_URL: conexion(REF_DESARROLLO), SUPABASE_URL: `https://${REF_PRODUCCION}.supabase.co` },
          'desarrollo',
        ),
      /mezcla dos proyectos/,
    )
  })
})

describe('entornoPedido', () => {
  it('sin decir nada, desarrollo', () => {
    assert.equal(entornoPedido([], {}), 'desarrollo')
  })

  it('se pide por la línea de órdenes', () => {
    assert.equal(entornoPedido(['--entorno=produccion'], {}), 'produccion')
  })

  it('o por la variable ENTORNO', () => {
    assert.equal(entornoPedido([], { ENTORNO: 'produccion' }), 'produccion')
  })

  it('la línea de órdenes manda sobre la variable', () => {
    assert.equal(entornoPedido(['--entorno=desarrollo'], { ENTORNO: 'produccion' }), 'desarrollo')
  })

  it('un entorno que no existe es un error, no un desarrollo por defecto', () => {
    assert.throws(() => entornoPedido(['--entorno=pre'], {}), /Entorno desconocido/)
  })
})

describe('argumentos', () => {
  it('separa las banderas de lo demás', () => {
    const escrito = ['--entorno=produccion', 'ana@ejemplo.com', 'Ana Pérez', '--renovar']
    assert.deepEqual(argumentosSueltos(escrito), ['ana@ejemplo.com', 'Ana Pérez'])
    assert.deepEqual([...banderas(escrito)].sort(), ['entorno', 'renovar'])
  })
})

describe('describirDestino', () => {
  it('canta que es producción', () => {
    assert.match(describirDestino(variables(REF_PRODUCCION)), /PRODUCCIÓN/)
  })

  it('y que el otro no lo es', () => {
    const texto = describirDestino(variables(REF_DESARROLLO))
    assert.match(texto, /desarrollo/)
    assert.doesNotMatch(texto, /PRODUCCIÓN/)
  })
})

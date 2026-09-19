import { ClipboardList, Columns3, Plus, SearchX } from 'lucide-react'
import type { Metadata } from 'next'

import { FiltrosAvisos } from '@/componentes/avisos/FiltrosAvisos'
import { ListaAvisos } from '@/componentes/avisos/ListaAvisos'
import { BotonEnlace } from '@/componentes/ui/Boton'
import { Buscador } from '@/componentes/ui/Buscador'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { listarAvisos } from '@/db/consultas/avisos'
import { clientesParaSelector } from '@/db/consultas/clientes'
import { tecnicosParaSelector } from '@/db/consultas/tecnicos'
import { hayFiltros, leerFiltros, VISTA } from '@/lib/filtros'
import { ambitoDe, esTecnico, puede } from '@/lib/permisos'
import { exigirUsuario } from '@/lib/sesion'
import { plural } from '@/lib/utils'

export const metadata: Metadata = { title: 'Avisos' }

type Props = {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

export default async function PaginaAvisos({ searchParams }: Props) {
  const usuario = await exigirUsuario()
  const filtros = leerFiltros(await searchParams)
  const oficina = puede(usuario, 'gestionarAvisos')

  // El técnico ve solo sus avisos (el ámbito va en la consulta, no en la URL).
  const [avisos, clientes, tecnicos] = await Promise.all([
    listarAvisos(filtros, ambitoDe(usuario)),
    oficina ? clientesParaSelector() : [],
    oficina ? tecnicosParaSelector() : [],
  ])

  const filtrado = hayFiltros(filtros)

  return (
    <>
      <EncabezadoPagina
        titulo={esTecnico(usuario) ? 'Mis avisos' : 'Avisos'}
        descripcion={
          filtros.estado
            ? `${plural(avisos.length, 'aviso', 'avisos')} en este estado`
            : `${plural(avisos.length, 'aviso', 'avisos')} · ${VISTA[filtros.vista].descripcion}`
        }
        acciones={
          oficina ? (
            <>
              <BotonEnlace href="/tablero" variante="secundario">
                <Columns3 className="size-4.5" aria-hidden />
                Tablero
              </BotonEnlace>
              <BotonEnlace href="/avisos/nuevo" className="hidden lg:inline-flex">
                <Plus className="size-4.5" aria-hidden />
                Nuevo aviso
              </BotonEnlace>
            </>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4">
        <Buscador marcador="Buscar por referencia, avería, cliente, local o técnico…" />

        <FiltrosAvisos filtros={filtros} clientes={clientes} tecnicos={tecnicos} soloLosSuyos={!oficina} />

        <Tarjeta className="overflow-hidden">
          {avisos.length > 0 ? (
            <ListaAvisos avisos={avisos} />
          ) : filtrado ? (
            <EstadoVacio
              icono={SearchX}
              titulo="Ningún aviso con estos filtros"
              texto="Prueba a quitar algún filtro o a buscar otra cosa. Los atajos de arriba cambian lo que se está mirando."
              accion={
                <BotonEnlace href="/avisos" variante="secundario">
                  Ver todos los pendientes
                </BotonEnlace>
              }
            />
          ) : oficina ? (
            <EstadoVacio
              icono={ClipboardList}
              titulo="Todavía no hay avisos"
              texto="Cuando entre una llamada o un WhatsApp, regístralo aquí para que deje de vivir en el móvil de alguien."
              accion={
                <BotonEnlace href="/avisos/nuevo">
                  <Plus className="size-4.5" aria-hidden />
                  Registrar el primer aviso
                </BotonEnlace>
              }
            />
          ) : (
            <EstadoVacio
              icono={ClipboardList}
              titulo="No tienes avisos pendientes"
              texto={
                usuario.tecnicoId
                  ? 'Cuando la oficina te asigne un aviso, aparecerá aquí.'
                  : 'Tu usuario no está vinculado a tu ficha de técnico. Pide al administrador que lo vincule.'
              }
            />
          )}
        </Tarjeta>
      </div>
    </>
  )
}

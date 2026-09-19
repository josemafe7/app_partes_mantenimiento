'use client'

import { SlidersHorizontal, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useState, useTransition } from 'react'

import { Boton } from '@/componentes/ui/Boton'
import { Campo, Entrada, Selector } from '@/componentes/ui/Campo'
import {
  OPCIONES_CATEGORIA,
  OPCIONES_ESTADO,
  OPCIONES_PRIORIDAD,
} from '@/lib/dominio'
import { numeroFiltrosDetalle, VISTA, VISTAS, type FiltrosAvisos as Filtros } from '@/lib/filtros'
import { cn } from '@/lib/utils'

type Props = {
  filtros: Filtros
  clientes: { id: number; nombre: string }[]
  tecnicos: { id: number; nombre: string; apellidos: string | null }[]
  /**
   * Quien mira es un técnico: solo ve sus avisos, así que sobran el atajo «sin
   * asignar» y los filtros de técnico y de cliente.
   */
  soloLosSuyos?: boolean
}

export function FiltrosAvisos({ filtros, clientes, tecnicos, soloLosSuyos = false }: Props) {
  const router = useRouter()
  const ruta = usePathname()
  const parametros = useSearchParams()
  const [, iniciarTransicion] = useTransition()

  const detalle = numeroFiltrosDetalle(filtros)
  const [abierto, setAbierto] = useState(detalle > 0)

  function navegar(cambios: Record<string, string>) {
    const siguientes = new URLSearchParams(parametros.toString())
    for (const [clave, valor] of Object.entries(cambios)) {
      if (valor) siguientes.set(clave, valor)
      else siguientes.delete(clave)
    }
    // Al cambiar el estado a mano, el atajo de vista dejaría de tener sentido.
    if ('estado' in cambios && cambios.estado) siguientes.delete('vista')
    const query = siguientes.toString()
    iniciarTransicion(() => router.replace(query ? `${ruta}?${query}` : ruta, { scroll: false }))
  }

  function limpiar() {
    const siguientes = new URLSearchParams()
    if (filtros.q) siguientes.set('q', filtros.q)
    const query = siguientes.toString()
    iniciarTransicion(() => router.replace(query ? `${ruta}?${query}` : ruta, { scroll: false }))
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Atajos */}
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sin-barra sm:mx-0 sm:flex-wrap sm:px-0">
        {VISTAS.filter((vista) => !soloLosSuyos || vista !== 'sin_asignar').map((vista) => {
          const activa = !filtros.estado && filtros.vista === vista
          return (
            <button
              key={vista}
              type="button"
              onClick={() => navegar({ vista: vista === 'abiertos' ? '' : vista, estado: '' })}
              title={VISTA[vista].descripcion}
              aria-pressed={activa}
              className={cn(
                'h-10 shrink-0 rounded-full px-4 text-sm font-medium whitespace-nowrap transition-colors',
                activa
                  ? 'bg-lima-300 text-gris-950'
                  : 'bg-white text-gris-600 ring-1 ring-gris-200/70 ring-inset hover:text-gris-900 hover:ring-gris-300',
              )}
            >
              {VISTA[vista].etiqueta}
            </button>
          )
        })}

        <button
          type="button"
          onClick={() => setAbierto((valor) => !valor)}
          aria-expanded={abierto}
          className={cn(
            'flex h-10 shrink-0 items-center gap-2 rounded-full px-4 text-sm font-medium transition-colors sm:ml-auto',
            detalle > 0 || abierto
              ? 'bg-gris-900 text-white'
              : 'bg-white text-gris-700 ring-1 ring-gris-200/70 ring-inset hover:ring-gris-300',
          )}
        >
          <SlidersHorizontal className="size-4" aria-hidden />
          Filtros
          {detalle > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-lima-300 text-[0.6875rem] font-semibold text-gris-950">
              {detalle}
            </span>
          )}
        </button>
      </div>

      {/* Panel de filtros */}
      {abierto && (
        <div className="rounded-panel bg-white p-5 ring-1 ring-gris-200/70 sm:p-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <Campo etiqueta="Estado" nombre="filtro-estado">
              <Selector
                id="filtro-estado"
                value={filtros.estado}
                onChange={(evento) => navegar({ estado: evento.target.value })}
              >
                <option value="">Cualquier estado</option>
                {OPCIONES_ESTADO.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </Selector>
            </Campo>

            <Campo etiqueta="Prioridad" nombre="filtro-prioridad">
              <Selector
                id="filtro-prioridad"
                value={filtros.prioridad}
                onChange={(evento) => navegar({ prioridad: evento.target.value })}
              >
                <option value="">Cualquier prioridad</option>
                {OPCIONES_PRIORIDAD.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </Selector>
            </Campo>

            <Campo etiqueta="Tipo de trabajo" nombre="filtro-categoria">
              <Selector
                id="filtro-categoria"
                value={filtros.categoria}
                onChange={(evento) => navegar({ categoria: evento.target.value })}
              >
                <option value="">Cualquier tipo</option>
                {OPCIONES_CATEGORIA.map((opcion) => (
                  <option key={opcion.valor} value={opcion.valor}>
                    {opcion.etiqueta}
                  </option>
                ))}
              </Selector>
            </Campo>

            {!soloLosSuyos && (
              <>
                <Campo etiqueta="Técnico" nombre="filtro-tecnico">
                  <Selector
                    id="filtro-tecnico"
                    value={filtros.tecnico}
                    onChange={(evento) => navegar({ tecnico: evento.target.value })}
                  >
                    <option value="">Cualquier técnico</option>
                    <option value="sin">Sin asignar</option>
                    {tecnicos.map((tecnico) => (
                      <option key={tecnico.id} value={String(tecnico.id)}>
                        {tecnico.nombre} {tecnico.apellidos ?? ''}
                      </option>
                    ))}
                  </Selector>
                </Campo>

                <Campo etiqueta="Cliente" nombre="filtro-cliente">
                  <Selector
                    id="filtro-cliente"
                    value={filtros.cliente}
                    onChange={(evento) => navegar({ cliente: evento.target.value })}
                  >
                    <option value="">Cualquier cliente</option>
                    {clientes.map((cliente) => (
                      <option key={cliente.id} value={String(cliente.id)}>
                        {cliente.nombre}
                      </option>
                    ))}
                  </Selector>
                </Campo>
              </>
            )}

            <div className="grid grid-cols-2 gap-3">
              <Campo etiqueta="Prevista desde" nombre="filtro-desde">
                <Entrada
                  id="filtro-desde"
                  type="date"
                  value={filtros.desde}
                  onChange={(evento) => navegar({ desde: evento.target.value })}
                />
              </Campo>
              <Campo etiqueta="Hasta" nombre="filtro-hasta">
                <Entrada
                  id="filtro-hasta"
                  type="date"
                  value={filtros.hasta}
                  onChange={(evento) => navegar({ hasta: evento.target.value })}
                />
              </Campo>
            </div>
          </div>

          {detalle > 0 && (
            <div className="mt-5 flex justify-end border-t border-gris-200/70 pt-4">
              <Boton variante="fantasma" onClick={limpiar}>
                <X className="size-4" aria-hidden />
                Quitar los filtros
              </Boton>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

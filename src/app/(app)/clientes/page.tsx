import { Archive, Building2, Plus, SearchX } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { BotonEnlace } from '@/componentes/ui/Boton'
import { Buscador } from '@/componentes/ui/Buscador'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { ArchivadoEtiqueta, Etiqueta } from '@/componentes/ui/Etiqueta'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { listarClientes } from '@/db/consultas/clientes'
import { cn, inicialesEmpresa, plural } from '@/lib/utils'
import { exigirPermiso } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Clientes' }

type Props = {
  searchParams: Promise<{ q?: string; archivados?: string }>
}

function EtiquetasCliente({ locales, abiertos }: { locales: number; abiertos: number }) {
  return (
    <>
      <Etiqueta clases="bg-gris-50 text-gris-700 ring-gris-200">{plural(locales, 'local', 'locales')}</Etiqueta>
      {abiertos > 0 ? (
        <Etiqueta clases="bg-mantequilla-100 text-mantequilla-800 ring-mantequilla-300" punto="bg-mantequilla-500">
          {plural(abiertos, 'aviso abierto', 'avisos abiertos')}
        </Etiqueta>
      ) : (
        <Etiqueta clases="bg-menta-50 text-menta-800 ring-menta-200">Sin avisos abiertos</Etiqueta>
      )}
    </>
  )
}

export default async function PaginaClientes({ searchParams }: Props) {
  await exigirPermiso('gestionarClientes')
  const { q = '', archivados } = await searchParams
  const verArchivados = archivados === '1'

  const clientes = await listarClientes({ q, incluirArchivados: verArchivados })

  return (
    <>
      <EncabezadoPagina
        titulo="Clientes"
        descripcion={`${plural(clientes.length, 'cliente', 'clientes')}${verArchivados ? ', incluidos los archivados' : ''}`}
        acciones={
          <BotonEnlace href="/clientes/nuevo">
            <Plus className="size-4.5" aria-hidden />
            Nuevo cliente
          </BotonEnlace>
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Buscador marcador="Buscar por nombre, CIF, contacto o teléfono" className="flex-1" />
          <Link
            href={verArchivados ? `/clientes${q ? `?q=${encodeURIComponent(q)}` : ''}` : `/clientes?archivados=1${q ? `&q=${encodeURIComponent(q)}` : ''}`}
            aria-pressed={verArchivados}
            className={cn(
              'inline-flex h-12 shrink-0 items-center justify-center gap-2 rounded-full px-5 text-sm font-medium transition-colors',
              verArchivados
                ? 'bg-lima-300 text-gris-950'
                : 'bg-white text-gris-700 ring-1 ring-gris-200/70 ring-inset hover:ring-gris-300',
            )}
          >
            <Archive className="size-4" aria-hidden />
            {verArchivados ? 'Ocultar archivados' : 'Ver archivados'}
          </Link>
        </div>

        <Tarjeta className="overflow-hidden">
          {clientes.length === 0 ? (
            q ? (
              <EstadoVacio
                icono={SearchX}
                titulo="Ningún cliente con esa búsqueda"
                texto="Prueba con otro nombre, o revisa si está archivado."
              />
            ) : (
              <EstadoVacio
                icono={Building2}
                titulo="Todavía no hay clientes"
                texto="Un cliente es la empresa, y de ella cuelgan sus locales. Los avisos se abren siempre sobre un local."
                accion={
                  <BotonEnlace href="/clientes/nuevo">
                    <Plus className="size-4.5" aria-hidden />
                    Crear el primer cliente
                  </BotonEnlace>
                }
              />
            )
          ) : (
            <ul className="divide-y divide-gris-200/70">
              {clientes.map((cliente) => (
                <li key={cliente.id}>
                  <Link
                    href={`/clientes/${cliente.id}`}
                    className="flex items-center gap-4 px-5 py-4 transition-colors hover:bg-gris-50 sm:px-6"
                  >
                    <span
                      className={cn(
                        'grid size-11 shrink-0 place-items-center rounded-control text-sm font-semibold',
                        cliente.archivado ? 'bg-gris-100 text-gris-500' : 'bg-marca-50 text-marca-800',
                      )}
                      aria-hidden
                    >
                      {inicialesEmpresa(cliente.nombre)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="flex flex-wrap items-center gap-2 font-medium text-gris-950">
                        {cliente.nombre}
                        {cliente.archivado && <ArchivadoEtiqueta />}
                      </p>
                      <p className="mt-0.5 truncate text-sm text-gris-500">
                        {[cliente.personaContacto, cliente.telefono, cliente.cif].filter(Boolean).join(', ') ||
                          'Sin datos de contacto'}
                      </p>
                      {/* En el móvil las etiquetas van debajo; en pantallas anchas, a la derecha */}
                      <div className="mt-2.5 flex flex-wrap gap-1.5 sm:hidden">
                        <EtiquetasCliente locales={cliente.numLocales} abiertos={cliente.numAvisosAbiertos} />
                      </div>
                    </div>
                    <div className="hidden shrink-0 items-center gap-1.5 sm:flex">
                      <EtiquetasCliente locales={cliente.numLocales} abiertos={cliente.numAvisosAbiertos} />
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Tarjeta>
      </div>
    </>
  )
}

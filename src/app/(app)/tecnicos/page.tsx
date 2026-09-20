import { Archive, HardHat, Phone, Plus, SearchX } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { AvatarTecnico } from '@/componentes/avisos/ListaAvisos'
import { BotonEnlace } from '@/componentes/ui/Boton'
import { Buscador } from '@/componentes/ui/Buscador'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { ArchivadoEtiqueta, Etiqueta } from '@/componentes/ui/Etiqueta'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { listarTecnicos } from '@/db/consultas/tecnicos'
import { ESPECIALIDAD, type Especialidad } from '@/lib/dominio'
import { horasTexto } from '@/lib/fechas'
import { cn, plural } from '@/lib/utils'
import { puede } from '@/lib/permisos'
import { exigirPermiso } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Técnicos' }

type Props = {
  searchParams: Promise<{ q?: string; archivados?: string }>
}

export default async function PaginaTecnicos({ searchParams }: Props) {
  const usuario = await exigirPermiso('gestionarTecnicos')
  // Con ?q=a&q=b no llega un texto sino una lista: se trata como búsqueda vacía.
  const parametros = await searchParams
  const q = typeof parametros.q === 'string' ? parametros.q.slice(0, 120) : ''
  const verArchivados = parametros.archivados === '1'

  const tecnicos = await listarTecnicos({ q, incluirArchivados: verArchivados })
  // Dar de alta técnicos es del administrador; la oficina corrige las fichas.
  const puedeDarDeAlta = puede(usuario, 'altaTecnicos')

  return (
    <>
      <EncabezadoPagina
        titulo="Técnicos"
        descripcion={`${plural(tecnicos.length, 'técnico', 'técnicos')}${verArchivados ? ', incluidos los archivados' : ''}`}
        acciones={
          puedeDarDeAlta ? (
            <BotonEnlace href="/tecnicos/nuevo">
              <Plus className="size-4.5" aria-hidden />
              Nuevo técnico
            </BotonEnlace>
          ) : undefined
        }
      />

      <div className="flex flex-col gap-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <Buscador marcador="Buscar por nombre, especialidad o zona" className="flex-1" />
          <Link
            href={
              verArchivados
                ? `/tecnicos${q ? `?q=${encodeURIComponent(q)}` : ''}`
                : `/tecnicos?archivados=1${q ? `&q=${encodeURIComponent(q)}` : ''}`
            }
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

        {tecnicos.length === 0 ? (
          <Tarjeta>
            {q ? (
              <EstadoVacio
                icono={SearchX}
                titulo="Ningún técnico con esa búsqueda"
                texto="Prueba con otro nombre, especialidad o zona."
              />
            ) : (
              <EstadoVacio
                icono={HardHat}
                titulo="Todavía no hay técnicos"
                texto="Da de alta a tu equipo con sus especialidades para poder repartir los avisos."
                accion={
                  puedeDarDeAlta ? (
                    <BotonEnlace href="/tecnicos/nuevo">
                      <Plus className="size-4.5" aria-hidden />
                      Añadir el primer técnico
                    </BotonEnlace>
                  ) : undefined
                }
              />
            )}
          </Tarjeta>
        ) : (
          <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {tecnicos.map((tecnico) => (
              <li key={tecnico.id}>
                <Link
                  href={`/tecnicos/${tecnico.id}`}
                  className={cn(
                    'flex h-full flex-col rounded-panel bg-white p-5 ring-1 ring-gris-200/70 transition-shadow hover:ring-gris-300',
                    tecnico.archivado && 'bg-white/60',
                  )}
                >
                  <div className="flex items-start gap-3.5">
                    <AvatarTecnico
                      nombre={tecnico.nombre}
                      apellidos={tecnico.apellidos}
                      className="size-12 text-base"
                    />
                    <div className="min-w-0 flex-1 pt-0.5">
                      <p className="flex flex-wrap items-center gap-2 font-semibold text-gris-950">
                        {tecnico.nombre} {tecnico.apellidos ?? ''}
                        {tecnico.archivado && <ArchivadoEtiqueta />}
                      </p>
                      <p className="text-sm text-gris-500">{tecnico.zona ? `Zona ${tecnico.zona}` : 'Sin zona fija'}</p>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {tecnico.especialidades.map((especialidad) => (
                      <Etiqueta key={especialidad} clases="bg-gris-50 text-gris-700 ring-gris-200">
                        {ESPECIALIDAD[especialidad as Especialidad].etiqueta}
                      </Etiqueta>
                    ))}
                  </div>

                  {tecnico.telefono && (
                    <p className="mt-4 flex items-center gap-2 text-sm text-gris-600">
                      <Phone className="size-4 text-gris-400" aria-hidden />
                      {tecnico.telefono}
                    </p>
                  )}

                  {/* Carga: las tres cifras que se miran antes de asignar */}
                  <dl className="mt-auto grid grid-cols-3 gap-2 pt-5">
                    <div className="rounded-tarjeta bg-gris-50 px-3 py-2.5">
                      <dt className="text-xs text-gris-500">Abiertos</dt>
                      <dd className="cifra text-xl font-medium text-gris-950">{tecnico.numAvisosAbiertos}</dd>
                    </div>
                    <div
                      className={cn(
                        'rounded-tarjeta px-3 py-2.5',
                        tecnico.avisosHoy > 0 ? 'bg-lavanda-100' : 'bg-gris-50',
                      )}
                    >
                      <dt className="text-xs text-gris-500">Hoy</dt>
                      <dd className="cifra text-xl font-medium text-gris-950">{tecnico.avisosHoy}</dd>
                    </div>
                    <div className="rounded-tarjeta bg-gris-50 px-3 py-2.5">
                      <dt className="text-xs text-gris-500">30 días</dt>
                      <dd className="cifra text-xl font-medium whitespace-nowrap text-gris-950">
                        {horasTexto(tecnico.horasUltimoMes)}
                      </dd>
                    </div>
                  </dl>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

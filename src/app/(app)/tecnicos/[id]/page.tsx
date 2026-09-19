import { CalendarDays, ClipboardList, Mail, NotebookPen, Pencil, Phone } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { alternarArchivadoTecnico, eliminarTecnico } from '@/acciones/tecnicos'
import { AvatarTecnico, ListaAvisosCompacta } from '@/componentes/avisos/ListaAvisos'
import { BotonEnlace } from '@/componentes/ui/Boton'
import { BotonArchivar } from '@/componentes/ui/BotonArchivar'
import { BotonBorrar } from '@/componentes/ui/BotonBorrar'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { ArchivadoEtiqueta, Etiqueta } from '@/componentes/ui/Etiqueta'
import { Seccion, Tarjeta } from '@/componentes/ui/Tarjeta'
import { avisosDe } from '@/db/consultas/avisos'
import { cargaDeTecnico, dependenciasTecnico, obtenerTecnico, ultimosPartesDeTecnico } from '@/db/consultas/tecnicos'
import { ESPECIALIDAD } from '@/lib/dominio'
import { fechaCorta, horasTexto } from '@/lib/fechas'
import { enlaceAvisos } from '@/lib/filtros'
import { plural } from '@/lib/utils'
import { puede } from '@/lib/permisos'
import { exigirPermiso, usuarioActual } from '@/lib/sesion'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (!puede(await usuarioActual(), 'gestionarTecnicos')) return { title: 'Técnico' }
  const tecnico = await obtenerTecnico(Number(id))
  return {
    title: tecnico ? `${tecnico.nombre} ${tecnico.apellidos ?? ''}`.trim() : 'Técnico',
  }
}

export default async function PaginaTecnico({ params }: Props) {
  const usuario = await exigirPermiso('gestionarTecnicos')
  const { id } = await params
  const tecnico = await obtenerTecnico(Number(id))
  if (!tecnico) notFound()

  const [avisos, partes, carga, dependencias] = await Promise.all([
    avisosDe({ tecnicoId: tecnico.id }),
    ultimosPartesDeTecnico(tecnico.id),
    cargaDeTecnico(tecnico.id),
    dependenciasTecnico(tecnico.id),
  ])

  const nombreCompleto = `${tecnico.nombre} ${tecnico.apellidos ?? ''}`.trim()
  const sinHistorial = dependencias.numAvisos === 0 && dependencias.numPartes === 0

  return (
    <>
      <EncabezadoPagina
        titulo={nombreCompleto}
        descripcion={tecnico.zona ? `Zona ${tecnico.zona}` : undefined}
        volver={{ href: '/tecnicos', etiqueta: 'Técnicos' }}
        etiquetas={
          <>
            {tecnico.especialidades.map((especialidad) => (
              <Etiqueta key={especialidad} clases="bg-gris-50 text-gris-700 ring-gris-200">
                {ESPECIALIDAD[especialidad].etiqueta}
              </Etiqueta>
            ))}
            {tecnico.archivado && <ArchivadoEtiqueta />}
          </>
        }
        acciones={
          <>
            <BotonEnlace
              href={enlaceAvisos({ tecnico: String(tecnico.id), vista: 'abiertos' })}
              variante="secundario"
            >
              <ClipboardList className="size-4.5" aria-hidden />
              Sus avisos
            </BotonEnlace>
            <BotonEnlace href={`/tecnicos/${tecnico.id}/editar`} variante="secundario">
              <Pencil className="size-4.5" aria-hidden />
              Modificar
            </BotonEnlace>
            {puede(usuario, 'altaTecnicos') && (
              <>
                <BotonArchivar
                  accion={alternarArchivadoTecnico}
                  id={tecnico.id}
                  archivado={tecnico.archivado}
                  que="técnico"
                />
                <BotonBorrar
                  accion={eliminarTecnico}
                  campos={{ id: tecnico.id }}
                  titulo="Eliminar el técnico"
                  mensaje={
                    sinHistorial
                      ? `Se borrará a ${nombreCompleto}. No tiene avisos ni partes asociados.`
                      : `${nombreCompleto} tiene trabajo registrado. Si ya no colabora, archívalo para que no aparezca al asignar.`
                  }
                  soloIcono
                />
              </>
            )}
          </>
        }
      />

      {/* Carga de trabajo */}
      <dl className="mb-5 grid grid-cols-2 gap-px overflow-hidden rounded-panel bg-gris-200/70 ring-1 ring-gris-200/70 sm:grid-cols-4">
        {[
          { etiqueta: 'Avisos abiertos', valor: String(carga.avisosAbiertos) },
          { etiqueta: 'Finalizados', valor: String(carga.avisosFinalizados) },
          { etiqueta: 'Horas en 30 días', valor: horasTexto(carga.horasUltimoMes) },
          { etiqueta: 'Partes en 30 días', valor: String(carga.partesUltimoMes) },
        ].map((dato) => (
          <div key={dato.etiqueta} className="bg-white px-5 py-4 sm:px-6">
            <dt className="text-sm text-gris-600">{dato.etiqueta}</dt>
            <dd className="cifra mt-2 text-[2.25rem] leading-none font-medium text-gris-950">{dato.valor}</dd>
          </div>
        ))}
      </dl>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          <Seccion titulo="Avisos asignados" descripcion="Los abiertos primero" sinRelleno>
            {avisos.length ? (
              <ListaAvisosCompacta avisos={avisos} />
            ) : (
              <EstadoVacio
                icono={ClipboardList}
                titulo="Sin avisos asignados"
                texto="Cuando se le asigne trabajo, aparecerá en esta lista."
                className="py-10"
              />
            )}
          </Seccion>

          <Seccion titulo="Últimos partes firmados" sinRelleno>
            {partes.length ? (
              <ul className="divide-y divide-gris-200/70">
                {partes.map((parte) => (
                  <li key={parte.id}>
                    <Link
                      href={`/avisos/${parte.avisoId}`}
                      className="block px-5 py-3.5 transition-colors hover:bg-gris-50 sm:px-6"
                    >
                      <div className="flex items-baseline gap-2">
                        <span className="text-sm text-gris-500">{fechaCorta(parte.fecha)}</span>
                        <span className="truncate font-medium text-gris-800">{parte.titulo}</span>
                        <span className="ml-auto shrink-0 text-sm text-gris-500">
                          {horasTexto(parte.horas)}
                        </span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm text-gris-500">
                        {parte.trabajoRealizado}
                      </p>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EstadoVacio
                icono={NotebookPen}
                titulo="Todavía no ha firmado partes"
                className="py-10"
              />
            )}
          </Seccion>
        </div>

        <aside className="flex flex-col gap-5">
          <Tarjeta className="flex flex-col gap-3.5 p-5 text-[0.9375rem] sm:p-6">
            <div className="flex items-center gap-3">
              <AvatarTecnico
                nombre={tecnico.nombre}
                apellidos={tecnico.apellidos}
                className="size-11 text-base"
              />
              <div>
                <p className="font-medium text-gris-900">{nombreCompleto}</p>
                <p className="text-gris-500">
                  {plural(tecnico.especialidades.length, 'especialidad', 'especialidades')}
                </p>
              </div>
            </div>

            {tecnico.telefono && (
              <a
                href={`tel:${tecnico.telefono.replace(/\s/g, '')}`}
                className="flex items-center gap-2.5 text-marca-700 hover:underline"
              >
                <Phone className="size-4 shrink-0 text-gris-400" aria-hidden />
                {tecnico.telefono}
              </a>
            )}

            {tecnico.email && (
              <a
                href={`mailto:${tecnico.email}`}
                className="flex items-center gap-2.5 break-all text-marca-700 hover:underline"
              >
                <Mail className="size-4 shrink-0 text-gris-400" aria-hidden />
                {tecnico.email}
              </a>
            )}

            <Link
              href={`/agenda?tecnico=${tecnico.id}`}
              className="flex items-center gap-2.5 text-marca-700 hover:underline"
            >
              <CalendarDays className="size-4 shrink-0 text-gris-400" aria-hidden />
              Ver su agenda
            </Link>
          </Tarjeta>

          {tecnico.notas && (
            <Seccion titulo="Notas">
              <p className="text-sm leading-relaxed whitespace-pre-line text-gris-700">{tecnico.notas}</p>
            </Seccion>
          )}
        </aside>
      </div>
    </>
  )
}

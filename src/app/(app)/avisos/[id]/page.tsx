import {
  Clock,
  Hourglass,
  MapPin,
  NotebookPen,
  Pencil,
  Phone,
  Plus,
  Printer,
  Store,
} from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { eliminarAviso } from '@/acciones/avisos'
import { CambiarEstado } from '@/componentes/avisos/CambiarEstado'
import { Cronologia } from '@/componentes/avisos/Cronologia'
import { IconoCategoria } from '@/componentes/avisos/IconoCategoria'
import { Referencia } from '@/componentes/avisos/ListaAvisos'
import { PanelAsignacion } from '@/componentes/avisos/PanelAsignacion'
import { ListaPartes } from '@/componentes/partes/ListaPartes'
import { BotonEnlace } from '@/componentes/ui/Boton'
import { BotonBorrar } from '@/componentes/ui/BotonBorrar'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { ArchivadoEtiqueta, Etiqueta, EstadoEtiqueta, PrioridadEtiqueta, RetrasoEtiqueta } from '@/componentes/ui/Etiqueta'
import { Dato, ListaDatos, Seccion, Tarjeta } from '@/componentes/ui/Tarjeta'
import { obtenerAviso } from '@/db/consultas/avisos'
import { tecnicosParaSelector } from '@/db/consultas/tecnicos'
import { CANAL, CATEGORIA, totalHoras } from '@/lib/dominio'
import { diasDeRetraso, fechaCorta, fechaHora, fechaRelativa, horasTexto } from '@/lib/fechas'
import { estadosPermitidos, puede, puedeAnotarParte, puedeEditarParte, puedeVerAviso } from '@/lib/permisos'
import { exigirUsuario, usuarioActual } from '@/lib/sesion'
import { plural } from '@/lib/utils'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const aviso = await obtenerAviso(Number(id))
  // El título tampoco cuenta nada de un aviso que no se puede ver.
  if (!aviso || !puedeVerAviso(await usuarioActual(), aviso)) return { title: 'Aviso' }
  return { title: `${aviso.referencia} · ${aviso.titulo}` }
}

export default async function PaginaAviso({ params }: Props) {
  const usuario = await exigirUsuario()
  const { id } = await params
  const aviso = await obtenerAviso(Number(id))
  // Un aviso de otro técnico se trata como si no existiera.
  if (!aviso || !puedeVerAviso(usuario, aviso)) notFound()

  const oficina = puede(usuario, 'gestionarAvisos')
  const tecnicos = oficina ? await tecnicosParaSelector() : []
  const estados = estadosPermitidos(usuario, aviso)
  const anotarParte = puedeAnotarParte(usuario, aviso)
  const partesEditables = aviso.partes
    .filter((parte) => puedeEditarParte(usuario, aviso, parte))
    .map((parte) => parte.id)

  const retraso = diasDeRetraso(aviso.fechaProgramada)
  const abierto = aviso.estado !== 'finalizado' && aviso.estado !== 'cancelado'
  const horas = totalHoras(aviso.partes)

  return (
    <>
      <EncabezadoPagina
        titulo={aviso.titulo}
        descripcion={`Recibido el ${fechaHora(aviso.fechaAviso)} · ${CANAL[aviso.canalEntrada].etiqueta}`}
        volver={{ href: '/avisos', etiqueta: 'Avisos' }}
        etiquetas={
          <>
            <Referencia className="mr-1">{aviso.referencia}</Referencia>
            <EstadoEtiqueta estado={aviso.estado} />
            <PrioridadEtiqueta prioridad={aviso.prioridad} />
            <Etiqueta clases="bg-white text-gris-700 ring-gris-200">
              <IconoCategoria categoria={aviso.categoria} className="size-3.5 text-gris-500" />
              {CATEGORIA[aviso.categoria].etiqueta}
            </Etiqueta>
            {abierto && <RetrasoEtiqueta dias={retraso} />}
          </>
        }
        acciones={
          <>
            {estados.length > 0 && (
              <CambiarEstado
                avisoId={aviso.id}
                estado={aviso.estado}
                tieneTecnico={Boolean(aviso.tecnicoId)}
                permitidos={estados}
              />
            )}
            {oficina && (
              <BotonEnlace href={`/avisos/${aviso.id}/editar`} variante="secundario">
                <Pencil className="size-4.5" aria-hidden />
                Modificar
              </BotonEnlace>
            )}
            <BotonEnlace
              href={`/avisos/${aviso.id}/imprimir`}
              variante="fantasma"
              tamano="icono"
              aria-label="Imprimir la hoja del aviso"
            >
              <Printer className="size-4.5" aria-hidden />
            </BotonEnlace>
            {puede(usuario, 'borrarAvisos') && (
              <BotonBorrar
                accion={eliminarAviso}
                campos={{ id: aviso.id }}
                titulo="Eliminar el aviso"
                mensaje={
                  aviso.partes.length > 0
                    ? `Se borrará el aviso ${aviso.referencia} junto con sus ${plural(aviso.partes.length, 'parte de trabajo', 'partes de trabajo')} y su cronología. No se puede deshacer.`
                    : `Se borrará el aviso ${aviso.referencia} y su cronología. No se puede deshacer.`
                }
                soloIcono
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        {/* Columna principal */}
        <div className="flex flex-col gap-5">
          <Seccion titulo="La incidencia">
            {aviso.descripcion ? (
              <p className="max-w-[68ch] text-[0.9375rem] leading-relaxed whitespace-pre-line text-gris-800">
                {aviso.descripcion}
              </p>
            ) : (
              <p className="text-sm text-gris-500">Se registró sin descripción.</p>
            )}

            {aviso.estado === 'en_espera' && aviso.motivoEspera && (
              <div className="mt-4 flex gap-3 rounded-tarjeta bg-orquidea-100 px-4 py-3.5 ring-1 ring-orquidea-200 ring-inset">
                <Hourglass className="mt-0.5 size-4.5 shrink-0 text-orquidea-700" aria-hidden />
                <div>
                  <p className="text-sm font-semibold text-orquidea-800">En espera</p>
                  <p className="mt-0.5 text-sm text-orquidea-800">{aviso.motivoEspera}</p>
                </div>
              </div>
            )}

            {aviso.resumenCierre && (
              <div className="mt-4 rounded-tarjeta bg-menta-100 px-4 py-3.5 ring-1 ring-menta-200 ring-inset">
                <p className="text-sm font-semibold text-menta-800">
                  {aviso.estado === 'cancelado' ? 'Motivo de la cancelación' : 'Cómo se resolvió'}
                </p>
                <p className="mt-0.5 text-sm whitespace-pre-line text-menta-800">{aviso.resumenCierre}</p>
                {aviso.fechaCierre && (
                  <p className="mt-1.5 text-xs text-menta-700">
                    Cerrado el {fechaHora(aviso.fechaCierre)}
                  </p>
                )}
              </div>
            )}
          </Seccion>

          <Seccion
            titulo="Partes de trabajo"
            descripcion={
              aviso.partes.length
                ? `${plural(aviso.partes.length, 'visita', 'visitas')} · ${horasTexto(horas)} en total`
                : 'Cada visita del técnico se anota como un parte'
            }
            accion={
              anotarParte ? (
                <BotonEnlace href={`/avisos/${aviso.id}/partes/nuevo`} variante="suave" tamano="sm">
                  <Plus className="size-4" aria-hidden />
                  Añadir
                </BotonEnlace>
              ) : undefined
            }
            sinRelleno
          >
            {aviso.partes.length ? (
              <ListaPartes avisoId={aviso.id} partes={aviso.partes} editables={partesEditables} />
            ) : (
              <EstadoVacio
                icono={NotebookPen}
                titulo="Aún no hay partes de trabajo"
                texto="Cuando el técnico vaya al local, anota aquí qué ha hecho, cuánto ha tardado y qué material ha usado."
                accion={
                  anotarParte ? (
                    <BotonEnlace href={`/avisos/${aviso.id}/partes/nuevo`}>
                      <Plus className="size-4.5" aria-hidden />
                      Anotar el primer parte
                    </BotonEnlace>
                  ) : undefined
                }
                className="py-10"
              />
            )}
          </Seccion>

          <Seccion titulo="Cronología" descripcion="Todo lo que ha pasado con este aviso">
            <Cronologia movimientos={aviso.movimientos} />
          </Seccion>
        </div>

        {/* Columna lateral */}
        <aside className="flex flex-col gap-5">
          {/* Asignar es de la oficina: el técnico ya sabe que el aviso es suyo. */}
          {oficina && (
            <Seccion titulo="Asignación">
              <PanelAsignacion
                avisoId={aviso.id}
                tecnicoId={aviso.tecnicoId}
                fechaProgramada={aviso.fechaProgramada}
                horaProgramada={aviso.horaProgramada}
                categoria={aviso.categoria}
                tecnicos={tecnicos}
              />
            </Seccion>
          )}

          <Seccion
            titulo="Dónde hay que ir"
            accion={
              oficina ? (
                <BotonEnlace href={`/locales/${aviso.local.id}`} variante="fantasma" tamano="sm">
                  Ver local
                </BotonEnlace>
              ) : undefined
            }
          >
            <div className="flex flex-col gap-3 text-[0.9375rem]">
              {oficina ? (
                <Link
                  href={`/clientes/${aviso.cliente.id}`}
                  className="flex items-start gap-2.5 font-medium text-gris-900 hover:text-marca-700"
                >
                  <Store className="mt-0.5 size-4 shrink-0 text-gris-400" aria-hidden />
                  <span>
                    {aviso.cliente.nombre}
                    {aviso.cliente.archivado && <ArchivadoEtiqueta className="ml-2" />}
                  </span>
                </Link>
              ) : (
                <p className="flex items-start gap-2.5 font-medium text-gris-900">
                  <Store className="mt-0.5 size-4 shrink-0 text-gris-400" aria-hidden />
                  {aviso.cliente.nombre}
                </p>
              )}

              <p className="flex items-start gap-2.5 text-gris-700">
                <MapPin className="mt-0.5 size-4 shrink-0 text-gris-400" aria-hidden />
                <span>
                  <span className="font-medium">{aviso.local.nombre}</span>
                  <span className="block text-gris-600">
                    {aviso.local.direccion}, {aviso.local.codigoPostal} {aviso.local.ciudad}
                  </span>
                </span>
              </p>

              {aviso.local.telefono && (
                <a
                  href={`tel:${aviso.local.telefono.replace(/\s/g, '')}`}
                  className="flex h-11 items-center gap-2.5 self-start rounded-full bg-marca-50 pr-4 pl-3.5 font-medium text-marca-800 transition-colors hover:bg-marca-100"
                >
                  <Phone className="size-4 shrink-0" aria-hidden />
                  Llamar al {aviso.local.telefono}
                </a>
              )}

              {aviso.local.horario && (
                <p className="flex items-start gap-2.5 text-gris-600">
                  <Clock className="mt-0.5 size-4 shrink-0 text-gris-400" aria-hidden />
                  {aviso.local.horario}
                </p>
              )}

              {aviso.local.notasAcceso && (
                <p className="rounded-tarjeta bg-mantequilla-50 px-3.5 py-3 text-sm text-mantequilla-800 ring-1 ring-mantequilla-200 ring-inset">
                  <span className="font-semibold">Acceso: </span>
                  {aviso.local.notasAcceso}
                </p>
              )}
            </div>
          </Seccion>

          <Tarjeta className="p-5 sm:p-6">
            <ListaDatos className="sm:grid-cols-1">
              <Dato etiqueta="Quién avisó">{aviso.contactoAviso ?? '—'}</Dato>
              <Dato etiqueta="Entró por">{CANAL[aviso.canalEntrada].etiqueta}</Dato>
              <Dato etiqueta="Fecha prevista">
                {aviso.fechaProgramada ? (
                  <>
                    {fechaCorta(aviso.fechaProgramada)}
                    {aviso.horaProgramada && `, a las ${aviso.horaProgramada}`}
                    {/* «Hoy», «Mañana» o «Ayer» ayudan; repetir la fecha, no */}
                    {fechaRelativa(aviso.fechaProgramada) !== fechaCorta(aviso.fechaProgramada) && (
                      <span className="text-gris-500"> ({fechaRelativa(aviso.fechaProgramada)})</span>
                    )}
                  </>
                ) : (
                  'Sin programar'
                )}
              </Dato>
              <Dato etiqueta="Última modificación">{fechaHora(aviso.actualizadoEn)}</Dato>
            </ListaDatos>
          </Tarjeta>
        </aside>
      </div>
    </>
  )
}

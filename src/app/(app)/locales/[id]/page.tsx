import { ClipboardList, Clock, MapPin, Pencil, Phone, Plus, Store, UserRound } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { alternarArchivadoLocal, eliminarLocal } from '@/acciones/locales'
import { ListaAvisosCompacta } from '@/componentes/avisos/ListaAvisos'
import { BotonEnlace } from '@/componentes/ui/Boton'
import { BotonArchivar } from '@/componentes/ui/BotonArchivar'
import { BotonBorrar } from '@/componentes/ui/BotonBorrar'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { ArchivadoEtiqueta } from '@/componentes/ui/Etiqueta'
import { Seccion, Tarjeta } from '@/componentes/ui/Tarjeta'
import { avisosDe } from '@/db/consultas/avisos'
import { dependenciasLocal, obtenerLocal } from '@/db/consultas/clientes'
import { puede } from '@/lib/permisos'
import { exigirPermiso, usuarioActual } from '@/lib/sesion'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  if (!puede(await usuarioActual(), 'gestionarClientes')) return { title: 'Local' }
  const local = await obtenerLocal(Number(id))
  return { title: local?.nombre ?? 'Local' }
}

export default async function PaginaLocal({ params }: Props) {
  const usuario = await exigirPermiso('gestionarClientes')
  const { id } = await params
  const local = await obtenerLocal(Number(id))
  if (!local) notFound()

  const [avisos, dependencias] = await Promise.all([
    avisosDe({ localId: local.id }),
    dependenciasLocal(local.id),
  ])

  return (
    <>
      <EncabezadoPagina
        titulo={local.nombre}
        descripcion={`${local.direccion}, ${local.codigoPostal ?? ''} ${local.ciudad}`}
        volver={{ href: `/clientes/${local.clienteId}`, etiqueta: local.cliente.nombre }}
        etiquetas={local.archivado ? <ArchivadoEtiqueta /> : undefined}
        acciones={
          <>
            <BotonEnlace href={`/avisos/nuevo?cliente=${local.clienteId}&local=${local.id}`}>
              <Plus className="size-4.5" aria-hidden />
              Nuevo aviso
            </BotonEnlace>
            <BotonEnlace href={`/locales/${local.id}/editar`} variante="secundario">
              <Pencil className="size-4.5" aria-hidden />
              Modificar
            </BotonEnlace>
            <BotonArchivar
              accion={alternarArchivadoLocal}
              id={local.id}
              archivado={local.archivado}
              que="local"
            />
            {puede(usuario, 'borrarClientes') && (
              <BotonBorrar
                accion={eliminarLocal}
                campos={{ id: local.id }}
                titulo="Eliminar el local"
                mensaje={
                  dependencias.numAvisos === 0
                    ? `Se borrará «${local.nombre}». No tiene avisos en el historial.`
                    : `«${local.nombre}» tiene avisos en el historial. Si ya no se trabaja en él, archívalo.`
                }
                soloIcono
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <Seccion
          titulo="Avisos de este local"
          descripcion={avisos.length ? 'Los abiertos primero' : undefined}
          sinRelleno
        >
          {avisos.length ? (
            <ListaAvisosCompacta avisos={avisos} />
          ) : (
            <EstadoVacio
              icono={ClipboardList}
              titulo="Sin avisos todavía"
              texto="Cuando llamen por una avería de este local, quedará registrada aquí."
              accion={
                <BotonEnlace href={`/avisos/nuevo?cliente=${local.clienteId}&local=${local.id}`}>
                  <Plus className="size-4.5" aria-hidden />
                  Registrar un aviso
                </BotonEnlace>
              }
              className="py-10"
            />
          )}
        </Seccion>

        <aside className="flex flex-col gap-5">
          <Tarjeta className="flex flex-col gap-3.5 p-5 text-[0.9375rem] sm:p-6">
            <Link
              href={`/clientes/${local.clienteId}`}
              className="flex items-start gap-2.5 font-medium text-gris-800 hover:text-marca-700"
            >
              <Store className="mt-0.5 size-4 shrink-0 text-gris-400" aria-hidden />
              {local.cliente.nombre}
            </Link>

            <p className="flex items-start gap-2.5 text-gris-700">
              <MapPin className="mt-0.5 size-4 shrink-0 text-gris-400" aria-hidden />
              <span>
                {local.direccion}
                <span className="block text-gris-600">
                  {local.codigoPostal} {local.ciudad}
                  {local.provincia ? ` (${local.provincia})` : ''}
                </span>
              </span>
            </p>

            {local.telefono && (
              <a
                href={`tel:${local.telefono.replace(/\s/g, '')}`}
                className="flex items-center gap-2.5 text-marca-700 hover:underline"
              >
                <Phone className="size-4 shrink-0 text-gris-400" aria-hidden />
                {local.telefono}
              </a>
            )}

            {local.personaContacto && (
              <p className="flex items-center gap-2.5 text-gris-700">
                <UserRound className="size-4 shrink-0 text-gris-400" aria-hidden />
                {local.personaContacto}
              </p>
            )}

            {local.horario && (
              <p className="flex items-start gap-2.5 text-gris-700">
                <Clock className="mt-0.5 size-4 shrink-0 text-gris-400" aria-hidden />
                {local.horario}
              </p>
            )}
          </Tarjeta>

          {local.notasAcceso && (
            <Seccion titulo="Cómo se accede">
              <p className="text-sm leading-relaxed whitespace-pre-line text-gris-700">
                {local.notasAcceso}
              </p>
            </Seccion>
          )}
        </aside>
      </div>
    </>
  )
}

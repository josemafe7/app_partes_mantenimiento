import { ClipboardList, Mail, MapPin, Pencil, Phone, Plus, Store } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { alternarArchivadoCliente, eliminarCliente } from '@/acciones/clientes'
import { ListaAvisosCompacta } from '@/componentes/avisos/ListaAvisos'
import { BotonEnlace } from '@/componentes/ui/Boton'
import { BotonArchivar } from '@/componentes/ui/BotonArchivar'
import { BotonBorrar } from '@/componentes/ui/BotonBorrar'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { ArchivadoEtiqueta, Etiqueta } from '@/componentes/ui/Etiqueta'
import { Dato, ListaDatos, Seccion, Tarjeta } from '@/componentes/ui/Tarjeta'
import { avisosDe } from '@/db/consultas/avisos'
import { dependenciasCliente, localesDeCliente, obtenerCliente } from '@/db/consultas/clientes'
import { enlaceAvisos } from '@/lib/filtros'
import { plural } from '@/lib/utils'
import { puede } from '@/lib/permisos'
import { exigirPermiso, usuarioActual } from '@/lib/sesion'

type Props = { params: Promise<{ id: string }> }

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  // El título tampoco cuenta nada a quien no puede ver la ficha.
  if (!puede(await usuarioActual(), 'gestionarClientes')) return { title: 'Cliente' }
  const cliente = await obtenerCliente(Number(id))
  return { title: cliente?.nombre ?? 'Cliente' }
}

export default async function PaginaCliente({ params }: Props) {
  const usuario = await exigirPermiso('gestionarClientes')
  const { id } = await params
  const cliente = await obtenerCliente(Number(id))
  if (!cliente) notFound()

  const [locales, avisos, dependencias] = await Promise.all([
    localesDeCliente(cliente.id, true),
    avisosDe({ clienteId: cliente.id }),
    dependenciasCliente(cliente.id),
  ])

  const sePuedeBorrar = dependencias.numLocales === 0 && dependencias.numAvisos === 0

  return (
    <>
      <EncabezadoPagina
        titulo={cliente.nombre}
        volver={{ href: '/clientes', etiqueta: 'Clientes' }}
        etiquetas={
          <>
            <Etiqueta clases="bg-gris-50 text-gris-700 ring-gris-200">
              {plural(locales.filter((local) => !local.archivado).length, 'local', 'locales')}
            </Etiqueta>
            {cliente.archivado && <ArchivadoEtiqueta />}
          </>
        }
        acciones={
          <>
            <BotonEnlace href={`/clientes/${cliente.id}/editar`} variante="secundario">
              <Pencil className="size-4.5" aria-hidden />
              Modificar
            </BotonEnlace>
            <BotonArchivar
              accion={alternarArchivadoCliente}
              id={cliente.id}
              archivado={cliente.archivado}
              que="cliente"
            />
            {puede(usuario, 'borrarClientes') && (
              <BotonBorrar
                accion={eliminarCliente}
                campos={{ id: cliente.id }}
                titulo="Eliminar el cliente"
                mensaje={
                  sePuedeBorrar
                    ? `Se borrará «${cliente.nombre}». No tiene locales ni avisos, así que no se pierde historial.`
                    : `«${cliente.nombre}» tiene historial asociado. Si lo que quieres es dejar de usarlo, archívalo.`
                }
                soloIcono
              />
            )}
          </>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="flex flex-col gap-5">
          <Seccion
            titulo="Locales"
            descripcion="Los avisos se abren siempre sobre un local"
            accion={
              <BotonEnlace
                href={`/clientes/${cliente.id}/locales/nuevo`}
                variante="suave"
                tamano="sm"
              >
                <Plus className="size-4" aria-hidden />
                Añadir
              </BotonEnlace>
            }
            sinRelleno
          >
            {locales.length ? (
              <ul className="divide-y divide-gris-200/70">
                {locales.map((local) => (
                  <li key={local.id}>
                    <Link
                      href={`/locales/${local.id}`}
                      className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-gris-50 sm:px-6"
                    >
                      <span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-[0.625rem] bg-gris-100 text-gris-600">
                        <MapPin className="size-4" aria-hidden />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="flex flex-wrap items-center gap-2 font-medium text-gris-900">
                          {local.nombre}
                          {local.archivado && <ArchivadoEtiqueta />}
                        </p>
                        <p className="truncate text-sm text-gris-500">
                          {local.direccion}, {local.codigoPostal} {local.ciudad}
                        </p>
                      </div>
                      {local.numAvisosAbiertos > 0 && (
                        <Etiqueta
                          clases="bg-mantequilla-100 text-mantequilla-800 ring-mantequilla-300"
                          punto="bg-mantequilla-500"
                          className="mt-0.5 shrink-0"
                        >
                          {local.numAvisosAbiertos}
                        </Etiqueta>
                      )}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <EstadoVacio
                icono={Store}
                titulo="Este cliente no tiene locales"
                texto="Añade al menos un local para poder registrar sus avisos."
                accion={
                  <BotonEnlace href={`/clientes/${cliente.id}/locales/nuevo`}>
                    <Plus className="size-4.5" aria-hidden />
                    Añadir el primer local
                  </BotonEnlace>
                }
                className="py-10"
              />
            )}
          </Seccion>

          <Seccion
            titulo="Historial de avisos"
            descripcion={
              avisos.length ? 'Los más recientes primero, con los abiertos arriba' : undefined
            }
            accion={
              avisos.length > 0 ? (
                <BotonEnlace
                  href={enlaceAvisos({ cliente: String(cliente.id), vista: 'todos' })}
                  variante="fantasma"
                  tamano="sm"
                >
                  Ver todos
                </BotonEnlace>
              ) : undefined
            }
            sinRelleno
          >
            {avisos.length ? (
              <ListaAvisosCompacta avisos={avisos} />
            ) : (
              <EstadoVacio
                icono={ClipboardList}
                titulo="Sin avisos todavía"
                texto="Cuando este cliente llame, el aviso aparecerá aquí."
                className="py-10"
              />
            )}
          </Seccion>
        </div>

        <aside className="flex flex-col gap-5">
          <Tarjeta className="p-5 sm:p-6">
            <ListaDatos className="sm:grid-cols-1">
              <Dato etiqueta="CIF o NIF">{cliente.cif ?? '—'}</Dato>
              <Dato etiqueta="Persona de contacto">{cliente.personaContacto ?? '—'}</Dato>
              <Dato etiqueta="Teléfono">
                {cliente.telefono ? (
                  <a
                    href={`tel:${cliente.telefono.replace(/\s/g, '')}`}
                    className="flex items-center gap-2 text-marca-700 hover:underline"
                  >
                    <Phone className="size-4 text-gris-400" aria-hidden />
                    {cliente.telefono}
                  </a>
                ) : (
                  '—'
                )}
              </Dato>
              <Dato etiqueta="Email">
                {cliente.email ? (
                  <a
                    href={`mailto:${cliente.email}`}
                    className="flex items-center gap-2 break-all text-marca-700 hover:underline"
                  >
                    <Mail className="size-4 shrink-0 text-gris-400" aria-hidden />
                    {cliente.email}
                  </a>
                ) : (
                  '—'
                )}
              </Dato>
              <Dato etiqueta="Dirección de facturación">{cliente.direccionFacturacion ?? '—'}</Dato>
            </ListaDatos>
          </Tarjeta>

          {cliente.notas && (
            <Seccion titulo="Notas">
              <p className="text-sm leading-relaxed whitespace-pre-line text-gris-700">{cliente.notas}</p>
            </Seccion>
          )}
        </aside>
      </div>
    </>
  )
}

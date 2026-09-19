import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { actualizarLocal } from '@/acciones/locales'
import { FormularioLocal } from '@/componentes/clientes/FormularioLocal'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { clientesParaSelector, obtenerLocal } from '@/db/consultas/clientes'
import { exigirPermiso } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Modificar local' }

type Props = { params: Promise<{ id: string }> }

export default async function PaginaEditarLocal({ params }: Props) {
  await exigirPermiso('gestionarClientes')
  const { id } = await params
  const local = await obtenerLocal(Number(id))
  if (!local) notFound()

  const clientes = await clientesParaSelector()

  return (
    <>
      <EncabezadoPagina
        titulo="Modificar local"
        descripcion={`${local.nombre} · ${local.cliente.nombre}`}
        volver={{ href: `/locales/${local.id}`, etiqueta: 'Volver al local' }}
      />
      <FormularioLocal
        accion={actualizarLocal}
        clientes={clientes}
        local={local}
        volverA={`/locales/${local.id}`}
      />
    </>
  )
}

import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { crearLocal } from '@/acciones/locales'
import { FormularioLocal } from '@/componentes/clientes/FormularioLocal'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { clientesParaSelector, obtenerCliente } from '@/db/consultas/clientes'
import { exigirPermiso } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Nuevo local' }

type Props = { params: Promise<{ id: string }> }

export default async function PaginaNuevoLocal({ params }: Props) {
  await exigirPermiso('gestionarClientes')
  const { id } = await params
  const cliente = await obtenerCliente(Number(id))
  if (!cliente) notFound()

  const clientes = await clientesParaSelector()

  return (
    <>
      <EncabezadoPagina
        titulo="Nuevo local"
        descripcion={`Se añadirá a ${cliente.nombre}`}
        volver={{ href: `/clientes/${cliente.id}`, etiqueta: 'Volver al cliente' }}
      />
      <FormularioLocal
        accion={crearLocal}
        clientes={clientes}
        clienteId={cliente.id}
        volverA={`/clientes/${cliente.id}`}
      />
    </>
  )
}

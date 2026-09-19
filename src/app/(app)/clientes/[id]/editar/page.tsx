import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { actualizarCliente } from '@/acciones/clientes'
import { FormularioCliente } from '@/componentes/clientes/FormularioCliente'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { obtenerCliente } from '@/db/consultas/clientes'
import { exigirPermiso } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Modificar cliente' }

type Props = { params: Promise<{ id: string }> }

export default async function PaginaEditarCliente({ params }: Props) {
  await exigirPermiso('gestionarClientes')
  const { id } = await params
  const cliente = await obtenerCliente(Number(id))
  if (!cliente) notFound()

  return (
    <>
      <EncabezadoPagina
        titulo="Modificar cliente"
        descripcion={cliente.nombre}
        volver={{ href: `/clientes/${cliente.id}`, etiqueta: 'Volver al cliente' }}
      />
      <FormularioCliente
        accion={actualizarCliente}
        cliente={cliente}
        volverA={`/clientes/${cliente.id}`}
      />
    </>
  )
}

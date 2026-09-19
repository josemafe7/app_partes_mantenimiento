import type { Metadata } from 'next'

import { crearCliente } from '@/acciones/clientes'
import { FormularioCliente } from '@/componentes/clientes/FormularioCliente'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { exigirPermiso } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Nuevo cliente' }

export default async function PaginaNuevoCliente() {
  await exigirPermiso('gestionarClientes')
  return (
    <>
      <EncabezadoPagina
        titulo="Nuevo cliente"
        descripcion="Los datos de la empresa. Sus locales se añaden después, desde su ficha."
        volver={{ href: '/clientes', etiqueta: 'Clientes' }}
      />
      <FormularioCliente accion={crearCliente} volverA="/clientes" />
    </>
  )
}

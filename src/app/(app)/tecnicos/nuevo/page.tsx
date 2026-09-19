import type { Metadata } from 'next'

import { crearTecnico } from '@/acciones/tecnicos'
import { FormularioTecnico } from '@/componentes/tecnicos/FormularioTecnico'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { exigirPermiso } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Nuevo técnico' }

export default async function PaginaNuevoTecnico() {
  await exigirPermiso('altaTecnicos')
  return (
    <>
      <EncabezadoPagina
        titulo="Nuevo técnico"
        descripcion="Con sus especialidades para poder repartir los avisos con criterio."
        volver={{ href: '/tecnicos', etiqueta: 'Técnicos' }}
      />
      <FormularioTecnico accion={crearTecnico} volverA="/tecnicos" />
    </>
  )
}

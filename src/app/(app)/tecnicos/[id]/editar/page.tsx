import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { actualizarTecnico } from '@/acciones/tecnicos'
import { FormularioTecnico } from '@/componentes/tecnicos/FormularioTecnico'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { obtenerTecnico } from '@/db/consultas/tecnicos'
import { exigirPermiso } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Modificar técnico' }

type Props = { params: Promise<{ id: string }> }

export default async function PaginaEditarTecnico({ params }: Props) {
  await exigirPermiso('gestionarTecnicos')
  const { id } = await params
  const tecnico = await obtenerTecnico(Number(id))
  if (!tecnico) notFound()

  return (
    <>
      <EncabezadoPagina
        titulo="Modificar técnico"
        descripcion={`${tecnico.nombre} ${tecnico.apellidos ?? ''}`.trim()}
        volver={{ href: `/tecnicos/${tecnico.id}`, etiqueta: 'Volver al técnico' }}
      />
      <FormularioTecnico
        accion={actualizarTecnico}
        tecnico={tecnico}
        volverA={`/tecnicos/${tecnico.id}`}
      />
    </>
  )
}

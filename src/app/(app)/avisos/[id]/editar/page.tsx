import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { actualizarAviso } from '@/acciones/avisos'
import { FormularioAviso } from '@/componentes/avisos/FormularioAviso'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { obtenerAviso } from '@/db/consultas/avisos'
import { clientesParaSelector, localesParaSelector } from '@/db/consultas/clientes'
import { tecnicosParaSelector } from '@/db/consultas/tecnicos'
import { exigirPermiso } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Modificar aviso' }

type Props = { params: Promise<{ id: string }> }

export default async function PaginaEditarAviso({ params }: Props) {
  await exigirPermiso('gestionarAvisos')
  const { id } = await params
  const aviso = await obtenerAviso(Number(id))
  if (!aviso) notFound()

  const [clientes, locales, tecnicos] = await Promise.all([
    clientesParaSelector(),
    localesParaSelector(),
    tecnicosParaSelector(),
  ])

  return (
    <>
      <EncabezadoPagina
        titulo="Modificar aviso"
        descripcion={`${aviso.referencia} · ${aviso.titulo}`}
        volver={{ href: `/avisos/${aviso.id}`, etiqueta: 'Volver al aviso' }}
      />
      <FormularioAviso
        accion={actualizarAviso}
        clientes={clientes}
        locales={locales}
        tecnicos={tecnicos}
        aviso={aviso}
        volverA={`/avisos/${aviso.id}`}
      />
    </>
  )
}

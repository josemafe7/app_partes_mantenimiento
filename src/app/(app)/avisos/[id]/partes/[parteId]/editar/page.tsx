import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { actualizarParte } from '@/acciones/partes'
import { FormularioParte } from '@/componentes/partes/FormularioParte'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { obtenerAviso, obtenerParte } from '@/db/consultas/avisos'
import { tecnicosParaSelector } from '@/db/consultas/tecnicos'
import { fechaCorta } from '@/lib/fechas'
import { esTecnico, puedeEditarParte } from '@/lib/permisos'
import { exigirUsuario } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Modificar parte de trabajo' }

type Props = { params: Promise<{ id: string; parteId: string }> }

export default async function PaginaEditarParte({ params }: Props) {
  const usuario = await exigirUsuario()
  const { id, parteId } = await params

  const [aviso, parte, tecnicos] = await Promise.all([
    obtenerAviso(Number(id)),
    obtenerParte(Number(parteId)),
    esTecnico(usuario) ? [] : tecnicosParaSelector(),
  ])

  if (!aviso || !parte || parte.avisoId !== aviso.id) notFound()
  if (!puedeEditarParte(usuario, aviso, parte)) notFound()

  // El técnico solo corrige los suyos, así que el parte ya va a su nombre.
  const tecnicoFijo = esTecnico(usuario)
    ? { id: parte.tecnicoId, nombre: `${parte.tecnico.nombre} ${parte.tecnico.apellidos ?? ''}`.trim() }
    : undefined

  return (
    <>
      <EncabezadoPagina
        titulo="Modificar el parte de trabajo"
        descripcion={`Parte del ${fechaCorta(parte.fecha)} · ${aviso.referencia}`}
        volver={{ href: `/avisos/${aviso.id}`, etiqueta: 'Volver al aviso' }}
      />
      <FormularioParte
        accion={actualizarParte}
        avisoId={aviso.id}
        tecnicos={tecnicos}
        tecnicoSugerido={parte.tecnicoId}
        tecnicoFijo={tecnicoFijo}
        parte={parte}
        volverA={`/avisos/${aviso.id}`}
      />
    </>
  )
}

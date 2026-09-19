import { HardHat } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { crearParte } from '@/acciones/partes'
import { FormularioParte } from '@/componentes/partes/FormularioParte'
import { BotonEnlace } from '@/componentes/ui/Boton'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { obtenerAviso } from '@/db/consultas/avisos'
import { obtenerTecnico, tecnicosParaSelector } from '@/db/consultas/tecnicos'
import { esTecnico, puedeAnotarParte } from '@/lib/permisos'
import { exigirUsuario } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Nuevo parte de trabajo' }

type Props = { params: Promise<{ id: string }> }

export default async function PaginaNuevoParte({ params }: Props) {
  const usuario = await exigirUsuario()
  const { id } = await params
  const aviso = await obtenerAviso(Number(id))
  if (!aviso || !puedeAnotarParte(usuario, aviso)) notFound()

  // El técnico firma con su ficha; la oficina elige quién hizo el trabajo.
  const ficha = esTecnico(usuario) && usuario.tecnicoId ? await obtenerTecnico(usuario.tecnicoId) : null
  const tecnicoFijo = ficha ? { id: ficha.id, nombre: `${ficha.nombre} ${ficha.apellidos ?? ''}`.trim() } : undefined
  const tecnicos = tecnicoFijo ? [] : await tecnicosParaSelector()

  if (!tecnicoFijo && tecnicos.length === 0) {
    return (
      <>
        <EncabezadoPagina
          titulo="Nuevo parte de trabajo"
          volver={{ href: `/avisos/${aviso.id}`, etiqueta: 'Volver al aviso' }}
        />
        <Tarjeta>
          <EstadoVacio
            icono={HardHat}
            titulo="No hay técnicos dados de alta"
            texto="Un parte de trabajo lo firma siempre un técnico. Da de alta al menos uno."
            accion={<BotonEnlace href="/tecnicos/nuevo">Añadir un técnico</BotonEnlace>}
          />
        </Tarjeta>
      </>
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Nuevo parte de trabajo"
        descripcion={`${aviso.referencia} · ${aviso.titulo}`}
        volver={{ href: `/avisos/${aviso.id}`, etiqueta: 'Volver al aviso' }}
      />
      <FormularioParte
        accion={crearParte}
        avisoId={aviso.id}
        tecnicos={tecnicos}
        tecnicoSugerido={aviso.tecnicoId}
        tecnicoFijo={tecnicoFijo}
        volverA={`/avisos/${aviso.id}`}
      />
    </>
  )
}

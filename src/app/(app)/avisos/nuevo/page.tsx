import { Building2 } from 'lucide-react'
import type { Metadata } from 'next'

import { crearAviso } from '@/acciones/avisos'
import { FormularioAviso } from '@/componentes/avisos/FormularioAviso'
import { BotonEnlace } from '@/componentes/ui/Boton'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { clientesParaSelector, localesParaSelector } from '@/db/consultas/clientes'
import { tecnicosParaSelector } from '@/db/consultas/tecnicos'
import { exigirPermiso } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Nuevo aviso' }

type Props = {
  searchParams: Promise<{ cliente?: string; local?: string }>
}

export default async function PaginaNuevoAviso({ searchParams }: Props) {
  await exigirPermiso('gestionarAvisos')
  const { cliente, local } = await searchParams

  const [clientes, locales, tecnicos] = await Promise.all([
    clientesParaSelector(),
    localesParaSelector(),
    tecnicosParaSelector(),
  ])

  if (locales.length === 0) {
    return (
      <>
        <EncabezadoPagina titulo="Nuevo aviso" volver={{ href: '/avisos', etiqueta: 'Avisos' }} />
        <Tarjeta>
          <EstadoVacio
            icono={Building2}
            titulo="Todavía no hay locales donde abrir un aviso"
            texto="Un aviso siempre pertenece al local de un cliente. Da de alta primero el cliente y su local."
            accion={<BotonEnlace href="/clientes/nuevo">Crear el primer cliente</BotonEnlace>}
          />
        </Tarjeta>
      </>
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Nuevo aviso"
        descripcion="Registra la llamada o el WhatsApp que acaba de entrar."
        volver={{ href: '/avisos', etiqueta: 'Avisos' }}
      />
      <FormularioAviso
        accion={crearAviso}
        clientes={clientes}
        locales={locales}
        tecnicos={tecnicos}
        inicial={{
          clienteId: cliente && /^\d+$/.test(cliente) ? Number(cliente) : undefined,
          localId: local && /^\d+$/.test(local) ? Number(local) : undefined,
        }}
        volverA="/avisos"
      />
    </>
  )
}

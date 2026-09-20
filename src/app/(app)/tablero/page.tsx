import { ClipboardList, Plus } from 'lucide-react'
import type { Metadata } from 'next'

import { Tablero } from '@/componentes/tablero/Tablero'
import { BotonEnlace } from '@/componentes/ui/Boton'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { SelectorUrl } from '@/componentes/ui/SelectorUrl'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { avisosPorEstado } from '@/db/consultas/avisos'
import { tecnicosParaSelector } from '@/db/consultas/tecnicos'
import { ESTADOS } from '@/lib/dominio'
import { ES_ID } from '@/lib/filtros'
import { exigirPermiso } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Tablero' }

type Props = {
  searchParams: Promise<{ tecnico?: string }>
}

export default async function PaginaTablero({ searchParams }: Props) {
  await exigirPermiso('gestionarAvisos')
  const { tecnico } = await searchParams
  const tecnicoId = tecnico && ES_ID.test(tecnico) ? Number(tecnico) : undefined

  const [columnas, tecnicos] = await Promise.all([
    avisosPorEstado(tecnicoId),
    tecnicosParaSelector(),
  ])

  const total = ESTADOS.reduce((suma, estado) => suma + columnas[estado].length, 0)

  return (
    <>
      <EncabezadoPagina
        titulo="Tablero"
        descripcion="Arrastra una tarjeta de una columna a otra para cambiar su estado."
        acciones={
          <>
            <SelectorUrl
              parametro="tecnico"
              valor={tecnicoId ? String(tecnicoId) : ''}
              etiqueta="Filtrar por técnico"
              textoTodos="Todos los técnicos"
              opciones={tecnicos.map((item) => ({
                valor: String(item.id),
                etiqueta: `${item.nombre} ${item.apellidos ?? ''}`.trim(),
              }))}
              className="w-auto min-w-44"
            />
            <BotonEnlace href="/avisos" variante="secundario">
              Ver como lista
            </BotonEnlace>
          </>
        }
      />

      {total === 0 ? (
        <Tarjeta>
          <EstadoVacio
            icono={ClipboardList}
            titulo="No hay avisos que mostrar"
            texto={
              tecnicoId
                ? 'Este técnico no tiene avisos asignados. Prueba a quitar el filtro.'
                : 'Registra el primer aviso y aparecerá en la columna de pendientes.'
            }
            accion={
              tecnicoId ? (
                <BotonEnlace href="/tablero" variante="secundario">
                  Quitar el filtro
                </BotonEnlace>
              ) : (
                <BotonEnlace href="/avisos/nuevo">
                  <Plus className="size-4.5" aria-hidden />
                  Registrar un aviso
                </BotonEnlace>
              )
            }
          />
        </Tarjeta>
      ) : (
        <Tablero columnas={columnas} />
      )}
    </>
  )
}

import { MessageSquareText, Package, Pencil } from 'lucide-react'
import Link from 'next/link'

import { eliminarParte } from '@/acciones/partes'
import { AvatarTecnico } from '@/componentes/avisos/ListaAvisos'
import { BotonBorrar } from '@/componentes/ui/BotonBorrar'
import { Etiqueta } from '@/componentes/ui/Etiqueta'
import type { AvisoCompleto } from '@/db/consultas/avisos'
import { fechaCorta, horasTexto } from '@/lib/fechas'

type Partes = AvisoCompleto['partes']

type Props = {
  avisoId: number
  partes: Partes
  /** Ids de los partes que este usuario puede corregir o borrar (ver `puedeEditarParte`). */
  editables: number[]
}

export function ListaPartes({ avisoId, partes, editables }: Props) {
  return (
    <ul className="divide-y divide-gris-200/70">
      {partes.map((parte) => (
        <li key={parte.id} className="bloque-entero px-5 py-4.5 sm:px-6">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="flex items-center gap-2.5">
              <AvatarTecnico
                nombre={parte.tecnico.nombre}
                apellidos={parte.tecnico.apellidos}
                className="size-8 text-xs"
              />
              <span className="leading-tight">
                <span className="block text-[0.9375rem] font-medium text-gris-900">
                  {parte.tecnico.nombre} {parte.tecnico.apellidos ?? ''}
                </span>
                <span className="block text-[0.8125rem] text-gris-500">{fechaCorta(parte.fecha)}</span>
              </span>
            </span>
            <Etiqueta clases="bg-gris-50 text-gris-800 ring-gris-200">{horasTexto(parte.horas)}</Etiqueta>
            {parte.resuelto && (
              <Etiqueta clases="bg-menta-100 text-menta-800 ring-menta-300" punto="bg-menta-500">
                Resuelto
              </Etiqueta>
            )}

            {editables.includes(parte.id) && (
              <span className="no-imprimir ml-auto flex items-center gap-1">
                <Link
                  href={`/avisos/${avisoId}/partes/${parte.id}/editar`}
                  aria-label="Modificar el parte"
                  title="Modificar el parte"
                  className="grid size-11 place-items-center rounded-control text-gris-500 transition-colors hover:bg-gris-100 hover:text-gris-800"
                >
                  <Pencil className="size-4.5" aria-hidden />
                </Link>
                <BotonBorrar
                  accion={eliminarParte}
                  campos={{ id: parte.id }}
                  titulo="Eliminar el parte de trabajo"
                  mensaje={`Se va a borrar el parte del ${fechaCorta(parte.fecha)} (${horasTexto(parte.horas)}). El aviso y el resto de partes no se tocan.`}
                  etiqueta="Eliminar el parte"
                  soloIcono
                />
              </span>
            )}
          </div>

          <p className="mt-3 max-w-[68ch] text-[0.9375rem] leading-relaxed whitespace-pre-line text-gris-800">
            {parte.trabajoRealizado}
          </p>

          {parte.materiales && (
            <p className="mt-2.5 flex gap-2 text-sm text-gris-600">
              <Package className="mt-0.5 size-4 shrink-0 text-gris-400" aria-hidden />
              <span>
                <span className="font-medium text-gris-700">Materiales: </span>
                {parte.materiales}
              </span>
            </p>
          )}

          {/* Si lo anotó otra persona (la oficina, por teléfono), se dice quién. */}
          {parte.creador && parte.creador.tecnicoId !== parte.tecnicoId && (
            <p className="mt-2.5 text-[0.8125rem] text-gris-500">Anotado por {parte.creador.nombre}</p>
          )}

          {parte.observaciones && (
            <p className="mt-3 flex gap-2.5 rounded-tarjeta bg-mantequilla-50 px-3.5 py-2.5 text-sm text-mantequilla-800 ring-1 ring-mantequilla-200 ring-inset">
              <MessageSquareText className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>
                <span className="font-semibold">Para la oficina: </span>
                {parte.observaciones}
              </span>
            </p>
          )}
        </li>
      ))}
    </ul>
  )
}

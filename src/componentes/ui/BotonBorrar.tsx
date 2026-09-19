'use client'

import { Trash2, TriangleAlert } from 'lucide-react'
import { useActionState, useState } from 'react'

import { ESTADO_INICIAL, type ResultadoAccion } from '@/lib/acciones'

import { Boton } from './Boton'
import { Dialogo } from './Dialogo'

type Accion = (previo: ResultadoAccion, formData: FormData) => Promise<ResultadoAccion>

type Props = {
  accion: Accion
  /** Campos ocultos que necesita la acción, normalmente el id. */
  campos: Record<string, string | number>
  titulo: string
  /** Qué se va a perder exactamente. */
  mensaje: string
  etiqueta?: string
  /** Texto del botón que confirma. */
  confirmar?: string
  soloIcono?: boolean
}

/**
 * Botón de borrar con confirmación.
 *
 * Si el servidor se niega (por ejemplo, un cliente con avisos en el historial),
 * el diálogo se queda abierto mostrando el motivo en lugar de cerrarse en falso.
 */
export function BotonBorrar({
  accion,
  campos,
  titulo,
  mensaje,
  etiqueta = 'Eliminar',
  confirmar = 'Sí, eliminar',
  soloIcono = false,
}: Props) {
  const [abierto, setAbierto] = useState(false)
  const [resultado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL)

  return (
    <>
      <Boton
        variante={soloIcono ? 'fantasma' : 'secundario'}
        tamano={soloIcono ? 'icono' : 'md'}
        onClick={() => setAbierto(true)}
        aria-label={soloIcono ? etiqueta : undefined}
        title={soloIcono ? etiqueta : undefined}
        className={soloIcono ? 'text-gris-500 hover:bg-coral-50 hover:text-coral-700' : 'text-coral-700'}
      >
        <Trash2 className="size-4.5" aria-hidden />
        {!soloIcono && etiqueta}
      </Boton>

      <Dialogo abierto={abierto} onCerrar={() => setAbierto(false)} titulo={titulo}>
        <form action={enviar} className="flex flex-col gap-4">
          {Object.entries(campos).map(([nombre, valor]) => (
            <input key={nombre} type="hidden" name={nombre} value={String(valor)} />
          ))}

          <p className="text-[0.9375rem] leading-relaxed text-gris-700">{mensaje}</p>

          {resultado.mensaje && (
            <div className="flex gap-2.5 rounded-tarjeta bg-mantequilla-100 px-4 py-3 text-sm text-mantequilla-800 ring-1 ring-mantequilla-300 ring-inset">
              <TriangleAlert className="mt-0.5 size-4.5 shrink-0" aria-hidden />
              <p>{resultado.mensaje}</p>
            </div>
          )}

          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton type="submit" variante="peligro" disabled={enviando}>
              {enviando ? 'Eliminando…' : confirmar}
            </Boton>
          </div>
        </form>
      </Dialogo>
    </>
  )
}

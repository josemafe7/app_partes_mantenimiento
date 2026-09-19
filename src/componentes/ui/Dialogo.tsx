'use client'

import { X } from 'lucide-react'
import { useEffect, useRef, type ReactNode } from 'react'

import { Boton } from './Boton'

type Props = {
  abierto: boolean
  onCerrar: () => void
  titulo: string
  descripcion?: string
  children: ReactNode
}

/**
 * Ventana modal sobre el <dialog> nativo: así el navegador ya nos da la tecla
 * Escape, el fondo bloqueado y el foco atrapado dentro, sin reimplementarlo.
 */
export function Dialogo({ abierto, onCerrar, titulo, descripcion, children }: Props) {
  const referencia = useRef<HTMLDialogElement>(null)

  useEffect(() => {
    const dialogo = referencia.current
    if (!dialogo) return
    if (abierto && !dialogo.open) dialogo.showModal()
    if (!abierto && dialogo.open) dialogo.close()
  }, [abierto])

  return (
    <dialog
      ref={referencia}
      onClose={onCerrar}
      onClick={(evento) => {
        // Cerrar al pulsar fuera de la tarjeta (el <dialog> ocupa toda la pantalla).
        if (evento.target === referencia.current) onCerrar()
      }}
      className="fixed inset-0 m-auto w-[min(34rem,92vw)] rounded-panel bg-white p-0 shadow-flotante backdrop:bg-gris-900/45 backdrop:backdrop-blur-sm"
    >
      <div className="flex max-h-[85vh] flex-col">
        <header className="flex items-start justify-between gap-4 px-6 pt-5 pb-3">
          <div>
            <h2 className="titular text-lg font-semibold text-gris-950">{titulo}</h2>
            {descripcion && <p className="mt-1 text-sm text-gris-500">{descripcion}</p>}
          </div>
          <Boton
            variante="fantasma"
            tamano="icono"
            onClick={onCerrar}
            aria-label="Cerrar"
            className="-mt-1.5 -mr-2.5 h-9 w-9 rounded-full"
          >
            <X className="size-5" aria-hidden />
          </Boton>
        </header>
        <div className="overflow-y-auto px-6 pt-1 pb-6">{children}</div>
      </div>
    </dialog>
  )
}

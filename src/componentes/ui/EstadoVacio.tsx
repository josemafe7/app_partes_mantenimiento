import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  icono: LucideIcon
  titulo: string
  texto?: string
  accion?: ReactNode
  className?: string
}

/** Hueco con salida: siempre explica qué falta y qué se puede hacer. */
export function EstadoVacio({ icono: Icono, titulo, texto, accion, className }: Props) {
  return (
    <div className={cn('flex flex-col items-center px-6 py-12 text-center', className)}>
      <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-lima-100 text-lima-700">
        <Icono className="size-6" aria-hidden />
      </div>
      <h3 className="font-semibold text-gris-900">{titulo}</h3>
      {texto && <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-gris-500">{texto}</p>}
      {accion && <div className="mt-5">{accion}</div>}
    </div>
  )
}

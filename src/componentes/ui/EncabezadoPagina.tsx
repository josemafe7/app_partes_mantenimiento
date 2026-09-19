import { ChevronLeft } from 'lucide-react'
import Link from 'next/link'
import type { ReactNode } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  titulo: string
  descripcion?: string
  /** Enlace de vuelta, con su texto. */
  volver?: { href: string; etiqueta: string }
  acciones?: ReactNode
  /** Etiquetas de estado que se muestran junto al título. */
  etiquetas?: ReactNode
  className?: string
}

export function EncabezadoPagina({
  titulo,
  descripcion,
  volver,
  acciones,
  etiquetas,
  className,
}: Props) {
  return (
    <div className={cn('no-imprimir mb-6', className)}>
      {volver && (
        <Link
          href={volver.href}
          className="-ml-1 mb-3 inline-flex h-8 items-center gap-1 rounded-full pr-3 pl-1.5 text-sm font-medium text-gris-600 transition-colors hover:bg-white hover:text-gris-900"
        >
          <ChevronLeft className="size-4" aria-hidden />
          {volver.etiqueta}
        </Link>
      )}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h1 className="titular text-[1.75rem] leading-tight font-semibold text-gris-950 sm:text-[2rem]">
            {titulo}
          </h1>
          {/* Sobre el naranja de inicio, el gris medio no se lee: pasa a oscuro. */}
          {descripcion && (
            <p className="mt-1.5 text-[0.9375rem] text-gris-600 in-data-[lienzo=claude]:text-gris-900">
              {descripcion}
            </p>
          )}
          {etiquetas && <div className="mt-3 flex flex-wrap items-center gap-2">{etiquetas}</div>}
        </div>
        {acciones && <div className="flex shrink-0 flex-wrap items-center gap-2">{acciones}</div>}
      </div>
    </div>
  )
}

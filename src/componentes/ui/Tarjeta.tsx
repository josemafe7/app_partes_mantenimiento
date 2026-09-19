import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/*
 * Los paneles flotan sobre el lienzo salvia: fondo blanco, un filo muy suave y
 * sin sombra de caja. Lo que separa los bloques es el color del lienzo, no una
 * sombra repetida debajo de cada uno.
 */
export const CLASES_PANEL = 'rounded-panel bg-white ring-1 ring-gris-200/70'

export function Tarjeta({ className, children, ...resto }: ComponentProps<'div'>) {
  return (
    <div className={cn(CLASES_PANEL, className)} {...resto}>
      {children}
    </div>
  )
}

type PropsSeccion = {
  titulo: string
  descripcion?: string
  accion?: ReactNode
  children: ReactNode
  className?: string
  /** Clases del cuerpo, por ejemplo para que un gráfico ocupe todo el alto. */
  claseCuerpo?: string
  /** Quita el relleno del cuerpo (para listas y tablas que llegan al borde). */
  sinRelleno?: boolean
}

/** Bloque titulado dentro de una página. */
export function Seccion({
  titulo,
  descripcion,
  accion,
  children,
  className,
  claseCuerpo,
  sinRelleno,
}: PropsSeccion) {
  return (
    <section className={cn(CLASES_PANEL, 'flex flex-col overflow-hidden', className)}>
      <header className="flex items-start justify-between gap-3 px-5 pt-4.5 pb-3.5 sm:px-6">
        <div className="min-w-0">
          <h2 className="titular truncate text-[1.0625rem] font-semibold text-gris-900">{titulo}</h2>
          {descripcion && <p className="mt-0.5 text-sm text-gris-500">{descripcion}</p>}
        </div>
        {accion && <div className="-mt-0.5 shrink-0">{accion}</div>}
      </header>
      <div className={cn(sinRelleno ? 'border-t border-gris-200/70' : 'px-5 pb-5 sm:px-6 sm:pb-6', claseCuerpo)}>
        {children}
      </div>
    </section>
  )
}

/** Par «etiqueta / valor» para las fichas de detalle. */
export function Dato({
  etiqueta,
  children,
  className,
}: {
  etiqueta: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn('min-w-0', className)}>
      <dt className="text-[0.8125rem] text-gris-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-[0.9375rem] break-words text-gris-900">{children ?? '—'}</dd>
    </div>
  )
}

export function ListaDatos({ children, className }: { children: ReactNode; className?: string }) {
  return <dl className={cn('grid gap-4 sm:grid-cols-2', className)}>{children}</dl>
}

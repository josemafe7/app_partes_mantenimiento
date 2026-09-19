import type { ReactNode } from 'react'

import { ESTADO, PRIORIDAD, type Estado, type Prioridad } from '@/lib/dominio'
import { cn } from '@/lib/utils'

type PropsEtiqueta = {
  children: ReactNode
  clases?: string
  punto?: string
  className?: string
  titulo?: string
}

/** Etiqueta de color redondeada (badge). */
export function Etiqueta({ children, clases, punto, className, titulo }: PropsEtiqueta) {
  return (
    <span
      title={titulo}
      className={cn(
        'inline-flex h-6 items-center gap-1.5 rounded-full px-2.5 text-[0.8125rem] font-medium whitespace-nowrap ring-1 ring-inset',
        clases ?? 'bg-gris-100 text-gris-700 ring-gris-200',
        className,
      )}
    >
      {punto && <span className={cn('size-1.5 shrink-0 rounded-full', punto)} aria-hidden />}
      {children}
    </span>
  )
}

export function EstadoEtiqueta({ estado, className }: { estado: Estado; className?: string }) {
  const info = ESTADO[estado]
  return (
    <Etiqueta clases={info.clases} punto={info.punto} className={className} titulo={info.descripcion}>
      {info.etiqueta}
    </Etiqueta>
  )
}

export function PrioridadEtiqueta({ prioridad, className }: { prioridad: Prioridad; className?: string }) {
  const info = PRIORIDAD[prioridad]
  return (
    <Etiqueta clases={info.clases} punto={info.punto} className={className}>
      {info.etiqueta}
    </Etiqueta>
  )
}

/** Marca los avisos cuya fecha prevista ya ha pasado. */
export function RetrasoEtiqueta({ dias, className }: { dias: number; className?: string }) {
  if (dias <= 0) return null
  return (
    <Etiqueta clases="bg-coral-50 text-coral-700 ring-coral-200" punto="bg-coral-500" className={className}>
      {dias === 1 ? 'Retrasado 1 día' : `Retrasado ${dias} días`}
    </Etiqueta>
  )
}

export function ArchivadoEtiqueta({ className }: { className?: string }) {
  return (
    <Etiqueta clases="bg-gris-200/70 text-gris-600 ring-gris-300" className={className}>
      Archivado
    </Etiqueta>
  )
}

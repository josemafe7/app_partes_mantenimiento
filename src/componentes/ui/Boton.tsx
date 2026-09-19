import Link from 'next/link'
import type { ComponentProps } from 'react'

import { cn } from '@/lib/utils'

export type VarianteBoton = 'primario' | 'secundario' | 'suave' | 'fantasma' | 'peligro'
export type TamanoBoton = 'sm' | 'md' | 'lg' | 'icono'

const VARIANTES: Record<VarianteBoton, string> = {
  primario: 'bg-marca-700 text-white hover:bg-marca-800 active:bg-marca-900',
  secundario:
    'bg-white text-gris-800 ring-1 ring-gris-200 ring-inset hover:bg-gris-50 hover:ring-gris-300 active:bg-gris-100',
  suave: 'bg-marca-50 text-marca-800 hover:bg-marca-100 active:bg-marca-200',
  fantasma: 'text-gris-600 hover:bg-gris-100 hover:text-gris-900',
  peligro: 'bg-coral-700 text-white hover:bg-coral-800',
}

const TAMANOS: Record<TamanoBoton, string> = {
  // 44px de alto mínimo: es el objetivo táctil cómodo en un móvil.
  sm: 'h-9 rounded-[0.625rem] px-3 text-sm gap-1.5',
  md: 'h-11 rounded-control px-4 text-[0.9375rem] gap-2',
  lg: 'h-12 rounded-control px-6 text-base gap-2',
  icono: 'h-11 w-11 shrink-0 rounded-control',
}

export function clasesBoton(
  variante: VarianteBoton = 'primario',
  tamano: TamanoBoton = 'md',
  extra?: string,
): string {
  return cn(
    'inline-flex items-center justify-center font-medium whitespace-nowrap transition-colors',
    'disabled:pointer-events-none disabled:opacity-50',
    VARIANTES[variante],
    TAMANOS[tamano],
    extra,
  )
}

type PropsBoton = ComponentProps<'button'> & {
  variante?: VarianteBoton
  tamano?: TamanoBoton
}

export function Boton({ variante, tamano, className, type = 'button', ...resto }: PropsBoton) {
  return <button type={type} className={clasesBoton(variante, tamano, className)} {...resto} />
}

type PropsBotonEnlace = ComponentProps<typeof Link> & {
  variante?: VarianteBoton
  tamano?: TamanoBoton
}

export function BotonEnlace({ variante, tamano, className, ...resto }: PropsBotonEnlace) {
  return <Link className={clasesBoton(variante, tamano, className)} {...resto} />
}

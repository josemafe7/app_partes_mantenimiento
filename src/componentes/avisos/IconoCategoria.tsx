import {
  BrickWall,
  Droplets,
  Hammer,
  KeyRound,
  PaintRoller,
  PanelsTopLeft,
  Snowflake,
  Wrench,
  Zap,
  type LucideIcon,
} from 'lucide-react'

import type { Categoria } from '@/lib/dominio'
import { cn } from '@/lib/utils'

/** Un dibujo por oficio: se reconoce el tipo de trabajo antes de leerlo. */
const ICONOS: Record<Categoria, LucideIcon> = {
  fontaneria: Droplets,
  electricidad: Zap,
  climatizacion: Snowflake,
  cerrajeria: KeyRound,
  carpinteria: Hammer,
  pintura: PaintRoller,
  cristaleria: PanelsTopLeft,
  albanileria: BrickWall,
  otros: Wrench,
}

export function IconoCategoria({ categoria, className }: { categoria: Categoria; className?: string }) {
  const Icono = ICONOS[categoria]
  return <Icono className={cn('size-4', className)} aria-hidden />
}

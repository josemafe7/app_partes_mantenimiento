'use client'

import { Printer } from 'lucide-react'

import { Boton } from '@/componentes/ui/Boton'

/** Abre el diálogo de impresión del navegador (desde ahí se guarda como PDF). */
export function BotonImprimir() {
  return (
    <Boton onClick={() => window.print()}>
      <Printer className="size-4.5" aria-hidden />
      Imprimir o guardar en PDF
    </Boton>
  )
}

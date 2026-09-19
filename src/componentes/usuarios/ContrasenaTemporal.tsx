'use client'

import { Check, Copy, KeyRound } from 'lucide-react'
import { useState } from 'react'

import { Boton } from '@/componentes/ui/Boton'

/**
 * La contraseña temporal recién generada. Se enseña una sola vez: no se guarda
 * en ningún sitio, así que si se pierde hay que restablecerla otra vez.
 */
export function ContrasenaTemporal({ contrasena, nombre }: { contrasena: string; nombre: string }) {
  const [copiada, setCopiada] = useState(false)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(contrasena)
      setCopiada(true)
    } catch {
      // Sin permiso para el portapapeles: el texto se puede seleccionar a mano.
    }
  }

  return (
    <div className="rounded-tarjeta bg-lima-100 p-4 ring-1 ring-lima-300 ring-inset sm:p-5">
      <p className="flex items-center gap-2 text-sm font-semibold text-gris-900">
        <KeyRound className="size-4.5 text-lima-700" aria-hidden />
        Contraseña temporal de {nombre}
      </p>
      <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-center">
        <code className="min-w-0 flex-1 rounded-control bg-white px-3.5 py-2.5 font-mono text-lg tracking-wide break-all text-gris-950 ring-1 ring-lima-300 select-all">
          {contrasena}
        </code>
        <Boton variante="secundario" onClick={copiar}>
          {copiada ? <Check className="size-4.5" aria-hidden /> : <Copy className="size-4.5" aria-hidden />}
          {copiada ? 'Copiada' : 'Copiar'}
        </Boton>
      </div>
      <ul className="mt-3 list-disc space-y-1 pl-5 text-[0.8125rem] leading-relaxed text-gris-700">
        <li>Dásela en persona o por teléfono, mejor que por un chat o un email que queden guardados.</li>
        <li>Al entrar con ella, tendrá que elegir una contraseña suya.</li>
        <li>No se volverá a mostrar: si se pierde, restablécela otra vez.</li>
      </ul>
    </div>
  )
}

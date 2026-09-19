'use client'

import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps } from 'react'

import { cn } from '@/lib/utils'

import { Entrada } from './Campo'

/**
 * Campo de contraseña con el botón del ojo para verla: en el móvil es fácil
 * equivocarse con una contraseña larga y no ver qué se ha escrito.
 */
export function CampoContrasena({
  className,
  error,
  ...resto
}: Omit<ComponentProps<'input'>, 'type'> & { error?: boolean }) {
  const [visible, setVisible] = useState(false)

  return (
    <span className="relative block">
      <Entrada
        {...resto}
        type={visible ? 'text' : 'password'}
        error={error}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className={cn('pr-12', className)}
      />
      <button
        type="button"
        onClick={() => setVisible((valor) => !valor)}
        aria-label={visible ? 'Ocultar la contraseña' : 'Mostrar la contraseña'}
        aria-pressed={visible}
        className="absolute top-1/2 right-0.5 grid size-10 -translate-y-1/2 place-items-center rounded-[0.625rem] text-gris-500 transition-colors hover:bg-gris-100 hover:text-gris-800"
      >
        {visible ? <EyeOff className="size-4.5" aria-hidden /> : <Eye className="size-4.5" aria-hidden />}
      </button>
    </span>
  )
}

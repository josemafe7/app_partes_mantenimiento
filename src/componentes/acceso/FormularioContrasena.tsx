'use client'

import { Check, Circle, CircleCheck } from 'lucide-react'
import { useActionState, useState } from 'react'

import { cambiarContrasena } from '@/acciones/sesion'
import { Boton } from '@/componentes/ui/Boton'
import { AvisoError, Campo } from '@/componentes/ui/Campo'
import { CampoContrasena } from '@/componentes/ui/CampoContrasena'
import { ESTADO_INICIAL } from '@/lib/acciones'
import { REGLAS_CONTRASENA } from '@/lib/contrasenas'
import { cn } from '@/lib/utils'

type Props = {
  /** Viene de una contraseña temporal: no se le pide la actual. */
  temporal: boolean
  /** Su email, para que el gestor de contraseñas del navegador sepa de qué cuenta es. */
  email: string
}

const REQUISITOS = REGLAS_CONTRASENA.filter((regla) => regla.requisito)

export function FormularioContrasena({ temporal, email }: Props) {
  const [resultado, enviar, enviando] = useActionState(cambiarContrasena, ESTADO_INICIAL)
  const errores = resultado.errores ?? {}

  // La contraseña nueva va controlada para marcar los requisitos mientras se escribe.
  const [nueva, setNueva] = useState('')

  // Al guardar se vacía, comparando con el resultado anterior durante el render.
  const [resultadoAnterior, setResultadoAnterior] = useState(resultado)
  if (resultadoAnterior !== resultado) {
    setResultadoAnterior(resultado)
    if (resultado.ok) setNueva('')
  }

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {/* Solo para el gestor de contraseñas: no se envía (no tiene name). */}
      <input type="email" autoComplete="username" value={email} readOnly hidden />

      {resultado.ok && resultado.mensaje && (
        <p
          role="status"
          className="flex gap-2 rounded-tarjeta bg-menta-100 px-4 py-3 text-sm font-medium text-menta-800 ring-1 ring-menta-200 ring-inset"
        >
          <Check className="mt-0.5 size-4 shrink-0" aria-hidden />
          {resultado.mensaje}
        </p>
      )}
      <AvisoError mensaje={resultado.ok ? undefined : resultado.mensaje} />

      {!temporal && (
        <Campo etiqueta="Contraseña actual" nombre="actual" error={errores.actual} obligatorio>
          <CampoContrasena
            id="actual"
            name="actual"
            autoComplete="current-password"
            required
            error={Boolean(errores.actual)}
          />
        </Campo>
      )}

      <Campo etiqueta="Contraseña nueva" nombre="nueva" error={errores.nueva} obligatorio>
        <CampoContrasena
          id="nueva"
          name="nueva"
          autoComplete="new-password"
          required
          value={nueva}
          onChange={(evento) => setNueva(evento.target.value)}
          aria-describedby="requisitos-contrasena"
          error={Boolean(errores.nueva)}
        />
      </Campo>

      <ul id="requisitos-contrasena" className="grid gap-1.5 text-[0.8125rem] sm:grid-cols-2">
        {REQUISITOS.map((regla) => {
          const cumple = regla.cumple(nueva)
          return (
            <li
              key={regla.requisito}
              className={cn('flex items-center gap-2', cumple ? 'text-menta-800' : 'text-gris-500')}
            >
              {cumple ? (
                <CircleCheck className="size-4 shrink-0 text-menta-700" aria-hidden />
              ) : (
                <Circle className="size-4 shrink-0 text-gris-300" aria-hidden />
              )}
              {regla.requisito}
              <span className="sr-only">{cumple ? ': cumplido' : ': pendiente'}</span>
            </li>
          )
        })}
      </ul>

      <Campo etiqueta="Repite la contraseña nueva" nombre="repetir" error={errores.repetir} obligatorio>
        <CampoContrasena
          id="repetir"
          name="repetir"
          autoComplete="new-password"
          required
          error={Boolean(errores.repetir)}
        />
      </Campo>

      <p className="text-[0.8125rem] leading-relaxed text-gris-500">
        Una frase de varias palabras con algún número y símbolo es fácil de recordar y difícil de
        adivinar. Al guardarla se comprueba que no aparezca en filtraciones de datos conocidas.
      </p>

      <div className="flex justify-end">
        <Boton type="submit" tamano="lg" disabled={enviando} className="max-sm:w-full">
          {enviando ? 'Guardando…' : temporal ? 'Guardar y entrar' : 'Cambiar la contraseña'}
        </Boton>
      </div>
    </form>
  )
}

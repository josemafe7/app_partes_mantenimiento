'use client'

import { useActionState } from 'react'

import { iniciarSesion } from '@/acciones/sesion'
import { Boton } from '@/componentes/ui/Boton'
import { AvisoError, Campo, Entrada } from '@/componentes/ui/Campo'
import { CampoContrasena } from '@/componentes/ui/CampoContrasena'
import { ESTADO_INICIAL, valorPrevio } from '@/lib/acciones'

/** `siguiente`: la página a la que se quería ir antes de pedir el login. */
export function FormularioLogin({ siguiente }: { siguiente: string }) {
  const [resultado, enviar, enviando] = useActionState(iniciarSesion, ESTADO_INICIAL)
  const errores = resultado.errores ?? {}

  return (
    <form action={enviar} className="flex flex-col gap-4">
      {siguiente !== '/' && <input type="hidden" name="siguiente" value={siguiente} />}

      <AvisoError mensaje={resultado.mensaje} />

      <Campo etiqueta="Email" nombre="email" error={errores.email}>
        <Entrada
          id="email"
          name="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          required
          defaultValue={valorPrevio(resultado, 'email')}
          error={Boolean(errores.email)}
        />
      </Campo>

      <Campo etiqueta="Contraseña" nombre="contrasena" error={errores.contrasena}>
        <CampoContrasena
          id="contrasena"
          name="contrasena"
          autoComplete="current-password"
          required
          error={Boolean(errores.contrasena)}
        />
      </Campo>

      <Boton type="submit" tamano="lg" disabled={enviando} className="mt-1 w-full">
        {enviando ? 'Entrando…' : 'Entrar'}
      </Boton>
    </form>
  )
}

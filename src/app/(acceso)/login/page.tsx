import { Info } from 'lucide-react'
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { FormularioLogin } from '@/componentes/acceso/FormularioLogin'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { usuarioActual } from '@/lib/sesion'
import { rutaDeVuelta } from '@/lib/sesiones'

export const metadata: Metadata = { title: 'Iniciar sesión' }

type Props = {
  searchParams: Promise<{ siguiente?: string; sesion?: string }>
}

export default async function PaginaLogin({ searchParams }: Props) {
  const { siguiente, sesion } = await searchParams
  const destino = rutaDeVuelta(siguiente)

  // Quien ya tiene una sesión válida no tiene nada que hacer aquí.
  const usuario = await usuarioActual()
  if (usuario) redirect(usuario.debeCambiarContrasena ? '/cambiar-contrasena' : destino)

  return (
    <Tarjeta className="p-6 sm:p-8">
      <h1 className="titular text-[1.5rem] leading-tight font-semibold text-gris-950">Inicia sesión</h1>
      <p className="mt-1.5 mb-6 text-[0.9375rem] text-gris-600">Entra con el email y la contraseña de tu usuario.</p>

      {sesion === 'cerrada' && (
        <p
          role="status"
          className="mb-5 flex gap-2.5 rounded-tarjeta bg-mantequilla-100 px-4 py-3 text-sm text-mantequilla-800 ring-1 ring-mantequilla-300 ring-inset"
        >
          <Info className="mt-0.5 size-4.5 shrink-0" aria-hidden />
          Tu sesión se ha cerrado. Vuelve a entrar para seguir.
        </p>
      )}

      <FormularioLogin siguiente={destino} />

      <p className="mt-6 border-t border-gris-200/70 pt-5 text-[0.8125rem] leading-relaxed text-gris-500">
        ¿Has olvidado la contraseña o todavía no tienes usuario? Pide a quien administra la
        aplicación que te dé una contraseña temporal.
      </p>
    </Tarjeta>
  )
}

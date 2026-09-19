import type { Metadata } from 'next'
import { redirect } from 'next/navigation'

import { cerrarSesion } from '@/acciones/sesion'
import { FormularioContrasena } from '@/componentes/acceso/FormularioContrasena'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { usuarioActual } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Elige tu contraseña' }

/**
 * Parada obligatoria tras entrar con una contraseña temporal (usuario nuevo o
 * contraseña restablecida). Hasta cambiarla no se puede ver ni hacer nada más.
 */
export default async function PaginaCambiarContrasena() {
  const usuario = await usuarioActual()
  if (!usuario) redirect('/login?sesion=cerrada')
  if (!usuario.debeCambiarContrasena) redirect('/cuenta')

  return (
    <Tarjeta className="p-6 sm:p-8">
      <h1 className="titular text-[1.5rem] leading-tight font-semibold text-gris-950">
        Hola, {usuario.nombre.split(' ')[0]}
      </h1>
      <p className="mt-1.5 mb-6 text-[0.9375rem] leading-relaxed text-gris-600">
        Has entrado con una contraseña temporal. Antes de seguir, elige una tuya: solo la sabrás tú.
      </p>

      <FormularioContrasena temporal email={usuario.email} />

      <form action={cerrarSesion} className="mt-5 border-t border-gris-200/70 pt-4 text-center">
        <button
          type="submit"
          className="h-11 rounded-control px-3 text-sm font-medium text-gris-600 transition-colors hover:bg-gris-100 hover:text-gris-900"
        >
          Salir sin cambiarla
        </button>
      </form>
    </Tarjeta>
  )
}

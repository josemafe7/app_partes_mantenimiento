'use client'

import { TriangleAlert } from 'lucide-react'
import { useEffect } from 'react'

import { Boton, BotonEnlace } from '@/componentes/ui/Boton'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

/*
 * Fallo inesperado fuera de las pantallas de la aplicación: en el login o en
 * el propio layout de la aplicación (por ejemplo, si la base de datos no
 * responde al comprobar la sesión). Aquí ya no hay navegación. Los fallos de
 * cada pantalla los recoge `(app)/error.tsx`, que la conserva.
 */
export default function ErrorDePantalla({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <Tarjeta className="mx-4 mt-10 sm:mx-auto sm:max-w-xl">
      <div role="alert" className="flex flex-col items-center px-6 py-12 text-center">
        <div className="mb-4 grid size-12 place-items-center rounded-2xl bg-coral-100 text-coral-700">
          <TriangleAlert className="size-6" aria-hidden />
        </div>
        <h1 className="font-semibold text-gris-900">No se ha podido cargar esta pantalla</h1>
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-gris-500">
          Ha ocurrido un error inesperado. Vuelve a intentarlo; si se repite, avisa a quien mantiene
          la aplicación.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          {/* retry vuelve a pedir la pantalla al servidor, no solo la repinta. */}
          <Boton onClick={() => retry()}>Reintentar</Boton>
          <BotonEnlace href="/" variante="secundario">
            Volver al panel
          </BotonEnlace>
        </div>
      </div>
    </Tarjeta>
  )
}

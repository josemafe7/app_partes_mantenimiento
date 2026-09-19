'use client'

import { useEffect } from 'react'

import { Boton } from '@/componentes/ui/Boton'

import './globals.css'

/*
 * Último recurso: solo aparece si falla el propio layout raíz. Lo sustituye
 * entero, así que trae su <html> y su <body> y no cuenta con la navegación ni
 * con la fuente de la aplicación (la variable de next/font la pone el layout):
 * por eso usa la fuente del sistema.
 */
export default function ErrorGeneral({
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
    <html lang="es">
      <body
        className="grid min-h-dvh place-items-center px-4"
        style={{ fontFamily: 'system-ui, sans-serif' }}
      >
        <main role="alert" className="max-w-sm text-center">
          <h1 className="text-lg font-semibold text-gris-900">La aplicación no ha podido arrancar</h1>
          <p className="mt-2 text-sm leading-relaxed text-gris-500">
            Ha ocurrido un error inesperado. Vuelve a intentarlo en unos segundos.
          </p>
          <Boton className="mt-5" onClick={() => retry()}>
            Reintentar
          </Boton>
        </main>
      </body>
    </html>
  )
}

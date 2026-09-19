'use client'

import { Search, X } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useRef, useState, useTransition } from 'react'

import { cn } from '@/lib/utils'

type Props = {
  /** Texto de ayuda dentro del campo. */
  marcador?: string
  /** Nombre del parámetro en la URL. */
  parametro?: string
  className?: string
}

/**
 * Campo de búsqueda que escribe en la URL.
 *
 * Se espera un momento antes de navegar (300 ms) para no lanzar una consulta
 * por cada tecla, y el valor vive en la dirección: se puede compartir el enlace
 * o volver atrás sin perder la búsqueda.
 */
export function Buscador({ marcador = 'Buscar…', parametro = 'q', className }: Props) {
  const router = useRouter()
  const ruta = usePathname()
  const parametros = useSearchParams()
  const [pendiente, iniciarTransicion] = useTransition()

  const valorUrl = parametros.get(parametro) ?? ''
  const [valor, setValor] = useState(valorUrl)
  const [urlAnterior, setUrlAnterior] = useState(valorUrl)
  const primerRender = useRef(true)

  // Si la URL cambia por otro camino (un chip de filtro, volver atrás, un
  // enlace del panel), el campo tiene que reflejarlo. Se ajusta durante el
  // render comparando con el valor anterior, que es la forma recomendada:
  // con un efecto se provocaría un render en cascada por cada tecla.
  if (urlAnterior !== valorUrl) {
    setUrlAnterior(valorUrl)
    setValor(valorUrl)
  }

  useEffect(() => {
    if (primerRender.current) {
      primerRender.current = false
      return
    }
    if (valor === valorUrl) return

    const temporizador = setTimeout(() => {
      const siguientes = new URLSearchParams(parametros.toString())
      if (valor.trim()) siguientes.set(parametro, valor.trim())
      else siguientes.delete(parametro)
      const query = siguientes.toString()
      iniciarTransicion(() => router.replace(query ? `${ruta}?${query}` : ruta, { scroll: false }))
    }, 300)

    return () => clearTimeout(temporizador)
    // `parametros` cambia de identidad en cada render; basta con el texto.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [valor, valorUrl, parametro, ruta])

  return (
    <div className={cn('relative', className)}>
      <Search
        className={cn(
          'pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2',
          pendiente ? 'animate-pulse text-marca-500' : 'text-gris-500',
        )}
        aria-hidden
      />
      <input
        type="search"
        value={valor}
        onChange={(evento) => setValor(evento.target.value)}
        placeholder={marcador}
        aria-label={marcador}
        className="h-12 w-full rounded-panel border border-transparent bg-white pr-11 pl-11 text-gris-900 ring-1 ring-gris-200/70 transition-colors placeholder:text-gris-500 hover:ring-gris-300 focus:border-marca-500 focus:ring-4 focus:ring-marca-100 focus:outline-none"
      />
      {valor && (
        <button
          type="button"
          onClick={() => setValor('')}
          aria-label="Borrar la búsqueda"
          className="absolute top-1/2 right-2.5 grid size-8 -translate-y-1/2 place-items-center rounded-full text-gris-500 transition-colors hover:bg-gris-100 hover:text-gris-800"
        >
          <X className="size-4" aria-hidden />
        </button>
      )}
    </div>
  )
}

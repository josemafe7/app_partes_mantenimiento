'use client'

import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useTransition } from 'react'

import { Selector } from './Campo'

type Props = {
  /** Nombre del parámetro que se escribe en la URL. */
  parametro: string
  valor: string
  etiqueta: string
  opciones: { valor: string; etiqueta: string }[]
  /** Texto de la opción que no filtra. */
  textoTodos: string
  className?: string
}

/** Desplegable que filtra escribiendo en la URL, sin necesidad de un botón. */
export function SelectorUrl({
  parametro,
  valor,
  etiqueta,
  opciones,
  textoTodos,
  className,
}: Props) {
  const router = useRouter()
  const ruta = usePathname()
  const parametros = useSearchParams()
  const [pendiente, iniciarTransicion] = useTransition()

  return (
    <Selector
      aria-label={etiqueta}
      value={valor}
      disabled={pendiente}
      className={className}
      onChange={(evento) => {
        const siguientes = new URLSearchParams(parametros.toString())
        if (evento.target.value) siguientes.set(parametro, evento.target.value)
        else siguientes.delete(parametro)
        const query = siguientes.toString()
        iniciarTransicion(() => router.replace(query ? `${ruta}?${query}` : ruta, { scroll: false }))
      }}
    >
      <option value="">{textoTodos}</option>
      {opciones.map((opcion) => (
        <option key={opcion.valor} value={opcion.valor}>
          {opcion.etiqueta}
        </option>
      ))}
    </Selector>
  )
}

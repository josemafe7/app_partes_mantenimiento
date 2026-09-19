import Link from 'next/link'

import { cn } from '@/lib/utils'

type Props = {
  etiqueta: string
  valor: number
  href: string
  /** Punto de color: el mismo que usa ese tipo de trabajo en el resto de la app. */
  punto: string
  /** Aclaración breve bajo el número. */
  nota: string
  /** Dato secundario en una etiqueta junto a la cifra. */
  extra?: { texto: string; titulo: string; alerta?: boolean }
}

/**
 * Una celda de la fila de contadores del panel: la cifra y, al pulsarla, el
 * listado ya filtrado. Las celdas van juntas dentro de un mismo panel,
 * separadas por filetes, en lugar de ser seis tarjetas sueltas.
 */
export function TarjetaContador({ etiqueta, valor, href, punto, nota, extra }: Props) {
  const apagado = valor === 0

  return (
    <Link
      href={href}
      className="group flex flex-col bg-white px-5 pt-4 pb-4.5 transition-colors hover:bg-gris-50 sm:px-6"
    >
      <span className="flex items-center gap-2 text-sm text-gris-600">
        <span className={cn('size-2 shrink-0 rounded-full', apagado ? 'bg-gris-300' : punto)} aria-hidden />
        {etiqueta}
      </span>

      <span className="mt-2.5 flex flex-wrap items-center gap-x-2.5 gap-y-1">
        <span
          className={cn(
            'cifra text-[2.625rem] leading-none font-medium',
            apagado ? 'text-gris-300' : 'text-gris-950',
          )}
        >
          {valor}
        </span>
        {extra && !apagado && (
          <span
            title={extra.titulo}
            className={cn(
              'inline-flex h-6 items-center rounded-full px-2 text-xs font-medium ring-1 ring-inset',
              extra.alerta
                ? 'bg-coral-50 text-coral-700 ring-coral-200'
                : 'bg-gris-50 text-gris-600 ring-gris-200',
            )}
          >
            {extra.texto}
          </span>
        )}
      </span>

      <span className="mt-2 text-[0.8125rem] text-gris-500 group-hover:text-gris-700">{nota}</span>
    </Link>
  )
}

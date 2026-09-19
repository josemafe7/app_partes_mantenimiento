import Link from 'next/link'

import { EstadoEtiqueta } from '@/componentes/ui/Etiqueta'
import type { AvisoEnLista } from '@/db/consultas/avisos'
import { ESTADO, ESTADOS } from '@/lib/dominio'
import { desdeISO, fechaLarga } from '@/lib/fechas'
import { cn, plural } from '@/lib/utils'

const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Visitas que caben en la casilla de un día. Si hay más, la última línea pasa a ser «+N más». */
const CABEN = 3

type Props = {
  /** Día 1 del mes que se muestra. */
  inicio: string
  /** Semanas completas de lunes a domingo que cubren el mes (ver `cuadriculaMes`). */
  dias: string[]
  porDia: Map<string, AvisoEnLista[]>
  hoy: string
  /** Enlace a la semana de un día: es lo que abre pulsar su casilla. */
  enlaceSemana: (dia: string) => string
}

/**
 * El mes de un vistazo. Cada casilla es un enlace a su semana, que es donde se
 * ven las visitas con detalle; aquí solo se ve cuántas hay y de qué color.
 */
export function VistaMes({ inicio, dias, porDia, hoy, enlaceSemana }: Props) {
  const mes = inicio.slice(0, 7)

  return (
    <div className="rounded-panel bg-white p-1.5 ring-1 ring-gris-200/70 sm:p-3">
      <div className="grid grid-cols-7 gap-0.5 pt-1 pb-2 text-center text-xs font-medium text-gris-500 sm:gap-1" aria-hidden>
        {DIAS_CORTOS.map((dia) => (
          <span key={dia}>{dia}</span>
        ))}
      </div>

      <ol className="grid grid-cols-7 gap-0.5 sm:gap-1">
        {dias.map((dia) => {
          const delDia = porDia.get(dia) ?? []
          const esHoy = dia === hoy
          const delMes = dia.startsWith(mes)
          const visibles = delDia.length > CABEN ? delDia.slice(0, CABEN - 1) : delDia
          const resto = delDia.length - visibles.length

          return (
            <li key={dia}>
              <Link
                href={enlaceSemana(dia)}
                aria-label={`${fechaLarga(dia)}${esHoy ? ', hoy' : ''}: ${delDia.length ? plural(delDia.length, 'visita', 'visitas') : 'sin visitas'}. Abrir la semana`}
                className={cn(
                  'flex h-full min-h-14 flex-col items-center gap-1 rounded-control p-1 transition-colors md:min-h-28 md:items-stretch md:p-1.5',
                  delMes ? 'bg-gris-50 hover:bg-gris-100' : 'hover:bg-gris-50',
                )}
              >
                <span
                  className={cn(
                    'cifra grid size-7 shrink-0 place-items-center rounded-full text-sm font-medium',
                    esHoy ? 'bg-lavanda-200 text-lavanda-700' : delMes ? 'text-gris-900' : 'text-gris-400',
                  )}
                >
                  {desdeISO(dia).getDate()}
                </span>

                {/* Móvil: un punto por visita. */}
                {delDia.length > 0 && (
                  <span
                    className={cn('flex flex-wrap items-center justify-center gap-0.5 md:hidden', !delMes && 'opacity-60')}
                    aria-hidden
                  >
                    {visibles.map((aviso) => (
                      <span key={aviso.id} className={cn('size-1.5 rounded-full', ESTADO[aviso.estado].punto)} />
                    ))}
                    {resto > 0 && (
                      <span className="text-[0.625rem] leading-none font-medium text-gris-600">+{resto}</span>
                    )}
                  </span>
                )}

                {/* Escritorio: la hora y el título en el pastel del estado. */}
                {visibles.length > 0 && (
                  <ul className={cn('hidden flex-col gap-1 md:flex', !delMes && 'opacity-60')}>
                    {visibles.map((aviso) => (
                      <li
                        key={aviso.id}
                        title={`${aviso.horaProgramada ?? 'Sin hora'} · ${aviso.titulo} · ${ESTADO[aviso.estado].etiqueta}`}
                        className={cn(
                          'truncate rounded-full px-2 py-0.5 text-xs text-gris-900 ring-1 ring-inset',
                          ESTADO[aviso.estado].tarjeta,
                        )}
                      >
                        {aviso.horaProgramada && <span className="font-semibold">{aviso.horaProgramada} </span>}
                        {aviso.titulo}
                      </li>
                    ))}
                  </ul>
                )}
                {resto > 0 && (
                  <span className="hidden px-2 text-xs font-medium text-gris-600 md:block">+{resto} más</span>
                )}
              </Link>
            </li>
          )
        })}
      </ol>

      {/* Las casillas no tienen sitio para el nombre del estado: la leyenda lo da. */}
      <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-gris-100 px-1.5 pt-3 pb-1">
        {ESTADOS.map((estado) => (
          <EstadoEtiqueta key={estado} estado={estado} className="h-5 px-2 text-xs" />
        ))}
      </div>
    </div>
  )
}

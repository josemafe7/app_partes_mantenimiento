import { ESTADO } from '@/lib/dominio'
import { fechaHora, haceTiempo } from '@/lib/fechas'
import type { AvisoCompleto } from '@/db/consultas/avisos'
import { cn } from '@/lib/utils'

type Props = { movimientos: AvisoCompleto['movimientos'] }

/** Historial del aviso, de lo más reciente a lo más antiguo. */
export function Cronologia({ movimientos }: Props) {
  return (
    <ol className="relative flex flex-col gap-5">
      {/* Línea vertical que une los hitos. */}
      <span className="absolute top-2 bottom-2 left-[5px] w-px bg-gris-200" aria-hidden />

      {movimientos.map((movimiento) => {
        const cambio =
          movimiento.estadoAnterior !== null && movimiento.estadoAnterior !== movimiento.estadoNuevo

        return (
          <li key={movimiento.id} className="relative flex gap-3.5">
            <span
              className={cn(
                'relative z-10 mt-1.5 size-[11px] shrink-0 rounded-full ring-3 ring-white',
                ESTADO[movimiento.estadoNuevo].punto,
              )}
              aria-hidden
            />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2.5">
                <span className="text-[0.9375rem] font-medium text-gris-900">
                  {cambio && movimiento.estadoAnterior ? (
                    <>
                      {ESTADO[movimiento.estadoAnterior].etiqueta}
                      <span className="mx-1.5 text-gris-400" aria-label="pasa a">
                        →
                      </span>
                      {ESTADO[movimiento.estadoNuevo].etiqueta}
                    </>
                  ) : (
                    ESTADO[movimiento.estadoNuevo].etiqueta
                  )}
                </span>
                <time
                  dateTime={movimiento.fecha.toISOString()}
                  title={fechaHora(movimiento.fecha)}
                  className="text-[0.8125rem] text-gris-500"
                >
                  {haceTiempo(movimiento.fecha)}
                </time>
              </div>
              {movimiento.nota && (
                <p className="mt-0.5 max-w-[68ch] text-sm leading-relaxed text-gris-600">{movimiento.nota}</p>
              )}
              {movimiento.usuario && (
                <p className="mt-0.5 text-[0.8125rem] text-gris-500">Por {movimiento.usuario.nombre}</p>
              )}
            </div>
          </li>
        )
      })}
    </ol>
  )
}

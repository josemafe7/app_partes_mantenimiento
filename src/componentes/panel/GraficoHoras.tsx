import type { SemanaHoras } from '@/db/consultas/panel'
import { fechaBreve, horasTexto } from '@/lib/fechas'
import { cn, plural } from '@/lib/utils'

/** Redondea el techo del eje a una cifra limpia: 10, 20, 25, 40, 50… */
function techoDelEje(valor: number): number {
  const pasos = [10, 20, 25, 40, 50, 80, 100, 150, 200, 250, 400, 500, 1000]
  return pasos.find((paso) => paso >= valor) ?? Math.ceil(valor / 500) * 500
}

/**
 * Horas anotadas en los partes, semana a semana.
 *
 * Es un gráfico de énfasis: todas las semanas en gris y la actual en coral,
 * que es la que interesa. La línea discontinua es la media de las semanas ya
 * cerradas (la actual va a medias y la bajaría). Cada barra se puede enfocar
 * con el teclado y enseña su valor igual que al pasar el ratón.
 */
export function GraficoHoras({ semanas }: { semanas: SemanaHoras[] }) {
  const actual = semanas.length - 1
  const cerradas = semanas.slice(0, actual)
  const media = cerradas.length ? cerradas.reduce((total, semana) => total + semana.horas, 0) / cerradas.length : 0
  const tope = techoDelEje(Math.max(media, ...semanas.map((semana) => semana.horas)))
  const altura = (horas: number) => `${(horas / tope) * 100}%`

  return (
    // Ocupa todo el alto que le deje el panel: junto a la agenda, que crece con
    // las visitas del día, el gráfico se estira en lugar de dejar un hueco.
    <figure className="flex flex-1 flex-col">
      <figcaption className="sr-only">
        Horas anotadas en los partes durante las últimas {semanas.length} semanas. Media de las
        semanas cerradas: {horasTexto(Math.round(media * 10) / 10)}.
      </figcaption>

      <div className="relative min-h-52 flex-1 sm:min-h-56">
        {/* Rejilla: tres filetes y sus cifras */}
        {[tope, tope / 2, 0].map((valor) => (
          <div
            key={valor}
            className="absolute inset-x-0 flex translate-y-1/2 items-center gap-2"
            style={{ bottom: altura(valor) }}
            aria-hidden
          >
            <span className="w-8 shrink-0 text-right text-xs text-gris-500 tabular-nums">{valor}</span>
            <span className="h-px flex-1 bg-gris-200/80" />
          </div>
        ))}

        {/* Barras */}
        <div className="absolute inset-y-0 right-0 left-10 flex items-end">
          {semanas.map((semana, indice) => {
            const esActual = indice === actual
            const descripcion = `${esActual ? 'Esta semana' : `Semana del ${fechaBreve(semana.lunes)}`}: ${horasTexto(semana.horas)} en ${plural(semana.partes, 'parte', 'partes')}`

            return (
              <div
                key={semana.lunes}
                tabIndex={0}
                aria-label={descripcion}
                className="group relative flex h-full flex-1 items-end justify-center rounded-md focus-visible:outline-offset-0"
              >
                <div
                  className={cn(
                    'barra-grafico w-6 rounded-t-[4px] transition-colors',
                    esActual ? 'bg-coral-500' : 'bg-gris-300 group-hover:bg-gris-400',
                  )}
                  style={{ height: altura(semana.horas), animationDelay: `${indice * 45}ms` }}
                />

                {/* Solo la semana actual lleva su cifra a la vista */}
                {esActual && (
                  <span
                    className="absolute left-1/2 -translate-x-1/2 pb-1.5 text-sm font-semibold whitespace-nowrap text-gris-950 transition-opacity group-hover:opacity-0 group-focus-visible:opacity-0"
                    style={{ bottom: altura(semana.horas) }}
                    aria-hidden
                  >
                    {horasTexto(semana.horas)}
                  </span>
                )}

                {/* Etiqueta flotante al pasar el ratón o al enfocar */}
                <span
                  className="pointer-events-none invisible absolute left-1/2 z-10 mb-2 -translate-x-1/2 rounded-control bg-gris-950 px-3 py-2 text-left whitespace-nowrap opacity-0 shadow-flotante transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100"
                  style={{ bottom: altura(semana.horas) }}
                  aria-hidden
                >
                  <span className="block text-sm font-semibold text-white">{horasTexto(semana.horas)}</span>
                  <span className="block text-xs text-gris-300">
                    {esActual ? 'Esta semana' : `Semana del ${fechaBreve(semana.lunes)}`},{' '}
                    {plural(semana.partes, 'parte', 'partes')}
                  </span>
                </span>
              </div>
            )
          })}
        </div>

        {/* Media de las semanas cerradas */}
        {media > 0 && (
          <div
            className="pointer-events-none absolute right-0 left-10 flex translate-y-1/2 items-center"
            style={{ bottom: altura(media) }}
            aria-hidden
          >
            <span className="shrink-0 rounded-md bg-marca-700 px-2 py-0.5 text-xs font-medium whitespace-nowrap text-white">
              Media {horasTexto(Math.round(media * 10) / 10)}
            </span>
            <span className="h-0 flex-1 border-t border-dashed border-marca-700/60" />
          </div>
        )}
      </div>

      {/* Eje de semanas */}
      <div className="mt-3 ml-10 flex" aria-hidden>
        {semanas.map((semana, indice) => {
          const esActual = indice === actual
          return (
            <span
              key={semana.lunes}
              className={cn(
                'min-w-0 flex-1 text-center text-xs whitespace-nowrap',
                esActual ? 'font-semibold text-gris-950' : 'text-gris-500',
                // En el móvil no caben todas: se enseña una de cada dos.
                !esActual && (actual - indice) % 2 === 1 && 'max-sm:invisible',
              )}
            >
              {esActual ? 'Esta semana' : fechaBreve(semana.lunes)}
            </span>
          )
        })}
      </div>
    </figure>
  )
}

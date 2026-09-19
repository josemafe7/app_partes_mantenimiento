import Link from 'next/link'

import { IconoCategoria } from '@/componentes/avisos/IconoCategoria'
import type { AvisoEnLista } from '@/db/consultas/avisos'
import { ESTADO } from '@/lib/dominio'
import { desdeISO, fechaLarga, sumarDias } from '@/lib/fechas'
import { cn, plural } from '@/lib/utils'

const DIAS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']
const NOMBRES = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo']

/** Tarjeta pastel de una visita: el color es el del estado del aviso. */
function Visita({ aviso }: { aviso: AvisoEnLista }) {
  const estado = ESTADO[aviso.estado]
  return (
    <li>
      <Link
        href={`/avisos/${aviso.id}`}
        className={cn('flex items-center gap-3 rounded-tarjeta p-2.5 pr-3.5 ring-1 ring-inset transition-shadow', estado.tarjeta)}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-[0.625rem] bg-white/85 text-gris-800">
          <IconoCategoria categoria={aviso.categoria} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[0.9375rem] font-medium text-gris-950">{aviso.titulo}</span>
          <span className="flex gap-2 text-[0.8125rem] text-gris-700">
            <span className="shrink-0 font-medium">{aviso.horaProgramada ?? 'Sin hora'}</span>
            <span className="truncate">{aviso.localNombre}</span>
          </span>
        </span>
        <span className="shrink-0 text-xs font-medium text-gris-700">{estado.etiqueta}</span>
      </Link>
    </li>
  )
}

function Grupo({ titulo, avisos, limite, masHref }: { titulo: string; avisos: AvisoEnLista[]; limite: number; masHref: string }) {
  const sobran = avisos.length - limite
  return (
    <div>
      <div className="mb-2 flex items-center gap-3 text-sm text-gris-500">
        <span className="shrink-0">{titulo}</span>
        <span className="h-px flex-1 bg-gris-200/80" aria-hidden />
      </div>
      <ul className="flex flex-col gap-2">
        {avisos.slice(0, limite).map((aviso) => (
          <Visita key={aviso.id} aviso={aviso} />
        ))}
      </ul>
      {sobran > 0 && (
        <Link href={masHref} className="mt-2 inline-block text-sm font-medium text-marca-700 hover:underline">
          {sobran === 1 ? 'Una visita más' : `${sobran} visitas más`}
        </Link>
      )}
    </div>
  )
}

type Props = {
  hoy: string
  /** Los siete días de esta semana, de lunes a domingo. */
  dias: string[]
  /** Visitas desde el lunes hasta una semana después de hoy. */
  avisos: AvisoEnLista[]
}

/** La semana de un vistazo y, debajo, lo que toca hoy y en la siguiente jornada con trabajo. */
export function AgendaSemana({ hoy, dias, avisos }: Props) {
  const porDia = new Map<string, AvisoEnLista[]>()
  for (const aviso of avisos) {
    if (!aviso.fechaProgramada) continue
    porDia.set(aviso.fechaProgramada, [...(porDia.get(aviso.fechaProgramada) ?? []), aviso])
  }

  const deHoy = porDia.get(hoy) ?? []
  const siguiente = [...porDia.keys()].filter((dia) => dia > hoy).sort()[0]
  const manana = sumarDias(hoy, 1)

  return (
    <div className="flex flex-col gap-5">
      <ol className="grid grid-cols-7 gap-1 text-center">
        {dias.map((dia, indice) => {
          const cuenta = porDia.get(dia)?.length ?? 0
          const esHoy = dia === hoy
          return (
            <li key={dia}>
              <Link
                href={`/agenda?semana=${dia}`}
                aria-label={`${NOMBRES[indice]} ${desdeISO(dia).getDate()}${esHoy ? ', hoy' : ''}: ${cuenta ? plural(cuenta, 'visita', 'visitas') : 'sin visitas'}`}
                className="flex flex-col items-center gap-1 rounded-control py-1.5 transition-colors hover:bg-gris-50"
              >
                <span className="text-xs text-gris-500">{DIAS[indice]}</span>
                <span
                  className={cn(
                    'grid size-9 place-items-center rounded-full text-[0.9375rem] font-medium',
                    esHoy ? 'bg-lavanda-200 text-lavanda-700' : 'text-gris-900',
                  )}
                >
                  {desdeISO(dia).getDate()}
                </span>
                <span
                  className={cn('size-1.5 rounded-full', cuenta > 0 ? 'bg-marca-500' : 'bg-transparent')}
                  aria-hidden
                />
              </Link>
            </li>
          )
        })}
      </ol>

      {deHoy.length > 0 ? (
        <Grupo titulo="Hoy" avisos={deHoy} limite={3} masHref="/agenda" />
      ) : (
        <p className="rounded-tarjeta bg-gris-50 px-4 py-3 text-sm text-gris-600">
          Hoy no hay visitas programadas.
        </p>
      )}

      {siguiente && (
        <Grupo
          titulo={siguiente === manana ? 'Mañana' : fechaLarga(siguiente)}
          avisos={porDia.get(siguiente) ?? []}
          limite={2}
          masHref={`/agenda?semana=${siguiente}`}
        />
      )}
    </div>
  )
}

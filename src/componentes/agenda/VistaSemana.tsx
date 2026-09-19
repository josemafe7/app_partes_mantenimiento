import { MapPin } from 'lucide-react'
import Link from 'next/link'

import { IconoCategoria } from '@/componentes/avisos/IconoCategoria'
import { AvatarTecnico } from '@/componentes/avisos/ListaAvisos'
import { PrioridadEtiqueta } from '@/componentes/ui/Etiqueta'
import type { AvisoEnLista } from '@/db/consultas/avisos'
import { ESTADO } from '@/lib/dominio'
import { desdeISO } from '@/lib/fechas'
import { cn, plural } from '@/lib/utils'

const NOMBRES_DIA = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo']
const DIAS_CORTOS = ['Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb', 'Dom']

/** Visita de la agenda: tarjeta pastel del color del estado del aviso. */
function Visita({ aviso }: { aviso: AvisoEnLista }) {
  const urgente = aviso.prioridad === 'alta' || aviso.prioridad === 'urgente'
  return (
    <li>
      <Link
        href={`/avisos/${aviso.id}`}
        className={cn('block rounded-tarjeta p-3 ring-1 ring-inset transition-shadow', ESTADO[aviso.estado].tarjeta)}
      >
        <div className="flex items-center gap-2">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/85 text-gris-800">
            <IconoCategoria categoria={aviso.categoria} className="size-3.5" />
          </span>
          {aviso.horaProgramada ? (
            <span className="text-sm font-semibold text-gris-950">{aviso.horaProgramada}</span>
          ) : (
            <span className="text-xs font-medium whitespace-nowrap text-gris-600">Sin hora</span>
          )}
          <AvatarTecnico
            nombre={aviso.tecnicoNombre}
            apellidos={aviso.tecnicoApellidos}
            className="ml-auto size-6 bg-white/85 text-[0.625rem]"
          />
        </div>
        <p className="mt-2 line-clamp-2 text-sm leading-snug font-medium text-gris-950">{aviso.titulo}</p>
        <p className="mt-1 flex items-start gap-1 text-[0.8125rem] text-gris-700">
          <MapPin className="mt-0.5 size-3.5 shrink-0 opacity-60" aria-hidden />
          <span className="line-clamp-2">{aviso.localNombre}</span>
        </p>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium text-gris-700">
          {ESTADO[aviso.estado].etiqueta}
          {urgente && <PrioridadEtiqueta prioridad={aviso.prioridad} className="h-5 px-2 text-xs" />}
        </p>
      </Link>
    </li>
  )
}

type Props = {
  /** Los siete días, de lunes a domingo. */
  dias: string[]
  porDia: Map<string, AvisoEnLista[]>
  hoy: string
}

/** Siete columnas con las visitas de cada día; en el móvil, una lista agrupada por días. */
export function VistaSemana({ dias, porDia, hoy }: Props) {
  return (
    <div className="grid grid-cols-1 gap-3 lg:grid-cols-7 lg:gap-2.5">
      {dias.map((dia, indice) => {
        const delDia = porDia.get(dia) ?? []
        const esHoy = dia === hoy
        const finDeSemana = indice >= 5

        return (
          <section
            key={dia}
            aria-label={`${NOMBRES_DIA[indice]} ${desdeISO(dia).getDate()}${esHoy ? ', hoy' : ''}`}
            className={cn(
              'flex flex-col rounded-panel ring-1',
              finDeSemana && !esHoy ? 'bg-white/55 ring-gris-200/50' : 'bg-white ring-gris-200/70',
              // En el móvil los días sin visitas se quedan en una línea.
              delDia.length === 0 && 'max-lg:flex-row max-lg:items-center',
            )}
          >
            <header className="flex items-center gap-3 px-3.5 pt-3 pb-2.5 lg:flex-col lg:items-start lg:gap-1">
              <span className="flex items-center gap-2.5 lg:w-full">
                <span
                  className={cn(
                    'cifra grid size-10 shrink-0 place-items-center rounded-full text-xl font-medium',
                    esHoy ? 'bg-lavanda-200 text-lavanda-700' : 'text-gris-950',
                  )}
                >
                  {desdeISO(dia).getDate()}
                </span>
                <span className="leading-tight">
                  <span className="block text-sm font-medium text-gris-900 lg:hidden">{NOMBRES_DIA[indice]}</span>
                  <span className="hidden text-sm font-medium text-gris-900 lg:block">{DIAS_CORTOS[indice]}</span>
                  <span className="block text-xs text-gris-500">
                    {esHoy ? 'Hoy' : delDia.length ? plural(delDia.length, 'visita', 'visitas') : 'Sin visitas'}
                  </span>
                </span>
              </span>
            </header>

            {delDia.length > 0 && (
              <ul className="flex flex-1 flex-col gap-2 px-2 pb-2">
                {delDia.map((aviso) => (
                  <Visita key={aviso.id} aviso={aviso} />
                ))}
              </ul>
            )}
            {delDia.length === 0 && (
              <p className="hidden px-3.5 pb-4 text-xs text-gris-400 lg:block" aria-hidden>
                Libre
              </p>
            )}
          </section>
        )
      })}
    </div>
  )
}

import { CalendarClock, MapPin, NotebookPen, UserRound } from 'lucide-react'
import Link from 'next/link'

import type { AvisoEnLista } from '@/db/consultas/avisos'
import { CATEGORIA } from '@/lib/dominio'
import { diasDeRetraso, fechaRelativa, horasTexto } from '@/lib/fechas'
import { cn, iniciales } from '@/lib/utils'

import { EstadoEtiqueta, PrioridadEtiqueta, RetrasoEtiqueta } from '../ui/Etiqueta'
import { IconoCategoria } from './IconoCategoria'

function nombreCorto(nombre: string | null, apellidos: string | null): string {
  if (!nombre) return 'Sin asignar'
  const primerApellido = apellidos?.trim().split(' ')[0]
  return primerApellido ? `${nombre} ${primerApellido}` : nombre
}

/** Iniciales del técnico en un círculo; hueco punteado si no hay nadie asignado. */
export function AvatarTecnico({
  nombre,
  apellidos,
  className,
}: {
  nombre: string | null
  apellidos: string | null
  className?: string
}) {
  if (!nombre) {
    return (
      <span
        className={cn(
          'grid size-7 shrink-0 place-items-center rounded-full border border-dashed border-gris-300 bg-white text-gris-400',
          className,
        )}
        aria-hidden
      >
        <UserRound className="size-[55%]" />
      </span>
    )
  }
  return (
    <span
      className={cn(
        'grid size-7 shrink-0 place-items-center rounded-full bg-marca-100 text-[0.6875rem] font-semibold text-marca-800',
        className,
      )}
      aria-hidden
    >
      {iniciales(nombre, apellidos)}
    </span>
  )
}

/** Referencia del aviso: cifras alineadas, sin tipografía de máquina de escribir. */
export function Referencia({ children, className }: { children: string; className?: string }) {
  return (
    <span className={cn('text-[0.8125rem] font-medium text-gris-500 tabular-nums', className)}>{children}</span>
  )
}

function estaRetrasado(aviso: AvisoEnLista) {
  const retraso = diasDeRetraso(aviso.fechaProgramada)
  return { retraso, retrasado: retraso > 0 && aviso.estado !== 'finalizado' && aviso.estado !== 'cancelado' }
}

/* ------------------------------------------------------------------ Tarjeta */

function TarjetaAviso({ aviso }: { aviso: AvisoEnLista }) {
  const { retraso, retrasado } = estaRetrasado(aviso)

  return (
    <li>
      <Link
        href={`/avisos/${aviso.id}`}
        className="block px-5 py-4 transition-colors hover:bg-gris-50 active:bg-gris-100"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Referencia>{aviso.referencia}</Referencia>
          <EstadoEtiqueta estado={aviso.estado} />
          {(aviso.prioridad === 'alta' || aviso.prioridad === 'urgente') && (
            <PrioridadEtiqueta prioridad={aviso.prioridad} />
          )}
        </div>

        <p className="mt-2 font-medium text-gris-950">{aviso.titulo}</p>

        <p className="mt-1 flex items-start gap-1.5 text-sm text-gris-600">
          <MapPin className="mt-0.5 size-3.5 shrink-0 text-gris-400" aria-hidden />
          <span className="min-w-0">
            {aviso.clienteNombre}, {aviso.localNombre}
            <span className="text-gris-500"> ({aviso.localCiudad})</span>
          </span>
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2 text-[0.8125rem] text-gris-600">
          <span className="flex items-center gap-1.5">
            <CalendarClock className="size-3.5 text-gris-400" aria-hidden />
            {aviso.fechaProgramada ? fechaRelativa(aviso.fechaProgramada) : 'Sin programar'}
            {aviso.horaProgramada && `, ${aviso.horaProgramada}`}
          </span>
          <span className="flex items-center gap-1.5">
            <AvatarTecnico
              nombre={aviso.tecnicoNombre}
              apellidos={aviso.tecnicoApellidos}
              className="size-5 text-[0.5625rem]"
            />
            {nombreCorto(aviso.tecnicoNombre, aviso.tecnicoApellidos)}
          </span>
          {aviso.numPartes > 0 && (
            <span className="flex items-center gap-1.5">
              <NotebookPen className="size-3.5 text-gris-400" aria-hidden />
              {aviso.numPartes === 1 ? '1 parte' : `${aviso.numPartes} partes`}, {horasTexto(aviso.horasTotales)}
            </span>
          )}
          {retrasado && <RetrasoEtiqueta dias={retraso} />}
        </div>
      </Link>
    </li>
  )
}

/* -------------------------------------------------------------------- Tabla */

function FilaAviso({ aviso }: { aviso: AvisoEnLista }) {
  const { retrasado } = estaRetrasado(aviso)

  return (
    <tr className="group border-t border-gris-200/70 transition-colors hover:bg-gris-50">
      <td className="py-4 pr-3 pl-6 align-top whitespace-nowrap">
        <Link href={`/avisos/${aviso.id}`}>
          <Referencia className="group-hover:text-marca-700">{aviso.referencia}</Referencia>
        </Link>
      </td>
      <td className="px-3 py-3.5 align-top">
        <div className="flex items-start gap-3">
          <span
            className="grid size-9 shrink-0 place-items-center rounded-[0.625rem] bg-gris-50 text-gris-700 ring-1 ring-gris-200/70"
            title={CATEGORIA[aviso.categoria].etiqueta}
          >
            <IconoCategoria categoria={aviso.categoria} />
          </span>
          <div className="min-w-0">
            <Link
              href={`/avisos/${aviso.id}`}
              className="block truncate font-medium text-gris-950 hover:text-marca-700"
            >
              {aviso.titulo}
            </Link>
            <p className="mt-0.5 truncate text-sm text-gris-500">
              {aviso.clienteNombre}, {aviso.localNombre} ({aviso.localCiudad})
            </p>
          </div>
        </div>
      </td>
      <td className="px-3 py-3.5 align-top">
        <div className="flex flex-col items-start gap-1.5">
          <EstadoEtiqueta estado={aviso.estado} />
          {aviso.prioridad !== 'normal' && <PrioridadEtiqueta prioridad={aviso.prioridad} />}
        </div>
      </td>
      <td className="px-3 py-3.5 align-top">
        <span className="flex items-center gap-2 text-sm text-gris-700">
          <AvatarTecnico nombre={aviso.tecnicoNombre} apellidos={aviso.tecnicoApellidos} />
          <span className="truncate">{nombreCorto(aviso.tecnicoNombre, aviso.tecnicoApellidos)}</span>
        </span>
      </td>
      <td className="px-3 py-3.5 align-top text-sm whitespace-nowrap">
        <span className={retrasado ? 'font-medium text-coral-700' : 'text-gris-800'}>
          {aviso.fechaProgramada ? fechaRelativa(aviso.fechaProgramada) : '—'}
        </span>
        {aviso.horaProgramada && <span className="block text-xs text-gris-500">{aviso.horaProgramada}</span>}
      </td>
      <td className="py-3.5 pr-6 pl-3 text-right align-top text-sm whitespace-nowrap text-gris-800 tabular-nums">
        {aviso.numPartes > 0 ? (
          <>
            {aviso.numPartes}
            <span className="block text-xs text-gris-500">{horasTexto(aviso.horasTotales)}</span>
          </>
        ) : (
          <span className="text-gris-300">—</span>
        )}
      </td>
    </tr>
  )
}

/* ------------------------------------------------------------------- Lista */

/**
 * Listado de avisos: tarjetas hasta pantallas medianas y tabla en escritorio
 * ancho. Son dos maquetaciones distintas porque en un móvil una tabla obliga a
 * desplazarse en horizontal, y eso a pie de obra no sirve. La tabla tiene
 * anchos fijos: la columna del aviso se lleva el sitio que sobre y recorta.
 */
export function ListaAvisos({ avisos }: { avisos: AvisoEnLista[] }) {
  return (
    <>
      <ul className="divide-y divide-gris-200/70 xl:hidden">
        {avisos.map((aviso) => (
          <TarjetaAviso key={aviso.id} aviso={aviso} />
        ))}
      </ul>

      <div className="hidden xl:block">
        <table className="w-full table-fixed border-collapse text-left">
          <colgroup>
            <col className="w-36" />
            <col />
            <col className="w-36" />
            <col className="w-48" />
            <col className="w-28" />
            <col className="w-24" />
          </colgroup>
          <thead>
            <tr className="text-[0.8125rem] text-gris-500">
              <th scope="col" className="py-3 pr-3 pl-6 font-medium">
                Ref.
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Aviso
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Estado
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Técnico
              </th>
              <th scope="col" className="px-3 py-3 font-medium">
                Prevista
              </th>
              <th scope="col" className="py-3 pr-6 pl-3 text-right font-medium">
                Partes
              </th>
            </tr>
          </thead>
          <tbody>
            {avisos.map((aviso) => (
              <FilaAviso key={aviso.id} aviso={aviso} />
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/** Lista compacta para el panel y las fichas: solo lo imprescindible. */
export function ListaAvisosCompacta({ avisos }: { avisos: AvisoEnLista[] }) {
  return (
    <ul className="divide-y divide-gris-200/70">
      {avisos.map((aviso) => {
        const { retraso, retrasado } = estaRetrasado(aviso)
        return (
          <li key={aviso.id}>
            <Link
              href={`/avisos/${aviso.id}`}
              className="flex items-start gap-3 px-5 py-3.5 transition-colors hover:bg-gris-50 sm:px-6"
            >
              <AvatarTecnico
                nombre={aviso.tecnicoNombre}
                apellidos={aviso.tecnicoApellidos}
                className="mt-0.5 size-8 text-xs"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-gris-950">{aviso.titulo}</p>
                <p className="truncate text-sm text-gris-500">
                  {aviso.clienteNombre}, {aviso.localNombre}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-1.5">
                  <EstadoEtiqueta estado={aviso.estado} />
                  {(aviso.prioridad === 'alta' || aviso.prioridad === 'urgente') && (
                    <PrioridadEtiqueta prioridad={aviso.prioridad} />
                  )}
                  {retrasado && <RetrasoEtiqueta dias={retraso} />}
                </div>
              </div>
              {/* El día siempre, y la hora debajo: «17:30» a secas no dice de cuándo */}
              <span className="shrink-0 pt-0.5 text-right text-[0.8125rem] leading-snug">
                <span className={cn('block font-medium', retrasado ? 'text-coral-700' : 'text-gris-700')}>
                  {fechaRelativa(aviso.fechaProgramada)}
                </span>
                {aviso.horaProgramada && <span className="block text-gris-500">{aviso.horaProgramada}</span>}
              </span>
            </Link>
          </li>
        )
      })}
    </ul>
  )
}

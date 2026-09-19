'use client'

import { CalendarDays, LogOut, Plus, Search, Wrench } from 'lucide-react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'

import { cerrarSesion } from '@/acciones/sesion'
import { ROL } from '@/lib/dominio'
import { puede, type Usuario } from '@/lib/permisos'
import { cn, iniciales } from '@/lib/utils'

import { enlaceActivo, enlacesDe } from './enlaces'

/** Iniciales del usuario en su círculo: lleva a «Mi cuenta». */
function AvatarUsuario({ nombre, className }: { nombre: string; className?: string }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center rounded-full bg-lima-300 font-semibold text-gris-950',
        className,
      )}
      aria-hidden
    >
      {iniciales(nombre)}
    </span>
  )
}

/** Marca de la aplicación: la llave en su azulejo verde. */
export function Marca({ compacta = false }: { compacta?: boolean }) {
  return (
    <span
      className={cn(
        'grid shrink-0 place-items-center bg-marca-700 text-lima-300',
        compacta ? 'size-8 rounded-[0.625rem]' : 'size-9 rounded-control',
      )}
      aria-hidden
    >
      <Wrench className={compacta ? 'size-4' : 'size-4.5'} strokeWidth={2.25} />
    </span>
  )
}

/* ------------------------------------------------------------ Escritorio */

/** Barra lateral de escritorio: un panel que flota sobre el lienzo. */
export function BarraLateral({ usuario }: { usuario: Usuario }) {
  const ruta = usePathname()
  const enlaces = enlacesDe(usuario)
  const activo = enlaceActivo(ruta, enlaces)

  return (
    <aside className="no-imprimir sticky top-0 hidden h-dvh p-3 pr-0 lg:block">
      <div className="flex h-full flex-col rounded-panel bg-white ring-1 ring-gris-200/70">
        <Link href="/" className="flex items-center gap-3 px-5 pt-5 pb-6">
          <Marca />
          <span className="leading-tight">
            <span className="titular block text-[1.0625rem] font-semibold text-gris-950">
              Avisos y partes
            </span>
            <span className="block text-[0.8125rem] text-gris-500">Mantenimiento de locales</span>
          </span>
        </Link>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3" aria-label="Menú principal">
          {enlaces.map((enlace) => {
            const { href, etiqueta, icono: Icono } = enlace
            const esActivo = activo?.href === href
            return (
              <Link
                key={href}
                href={href}
                aria-current={esActivo ? 'page' : undefined}
                className={cn(
                  'flex h-11 items-center gap-3 rounded-control px-3.5 text-[0.9375rem] transition-colors',
                  esActivo
                    ? 'bg-lima-300 font-medium text-gris-950'
                    : 'text-gris-600 hover:bg-gris-100 hover:text-gris-900',
                )}
              >
                <Icono
                  className={cn('size-5', esActivo ? 'text-gris-950' : 'text-gris-500')}
                  strokeWidth={esActivo ? 2.1 : 1.8}
                  aria-hidden
                />
                {etiqueta}
              </Link>
            )
          })}
        </nav>

        {/* Quién ha entrado: su cuenta y la salida */}
        <div className="m-3 flex items-center gap-1 rounded-tarjeta bg-gris-50 p-1.5">
          <Link
            href="/cuenta"
            aria-current={ruta === '/cuenta' ? 'page' : undefined}
            className="flex min-w-0 flex-1 items-center gap-2.5 rounded-control px-2 py-1.5 transition-colors hover:bg-white"
          >
            <AvatarUsuario nombre={usuario.nombre} className="size-9 text-xs" />
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-sm font-medium text-gris-900">{usuario.nombre}</span>
              <span className="block truncate text-[0.8125rem] text-gris-500">{ROL[usuario.rol].etiqueta}</span>
            </span>
          </Link>
          <form action={cerrarSesion}>
            <button
              type="submit"
              title="Cerrar sesión"
              aria-label="Cerrar sesión"
              className="grid size-11 place-items-center rounded-control text-gris-500 transition-colors hover:bg-white hover:text-coral-700"
            >
              <LogOut className="size-4.5" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </aside>
  )
}

/**
 * Búsqueda rápida de avisos desde cualquier pantalla. Busca en todos, también
 * en los cerrados: quien busca una referencia o un local suele querer el
 * historial completo. La tecla «/» la enfoca sin tocar el ratón.
 */
function BuscadorGlobal() {
  const router = useRouter()
  const [texto, setTexto] = useState('')
  const campo = useRef<HTMLInputElement>(null)

  useEffect(() => {
    function alPulsar(evento: KeyboardEvent) {
      const destino = evento.target as HTMLElement | null
      const escribiendo =
        destino?.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(destino?.tagName ?? '')
      if (evento.key === '/' && !escribiendo) {
        evento.preventDefault()
        campo.current?.focus()
      }
    }
    window.addEventListener('keydown', alPulsar)
    return () => window.removeEventListener('keydown', alPulsar)
  }, [])

  return (
    <form
      role="search"
      className="relative w-full max-w-md"
      onSubmit={(evento) => {
        evento.preventDefault()
        const termino = texto.trim()
        if (!termino) return
        router.push(`/avisos?vista=todos&q=${encodeURIComponent(termino)}`)
        setTexto('')
        campo.current?.blur()
      }}
    >
      <Search
        className="pointer-events-none absolute top-1/2 left-4 size-4.5 -translate-y-1/2 text-gris-500"
        aria-hidden
      />
      <input
        ref={campo}
        type="search"
        value={texto}
        onChange={(evento) => setTexto(evento.target.value)}
        placeholder="Buscar avisos por referencia, local o técnico"
        aria-label="Buscar avisos"
        className="h-11 w-full rounded-full border border-transparent bg-white pr-12 pl-11 text-[0.9375rem] text-gris-900 ring-1 ring-gris-200/70 transition-colors placeholder:text-gris-500 hover:ring-gris-300 focus:border-marca-500 focus:ring-4 focus:ring-marca-100 focus:outline-none"
      />
      <kbd
        className="pointer-events-none absolute top-1/2 right-3 grid h-6 min-w-6 -translate-y-1/2 place-items-center rounded-md bg-gris-100 px-1.5 font-sans text-xs text-gris-600 ring-1 ring-gris-200"
        title="Pulsa / para buscar"
      >
        /
      </kbd>
    </form>
  )
}

/** Franja superior del escritorio: búsqueda y el día de hoy. */
export function BarraSuperior({ hoy }: { hoy: string }) {
  const ruta = usePathname()
  // El listado de avisos ya tiene su propio buscador justo debajo.
  const conBuscador = ruta !== '/avisos'

  return (
    <header className="no-imprimir hidden h-19 items-center gap-4 px-8 lg:flex">
      {conBuscador && <BuscadorGlobal />}
      <Link
        href="/agenda"
        className="ml-auto flex h-11 shrink-0 items-center gap-2 rounded-full bg-white px-4 text-sm font-medium text-gris-700 ring-1 ring-gris-200/70 transition-colors hover:text-gris-950 hover:ring-gris-300"
      >
        <CalendarDays className="size-4.5 text-gris-500" aria-hidden />
        {hoy}
      </Link>
    </header>
  )
}

/* ---------------------------------------------------------------- Móvil */

/** Cabecera compacta del móvil: la sección, el alta de avisos (si puede) y su cuenta. */
export function CabeceraMovil({ usuario }: { usuario: Usuario }) {
  const ruta = usePathname()
  const actual = ruta === '/cuenta' ? undefined : enlaceActivo(ruta, enlacesDe(usuario))

  return (
    <header className="no-imprimir sticky top-0 z-20 flex h-15 items-center justify-between gap-3 bg-lienzo/90 px-4 backdrop-blur-md lg:hidden">
      <Link href="/" className="flex min-w-0 items-center gap-2.5">
        <Marca compacta />
        <span className="titular truncate text-[1.0625rem] font-semibold text-gris-950">
          {ruta === '/cuenta' ? 'Mi cuenta' : (actual?.etiqueta ?? 'Avisos y partes')}
        </span>
      </Link>
      <div className="flex shrink-0 items-center gap-2">
        {puede(usuario, 'gestionarAvisos') && (
          <Link
            href="/avisos/nuevo"
            className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-marca-700 pr-4 pl-3 text-sm font-medium text-white"
          >
            <Plus className="size-4.5" aria-hidden />
            Aviso
          </Link>
        )}
        <Link
          href="/cuenta"
          aria-label={`Mi cuenta (${usuario.nombre})`}
          className="grid size-11 place-items-center rounded-full"
        >
          <AvatarUsuario nombre={usuario.nombre} className="size-9 text-xs ring-2 ring-white" />
        </Link>
      </div>
    </header>
  )
}

/** Columnas de la barra inferior según cuántos destinos tenga el usuario. */
const COLUMNAS_MOVIL: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-2',
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
}

/** Barra inferior del móvil: la sección activa lleva su píldora lima. */
export function BarraInferior({ usuario }: { usuario: Usuario }) {
  const ruta = usePathname()
  const enlaces = enlacesDe(usuario).filter((enlace) => enlace.enMovil)
  const activo = enlaceActivo(ruta, enlaces)

  return (
    <nav
      className={cn(
        'no-imprimir fixed inset-x-0 bottom-0 z-20 grid border-t border-gris-200/70 bg-white/95 pt-1.5 pb-segura backdrop-blur-md lg:hidden',
        COLUMNAS_MOVIL[enlaces.length] ?? 'grid-cols-5',
      )}
      aria-label="Menú principal"
    >
      {enlaces.map(({ href, etiqueta, icono: Icono }) => {
        const esActivo = activo?.href === href
        return (
          <Link
            key={href}
            href={href}
            aria-current={esActivo ? 'page' : undefined}
            className={cn(
              'flex min-h-14 flex-col items-center justify-center gap-1 text-[0.6875rem] font-medium transition-colors',
              esActivo ? 'text-gris-950' : 'text-gris-600',
            )}
          >
            <span
              className={cn(
                'grid h-8 w-14 place-items-center rounded-full transition-colors',
                esActivo && 'bg-lima-300',
              )}
            >
              <Icono
                className={cn('size-5.5', esActivo ? 'text-gris-950' : 'text-gris-500')}
                strokeWidth={esActivo ? 2.1 : 1.8}
                aria-hidden
              />
            </span>
            {etiqueta}
          </Link>
        )
      })}
    </nav>
  )
}

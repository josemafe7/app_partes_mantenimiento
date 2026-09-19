import { ChevronDown } from 'lucide-react'
import type { ComponentProps, ReactNode } from 'react'

import { cn } from '@/lib/utils'

/* ---------------------------------------------------------------- Envoltura */

type PropsCampo = {
  etiqueta: string
  nombre: string
  error?: string
  ayuda?: string
  obligatorio?: boolean
  className?: string
  children: ReactNode
}

/** Etiqueta + control + ayuda + error, con la relación de accesibilidad ya montada. */
export function Campo({ etiqueta, nombre, error, ayuda, obligatorio, className, children }: PropsCampo) {
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={nombre} className="text-sm font-medium text-gris-800">
        {etiqueta}
        {obligatorio && (
          <span className="ml-0.5 text-coral-600" aria-label="obligatorio">
            *
          </span>
        )}
      </label>
      {children}
      {ayuda && !error && (
        <p id={`${nombre}-ayuda`} className="text-[0.8125rem] text-gris-500">
          {ayuda}
        </p>
      )}
      {error && (
        <p id={`${nombre}-error`} className="text-[0.8125rem] font-medium text-coral-700" role="alert">
          {error}
        </p>
      )}
    </div>
  )
}

/* ----------------------------------------------------------------- Controles */

const BASE_CONTROL =
  'w-full rounded-control border bg-white px-3.5 text-gris-900 transition-colors ' +
  'placeholder:text-gris-400 disabled:bg-gris-50 disabled:text-gris-500 ' +
  'focus:border-marca-500 focus:ring-4 focus:ring-marca-100 focus:outline-none'

const BORDE_NORMAL = 'border-gris-200 hover:border-gris-300'
const BORDE_ERROR = 'border-coral-300 bg-coral-50/40'

function bordes(error?: boolean) {
  return error ? BORDE_ERROR : BORDE_NORMAL
}

export function Entrada({ className, error, ...resto }: ComponentProps<'input'> & { error?: boolean }) {
  return (
    <input
      className={cn(BASE_CONTROL, bordes(error), 'h-11', className)}
      aria-invalid={error || undefined}
      {...resto}
    />
  )
}

export function AreaTexto({ className, error, ...resto }: ComponentProps<'textarea'> & { error?: boolean }) {
  return (
    <textarea
      className={cn(BASE_CONTROL, bordes(error), 'min-h-24 py-2.5 leading-relaxed', className)}
      aria-invalid={error || undefined}
      {...resto}
    />
  )
}

export function Selector({
  className,
  error,
  defaultValue,
  ...resto
}: ComponentProps<'select'> & { error?: boolean }) {
  return (
    // El <select> nativo pinta su propia flecha de forma distinta en cada
    // sistema, así que se oculta y se dibuja una igual en toda la aplicación.
    <span className={cn('relative block', className)}>
      <select
        /*
         * La clave es el valor por defecto a propósito.
         *
         * Al terminar una acción de servidor, React reinicia el formulario: el
         * navegador devuelve cada campo a su valor por defecto del HTML. En un
         * <input> React mantiene ese valor al día, pero en un <select> solo lo
         * aplica al montarlo, así que el desplegable volvería a la primera
         * opción aunque ya se hubiera guardado otra. Al cambiar la clave el
         * <select> se vuelve a montar con el valor correcto.
         *
         * Los desplegables controlados (con `value`) no llevan `defaultValue`,
         * así que la clave queda indefinida y no se remontan nunca.
         */
        key={defaultValue === undefined ? undefined : String(defaultValue)}
        defaultValue={defaultValue}
        className={cn(BASE_CONTROL, bordes(error), 'h-11 appearance-none pr-10')}
        aria-invalid={error || undefined}
        {...resto}
      />
      <ChevronDown
        className="pointer-events-none absolute top-1/2 right-3.5 size-4.5 -translate-y-1/2 text-gris-500"
        aria-hidden
      />
    </span>
  )
}

type PropsCasilla = ComponentProps<'input'> & { etiqueta: string; descripcion?: string }

/** Casilla grande: al marcarla se tiñe de lima, el color de «elegido». */
export function Casilla({ etiqueta, descripcion, className, ...resto }: PropsCasilla) {
  return (
    <label
      className={cn(
        'flex cursor-pointer items-start gap-3 rounded-tarjeta border border-gris-200 bg-white p-3.5 transition-colors hover:border-gris-300 has-checked:border-lima-400 has-checked:bg-lima-100',
        className,
      )}
    >
      <input
        type="checkbox"
        className="mt-0.5 size-5 shrink-0 accent-marca-700"
        {...resto}
      />
      <span className="text-sm">
        <span className="font-medium text-gris-900">{etiqueta}</span>
        {descripcion && <span className="mt-0.5 block text-[0.8125rem] text-gris-600">{descripcion}</span>}
      </span>
    </label>
  )
}

/* -------------------------------------------------------------- Agrupaciones */

/** Bloque de formulario con título, para partir un formulario largo en tramos. */
export function GrupoCampos({
  titulo,
  descripcion,
  children,
  className,
}: {
  titulo: string
  descripcion?: string
  children: ReactNode
  className?: string
}) {
  return (
    <fieldset className={cn('flex flex-col gap-4', className)}>
      <legend className="sr-only">{titulo}</legend>
      <div>
        <h2 className="titular text-[1.0625rem] font-semibold text-gris-900">{titulo}</h2>
        {descripcion && <p className="mt-0.5 text-sm text-gris-500">{descripcion}</p>}
      </div>
      {children}
    </fieldset>
  )
}

/** Aviso de error general encima del formulario. */
export function AvisoError({ mensaje }: { mensaje?: string | null }) {
  if (!mensaje) return null
  return (
    <div
      role="alert"
      className="rounded-tarjeta border border-coral-200 bg-coral-50 px-4 py-3 text-sm font-medium text-coral-800"
    >
      {mensaje}
    </div>
  )
}

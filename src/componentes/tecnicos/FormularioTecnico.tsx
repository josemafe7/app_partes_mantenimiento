'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Boton } from '@/componentes/ui/Boton'
import { AreaTexto, AvisoError, Campo, Casilla, Entrada, GrupoCampos } from '@/componentes/ui/Campo'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import type { Tecnico } from '@/db/esquema'
import { ESTADO_INICIAL, valorPrevio, valoresPrevios, type ResultadoAccion } from '@/lib/acciones'
import { OPCIONES_ESPECIALIDAD } from '@/lib/dominio'

type Accion = (previo: ResultadoAccion, formData: FormData) => Promise<ResultadoAccion>

type Props = {
  accion: Accion
  tecnico?: Tecnico
  volverA: string
}

export function FormularioTecnico({ accion, tecnico, volverA }: Props) {
  const [resultado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL)
  const errores = resultado.errores ?? {}

  function previo(campo: keyof Tecnico & string): string {
    const anterior = valorPrevio(resultado, campo)
    if (anterior !== undefined) return anterior
    const guardado = tecnico?.[campo]
    return guardado === null || guardado === undefined ? '' : String(guardado)
  }

  const especialidades =
    valoresPrevios(resultado, 'especialidades') ?? tecnico?.especialidades ?? []

  return (
    <form action={enviar} className="flex flex-col gap-5">
      {tecnico && <input type="hidden" name="id" value={tecnico.id} />}

      <AvisoError mensaje={resultado.mensaje} />

      <Tarjeta className="p-5 sm:p-6">
        <GrupoCampos titulo="Datos del técnico">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre" nombre="nombre" error={errores.nombre} obligatorio>
              <Entrada
                id="nombre"
                name="nombre"
                defaultValue={previo('nombre')}
                error={Boolean(errores.nombre)}
                autoComplete="given-name"
              />
            </Campo>
            <Campo etiqueta="Apellidos" nombre="apellidos" error={errores.apellidos}>
              <Entrada
                id="apellidos"
                name="apellidos"
                defaultValue={previo('apellidos')}
                error={Boolean(errores.apellidos)}
                autoComplete="family-name"
              />
            </Campo>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Teléfono" nombre="telefono" error={errores.telefono}>
              <Entrada
                id="telefono"
                name="telefono"
                type="tel"
                inputMode="tel"
                defaultValue={previo('telefono')}
                placeholder="600 41 22 87"
                error={Boolean(errores.telefono)}
                autoComplete="tel"
              />
            </Campo>
            <Campo etiqueta="Email" nombre="email" error={errores.email}>
              <Entrada
                id="email"
                name="email"
                type="email"
                inputMode="email"
                defaultValue={previo('email')}
                error={Boolean(errores.email)}
                autoComplete="email"
              />
            </Campo>
          </div>

          <Campo
            etiqueta="Zona"
            nombre="zona"
            error={errores.zona}
            ayuda="Por dónde se mueve habitualmente: norte, sur, centro…"
          >
            <Entrada id="zona" name="zona" defaultValue={previo('zona')} error={Boolean(errores.zona)} />
          </Campo>
        </GrupoCampos>
      </Tarjeta>

      <Tarjeta className="p-5 sm:p-6">
        <GrupoCampos
          titulo="Especialidades"
          descripcion="Al asignar un aviso, los técnicos con la especialidad del trabajo aparecen destacados."
        >
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {OPCIONES_ESPECIALIDAD.map((opcion) => (
              <Casilla
                key={opcion.valor}
                id={`especialidad-${opcion.valor}`}
                name="especialidades"
                value={opcion.valor}
                defaultChecked={especialidades.includes(opcion.valor)}
                etiqueta={opcion.etiqueta}
              />
            ))}
          </div>
          {errores.especialidades && (
            <p className="text-[0.8125rem] font-medium text-coral-700" role="alert">
              {errores.especialidades}
            </p>
          )}

          <Campo etiqueta="Notas" nombre="notas" error={errores.notas}>
            <AreaTexto
              id="notas"
              name="notas"
              rows={3}
              defaultValue={previo('notas')}
              placeholder="Certificaciones, horario habitual, herramienta que lleva en la furgoneta…"
              error={Boolean(errores.notas)}
            />
          </Campo>
        </GrupoCampos>
      </Tarjeta>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href={volverA}
          className="inline-flex h-11 items-center justify-center rounded-control px-4 text-[0.9375rem] font-medium text-gris-600 transition-colors hover:bg-white hover:text-gris-900"
        >
          Cancelar
        </Link>
        <Boton type="submit" tamano="lg" disabled={enviando}>
          {enviando ? 'Guardando…' : tecnico ? 'Guardar cambios' : 'Crear técnico'}
        </Boton>
      </div>
    </form>
  )
}

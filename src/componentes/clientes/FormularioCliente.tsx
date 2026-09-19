'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Boton } from '@/componentes/ui/Boton'
import { AreaTexto, AvisoError, Campo, Entrada, GrupoCampos } from '@/componentes/ui/Campo'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import type { Cliente } from '@/db/esquema'
import { ESTADO_INICIAL, valorPrevio, type ResultadoAccion } from '@/lib/acciones'

type Accion = (previo: ResultadoAccion, formData: FormData) => Promise<ResultadoAccion>

type Props = {
  accion: Accion
  cliente?: Cliente
  volverA: string
}

export function FormularioCliente({ accion, cliente, volverA }: Props) {
  const [resultado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL)
  const errores = resultado.errores ?? {}

  function previo(campo: keyof Cliente & string): string {
    const anterior = valorPrevio(resultado, campo)
    if (anterior !== undefined) return anterior
    const guardado = cliente?.[campo]
    return guardado === null || guardado === undefined ? '' : String(guardado)
  }

  return (
    <form action={enviar} className="flex flex-col gap-5">
      {cliente && <input type="hidden" name="id" value={cliente.id} />}

      <AvisoError mensaje={resultado.mensaje} />

      <Tarjeta className="p-5 sm:p-6">
        <GrupoCampos titulo="La empresa">
          <Campo etiqueta="Nombre del cliente" nombre="nombre" error={errores.nombre} obligatorio>
            <Entrada
              id="nombre"
              name="nombre"
              defaultValue={previo('nombre')}
              placeholder="Panaderías El Horno de Lucía"
              error={Boolean(errores.nombre)}
              autoComplete="organization"
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="CIF o NIF" nombre="cif" error={errores.cif}>
              <Entrada id="cif" name="cif" defaultValue={previo('cif')} error={Boolean(errores.cif)} />
            </Campo>

            <Campo etiqueta="Persona de contacto" nombre="personaContacto" error={errores.personaContacto}>
              <Entrada
                id="personaContacto"
                name="personaContacto"
                defaultValue={previo('personaContacto')}
                error={Boolean(errores.personaContacto)}
                autoComplete="name"
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
                placeholder="911 24 55 80"
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
            etiqueta="Dirección de facturación"
            nombre="direccionFacturacion"
            error={errores.direccionFacturacion}
            ayuda="La dirección fiscal, que puede no coincidir con la de ningún local."
          >
            <Entrada
              id="direccionFacturacion"
              name="direccionFacturacion"
              defaultValue={previo('direccionFacturacion')}
              error={Boolean(errores.direccionFacturacion)}
            />
          </Campo>

          <Campo
            etiqueta="Notas"
            nombre="notas"
            error={errores.notas}
            ayuda="Lo que conviene recordar: cómo factura, cuándo se le puede llamar, condiciones especiales."
          >
            <AreaTexto
              id="notas"
              name="notas"
              rows={3}
              defaultValue={previo('notas')}
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
          {enviando ? 'Guardando…' : cliente ? 'Guardar cambios' : 'Crear cliente'}
        </Boton>
      </div>
    </form>
  )
}

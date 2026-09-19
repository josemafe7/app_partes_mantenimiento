'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Boton } from '@/componentes/ui/Boton'
import { AreaTexto, AvisoError, Campo, Entrada, GrupoCampos, Selector } from '@/componentes/ui/Campo'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import type { Local } from '@/db/esquema'
import { ESTADO_INICIAL, valorPrevio, type ResultadoAccion } from '@/lib/acciones'

type Accion = (previo: ResultadoAccion, formData: FormData) => Promise<ResultadoAccion>

type Props = {
  accion: Accion
  clientes: { id: number; nombre: string }[]
  /** Cliente ya fijado cuando se crea el local desde su ficha. */
  clienteId?: number
  local?: Local
  volverA: string
}

export function FormularioLocal({ accion, clientes, clienteId, local, volverA }: Props) {
  const [resultado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL)
  const errores = resultado.errores ?? {}

  function previo(campo: keyof Local & string): string {
    const anterior = valorPrevio(resultado, campo)
    if (anterior !== undefined) return anterior
    const guardado = local?.[campo]
    return guardado === null || guardado === undefined ? '' : String(guardado)
  }

  return (
    <form action={enviar} className="flex flex-col gap-5">
      {local && <input type="hidden" name="id" value={local.id} />}

      <AvisoError mensaje={resultado.mensaje} />

      <Tarjeta className="p-5 sm:p-6">
        <GrupoCampos titulo="El local">
          <Campo etiqueta="Cliente" nombre="clienteId" error={errores.clienteId} obligatorio>
            <Selector
              id="clienteId"
              name="clienteId"
              defaultValue={previo('clienteId') || (clienteId ? String(clienteId) : '')}
              error={Boolean(errores.clienteId)}
            >
              <option value="">Selecciona un cliente…</option>
              {clientes.map((cliente) => (
                <option key={cliente.id} value={cliente.id}>
                  {cliente.nombre}
                </option>
              ))}
            </Selector>
          </Campo>

          <Campo
            etiqueta="Nombre del local"
            nombre="nombre"
            error={errores.nombre}
            ayuda="Como lo llaman por teléfono: «el de Gran Vía», «Frescal Leganés»…"
            obligatorio
          >
            <Entrada
              id="nombre"
              name="nombre"
              defaultValue={previo('nombre')}
              error={Boolean(errores.nombre)}
              autoComplete="off"
            />
          </Campo>

          <Campo etiqueta="Dirección" nombre="direccion" error={errores.direccion} obligatorio>
            <Entrada
              id="direccion"
              name="direccion"
              defaultValue={previo('direccion')}
              placeholder="Calle Mayor 14"
              error={Boolean(errores.direccion)}
              autoComplete="street-address"
            />
          </Campo>

          <div className="grid gap-4 sm:grid-cols-3">
            <Campo etiqueta="Ciudad" nombre="ciudad" error={errores.ciudad} obligatorio>
              <Entrada
                id="ciudad"
                name="ciudad"
                defaultValue={previo('ciudad')}
                error={Boolean(errores.ciudad)}
              />
            </Campo>
            <Campo etiqueta="Provincia" nombre="provincia" error={errores.provincia}>
              <Entrada
                id="provincia"
                name="provincia"
                defaultValue={previo('provincia')}
                error={Boolean(errores.provincia)}
              />
            </Campo>
            <Campo etiqueta="Código postal" nombre="codigoPostal" error={errores.codigoPostal}>
              <Entrada
                id="codigoPostal"
                name="codigoPostal"
                inputMode="numeric"
                defaultValue={previo('codigoPostal')}
                error={Boolean(errores.codigoPostal)}
              />
            </Campo>
          </div>
        </GrupoCampos>
      </Tarjeta>

      <Tarjeta className="p-5 sm:p-6">
        <GrupoCampos titulo="Cómo llegar y con quién hablar">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Teléfono del local" nombre="telefono" error={errores.telefono}>
              <Entrada
                id="telefono"
                name="telefono"
                type="tel"
                inputMode="tel"
                defaultValue={previo('telefono')}
                error={Boolean(errores.telefono)}
              />
            </Campo>
            <Campo etiqueta="Persona de contacto" nombre="personaContacto" error={errores.personaContacto}>
              <Entrada
                id="personaContacto"
                name="personaContacto"
                defaultValue={previo('personaContacto')}
                error={Boolean(errores.personaContacto)}
              />
            </Campo>
          </div>

          <Campo
            etiqueta="Horario"
            nombre="horario"
            error={errores.horario}
            ayuda="Cuándo está abierto, para no plantarse con la persiana bajada."
          >
            <Entrada
              id="horario"
              name="horario"
              defaultValue={previo('horario')}
              placeholder="L-S 9:00-21:00"
              error={Boolean(errores.horario)}
            />
          </Campo>

          <Campo
            etiqueta="Notas de acceso"
            nombre="notasAcceso"
            error={errores.notasAcceso}
            ayuda="Dónde está el cuadro eléctrico, por qué puerta se entra, si hace falta permiso o llave."
          >
            <AreaTexto
              id="notasAcceso"
              name="notasAcceso"
              rows={3}
              defaultValue={previo('notasAcceso')}
              error={Boolean(errores.notasAcceso)}
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
          {enviando ? 'Guardando…' : local ? 'Guardar cambios' : 'Crear local'}
        </Boton>
      </div>
    </form>
  )
}

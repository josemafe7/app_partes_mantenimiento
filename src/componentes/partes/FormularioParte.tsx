'use client'

import Link from 'next/link'
import { useActionState } from 'react'

import { Boton } from '@/componentes/ui/Boton'
import { AreaTexto, AvisoError, Campo, Casilla, Entrada, GrupoCampos, Selector } from '@/componentes/ui/Campo'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import type { TecnicoSelector } from '@/db/consultas/tecnicos'
import type { Parte } from '@/db/esquema'
import { ESTADO_INICIAL, valorPrevio, type ResultadoAccion } from '@/lib/acciones'
import { hoyISO } from '@/lib/fechas'

type Accion = (previo: ResultadoAccion, formData: FormData) => Promise<ResultadoAccion>

type Props = {
  accion: Accion
  avisoId: number
  tecnicos: TecnicoSelector[]
  /** Técnico asignado al aviso: es el que más probablemente firma el parte. */
  tecnicoSugerido: number | null
  /**
   * Quien rellena el parte es un técnico: lo firma él, sin elegir. El servidor
   * pone su ficha aunque llegue otra.
   */
  tecnicoFijo?: { id: number; nombre: string }
  parte?: Parte
  volverA: string
}

export function FormularioParte({
  accion,
  avisoId,
  tecnicos,
  tecnicoSugerido,
  tecnicoFijo,
  parte,
  volverA,
}: Props) {
  const [resultado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL)
  const errores = resultado.errores ?? {}

  function previo(campo: string, porDefecto = ''): string {
    const anterior = valorPrevio(resultado, campo)
    if (anterior !== undefined) return anterior
    const guardado = parte?.[campo as keyof Parte]
    if (guardado === null || guardado === undefined) return porDefecto
    return String(guardado)
  }

  const resueltoMarcado =
    resultado.valores !== undefined
      ? resultado.valores.resuelto !== undefined
      : (parte?.resuelto ?? false)

  return (
    <form action={enviar} className="flex flex-col gap-5">
      <input type="hidden" name="avisoId" value={avisoId} />
      {parte && <input type="hidden" name="id" value={parte.id} />}

      <AvisoError mensaje={resultado.mensaje} />

      <Tarjeta className="p-5 sm:p-6">
        <GrupoCampos titulo="La visita">
          <div className="grid gap-4 sm:grid-cols-3">
            {tecnicoFijo ? (
              <div className="flex flex-col gap-1.5">
                <input type="hidden" name="tecnicoId" value={tecnicoFijo.id} />
                <span className="text-sm font-medium text-gris-800">Técnico</span>
                <p className="flex h-11 items-center rounded-control bg-gris-50 px-3.5 text-gris-800">
                  {tecnicoFijo.nombre}
                </p>
              </div>
            ) : (
              <Campo
                etiqueta="Técnico"
                nombre="tecnicoId"
                error={errores.tecnicoId}
                obligatorio
                className="sm:col-span-1"
              >
                <Selector
                  id="tecnicoId"
                  name="tecnicoId"
                  defaultValue={previo('tecnicoId', tecnicoSugerido ? String(tecnicoSugerido) : '')}
                  error={Boolean(errores.tecnicoId)}
                >
                  <option value="">Selecciona…</option>
                  {tecnicos.map((tecnico) => (
                    <option key={tecnico.id} value={tecnico.id}>
                      {tecnico.nombre} {tecnico.apellidos ?? ''}
                    </option>
                  ))}
                </Selector>
              </Campo>
            )}

            <Campo etiqueta="Día" nombre="fecha" error={errores.fecha} obligatorio>
              <Entrada
                id="fecha"
                name="fecha"
                type="date"
                defaultValue={previo('fecha', hoyISO())}
                error={Boolean(errores.fecha)}
              />
            </Campo>

            <Campo
              etiqueta="Horas"
              nombre="horas"
              error={errores.horas}
              ayuda="Se puede poner 1,5"
              obligatorio
            >
              <Entrada
                id="horas"
                name="horas"
                inputMode="decimal"
                defaultValue={previo('horas', '1')}
                placeholder="1,5"
                error={Boolean(errores.horas)}
              />
            </Campo>
          </div>
        </GrupoCampos>
      </Tarjeta>

      <Tarjeta className="p-5 sm:p-6">
        <GrupoCampos titulo="Qué se ha hecho">
          <Campo
            etiqueta="Trabajo realizado"
            nombre="trabajoRealizado"
            error={errores.trabajoRealizado}
            ayuda="Lo que se ha revisado, cambiado o probado. Es lo que verá el cliente en la hoja del parte."
            obligatorio
          >
            <AreaTexto
              id="trabajoRealizado"
              name="trabajoRealizado"
              rows={5}
              defaultValue={previo('trabajoRealizado')}
              error={Boolean(errores.trabajoRealizado)}
            />
          </Campo>

          <Campo
            etiqueta="Materiales utilizados"
            nombre="materiales"
            error={errores.materiales}
            ayuda="Piezas y consumibles empleados en esta visita."
          >
            <AreaTexto
              id="materiales"
              name="materiales"
              rows={2}
              defaultValue={previo('materiales')}
              placeholder="Latiguillo flexible 1/2&quot;, junta de filtro…"
              error={Boolean(errores.materiales)}
            />
          </Campo>

          <Campo
            etiqueta="Observaciones internas"
            nombre="observaciones"
            error={errores.observaciones}
            ayuda="Notas para la oficina: qué falta, qué hay que pedir, qué avisar al cliente."
          >
            <AreaTexto
              id="observaciones"
              name="observaciones"
              rows={2}
              defaultValue={previo('observaciones')}
              error={Boolean(errores.observaciones)}
            />
          </Campo>

          <Casilla
            id="resuelto"
            name="resuelto"
            defaultChecked={resueltoMarcado}
            etiqueta="La incidencia queda resuelta"
            descripcion="Al marcarlo, el aviso pasa a «Finalizado» con este trabajo como resumen de cierre."
          />
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
          {enviando ? 'Guardando…' : parte ? 'Guardar cambios' : 'Guardar el parte'}
        </Boton>
      </div>
    </form>
  )
}

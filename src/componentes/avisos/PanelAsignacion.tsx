'use client'

import { Check } from 'lucide-react'
import { useActionState } from 'react'

import { asignarAviso } from '@/acciones/avisos'
import { Boton } from '@/componentes/ui/Boton'
import { AvisoError, Campo, Entrada, Selector } from '@/componentes/ui/Campo'
import type { TecnicoSelector } from '@/db/consultas/tecnicos'
import { ESTADO_INICIAL } from '@/lib/acciones'
import { ESPECIALIDAD, type Categoria } from '@/lib/dominio'

type Props = {
  avisoId: number
  tecnicoId: number | null
  fechaProgramada: string | null
  horaProgramada: string | null
  categoria: Categoria
  tecnicos: TecnicoSelector[]
}

/**
 * Asignar técnico y fecha sin salir del aviso.
 * Es la operación que más se repite: un aviso entra y hay que repartirlo.
 *
 * Los campos van sin controlar, con su valor por defecto tomado de lo que hay
 * guardado: al terminar la acción el formulario se reinicia a esos valores, que
 * ya vienen actualizados del servidor.
 */
export function PanelAsignacion({
  avisoId,
  tecnicoId,
  fechaProgramada,
  horaProgramada,
  categoria,
  tecnicos,
}: Props) {
  const [resultado, enviar, enviando] = useActionState(asignarAviso, ESTADO_INICIAL)

  // Se destacan los técnicos cuya especialidad encaja con el tipo de trabajo.
  const encajan = tecnicos.filter((candidato) =>
    candidato.especialidades.some(
      (especialidad) => especialidad === categoria || especialidad === 'multiservicio',
    ),
  )
  const resto = tecnicos.filter((candidato) => !encajan.includes(candidato))

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="avisoId" value={avisoId} />

      <AvisoError mensaje={resultado.ok ? undefined : resultado.mensaje} />

      <Campo etiqueta="Técnico" nombre="tecnicoId" error={resultado.errores?.tecnicoId}>
        <Selector id="tecnicoId" name="tecnicoId" defaultValue={tecnicoId ? String(tecnicoId) : ''}>
          <option value="">Sin asignar</option>
          {encajan.length > 0 && (
            <optgroup label="Con esta especialidad">
              {encajan.map((candidato) => (
                <option key={candidato.id} value={candidato.id}>
                  {candidato.nombre} {candidato.apellidos ?? ''} —{' '}
                  {candidato.especialidades
                    .map((especialidad) => ESPECIALIDAD[especialidad].etiqueta)
                    .join(', ')}
                </option>
              ))}
            </optgroup>
          )}
          {resto.length > 0 && (
            <optgroup label="Otros técnicos">
              {resto.map((candidato) => (
                <option key={candidato.id} value={candidato.id}>
                  {candidato.nombre} {candidato.apellidos ?? ''}
                </option>
              ))}
            </optgroup>
          )}
        </Selector>
      </Campo>

      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)] gap-3">
        <Campo etiqueta="Día previsto" nombre="fechaProgramada" error={resultado.errores?.fechaProgramada}>
          <Entrada
            id="fechaProgramada"
            name="fechaProgramada"
            type="date"
            defaultValue={fechaProgramada ?? ''}
            error={Boolean(resultado.errores?.fechaProgramada)}
          />
        </Campo>
        <Campo etiqueta="Hora" nombre="horaProgramada" error={resultado.errores?.horaProgramada}>
          <Entrada
            id="horaProgramada"
            name="horaProgramada"
            type="time"
            defaultValue={horaProgramada ?? ''}
            error={Boolean(resultado.errores?.horaProgramada)}
          />
        </Campo>
      </div>

      <div className="flex items-center justify-between gap-3">
        {resultado.ok ? (
          <span className="flex items-center gap-1.5 text-sm font-medium text-menta-700">
            <Check className="size-4" aria-hidden />
            Guardado
          </span>
        ) : (
          <span />
        )}
        <Boton type="submit" disabled={enviando}>
          {enviando ? 'Guardando…' : 'Guardar asignación'}
        </Boton>
      </div>
    </form>
  )
}

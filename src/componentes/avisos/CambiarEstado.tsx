'use client'

import { Check, TriangleAlert } from 'lucide-react'
import { useActionState, useState } from 'react'

import { accionCambiarEstado } from '@/acciones/avisos'
import { Boton } from '@/componentes/ui/Boton'
import { AreaTexto, Campo } from '@/componentes/ui/Campo'
import { Dialogo } from '@/componentes/ui/Dialogo'
import { ESTADO_INICIAL } from '@/lib/acciones'
import { ESTADO, ESTADOS, requiereMotivoEspera, requiereResumenCierre, type Estado } from '@/lib/dominio'
import { cn } from '@/lib/utils'

type Props = {
  avisoId: number
  estado: Estado
  tieneTecnico: boolean
  /**
   * Estados a los que este usuario puede llevar el aviso (ver `estadosPermitidos`
   * en permisos.ts): todos para la oficina, en curso, en espera y finalizado
   * para el técnico. El servidor lo vuelve a comprobar.
   */
  permitidos: readonly Estado[]
}

/** Etiqueta del campo de nota, que cambia según a dónde se mueva el aviso. */
function etiquetaNota(estado: Estado): { etiqueta: string; ayuda: string; obligatorio: boolean } {
  if (requiereMotivoEspera(estado)) {
    return {
      etiqueta: 'Motivo de la espera',
      ayuda: 'Falta material, falta presupuesto, no hay acceso al local…',
      obligatorio: true,
    }
  }
  if (requiereResumenCierre(estado)) {
    return {
      etiqueta: 'Resumen de lo realizado',
      ayuda: 'Queda como cierre del aviso y se ve en la hoja del parte.',
      obligatorio: true,
    }
  }
  return { etiqueta: 'Nota (opcional)', ayuda: 'Se guarda en la cronología del aviso.', obligatorio: false }
}

export function CambiarEstado({ avisoId, estado, tieneTecnico, permitidos }: Props) {
  const [abierto, setAbierto] = useState(false)
  const [elegido, setElegido] = useState<Estado>(estado)
  const [resultado, enviar, enviando] = useActionState(accionCambiarEstado, ESTADO_INICIAL)

  // Cuando el servidor confirma el cambio, el diálogo se cierra solo. Se
  // detecta comparando con el resultado anterior durante el render: así no
  // hace falta un efecto que dispare un render extra.
  const [resultadoAnterior, setResultadoAnterior] = useState(resultado)
  if (resultadoAnterior !== resultado) {
    setResultadoAnterior(resultado)
    if (resultado.ok) setAbierto(false)
  }

  function abrir() {
    setElegido(estado)
    setAbierto(true)
  }

  const nota = etiquetaNota(elegido)
  const necesitaTecnico = !tieneTecnico && elegido !== 'pendiente' && elegido !== 'cancelado'

  return (
    <>
      <Boton variante="secundario" onClick={abrir}>
        Cambiar estado
      </Boton>

      <Dialogo
        abierto={abierto}
        onCerrar={() => setAbierto(false)}
        titulo="Cambiar el estado del aviso"
        descripcion={`Ahora está en «${ESTADO[estado].etiqueta}».`}
      >
        <form action={enviar} className="flex flex-col gap-4">
          <input type="hidden" name="avisoId" value={avisoId} />
          <input type="hidden" name="estado" value={elegido} />

          <div className="grid gap-2 sm:grid-cols-2">
            {ESTADOS.filter((posible) => permitidos.includes(posible)).map((posible) => {
              const activo = elegido === posible
              return (
                <button
                  key={posible}
                  type="button"
                  onClick={() => setElegido(posible)}
                  aria-pressed={activo}
                  className={cn(
                    'flex items-start gap-2.5 rounded-tarjeta border p-3.5 text-left transition-colors',
                    activo
                      ? 'border-lima-400 bg-lima-100'
                      : 'border-gris-200 hover:border-gris-300 hover:bg-gris-50',
                  )}
                >
                  <span
                    className={cn('mt-1.5 size-2 shrink-0 rounded-full', ESTADO[posible].punto)}
                    aria-hidden
                  />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5 text-sm font-medium text-gris-900">
                      {ESTADO[posible].etiqueta}
                      {posible === estado && <span className="text-xs text-gris-500">(actual)</span>}
                      {activo && posible !== estado && (
                        <Check className="size-3.5 text-lima-700" aria-hidden />
                      )}
                    </span>
                    <span className="mt-0.5 block text-xs leading-snug text-gris-500">
                      {ESTADO[posible].descripcion}
                    </span>
                  </span>
                </button>
              )
            })}
          </div>

          {necesitaTecnico && (
            <div className="flex gap-2.5 rounded-tarjeta bg-mantequilla-100 px-4 py-3 text-sm text-mantequilla-800 ring-1 ring-mantequilla-300 ring-inset">
              <TriangleAlert className="mt-0.5 size-4.5 shrink-0" aria-hidden />
              <p>
                Este aviso no tiene técnico asignado. Asígnalo primero para poder pasarlo a «
                {ESTADO[elegido].etiqueta}».
              </p>
            </div>
          )}

          <Campo
            etiqueta={nota.etiqueta}
            nombre="nota"
            ayuda={nota.ayuda}
            error={resultado.errores?.nota}
            obligatorio={nota.obligatorio}
          >
            <AreaTexto id="nota" name="nota" rows={3} error={Boolean(resultado.errores?.nota)} />
          </Campo>

          {resultado.mensaje && !resultado.ok && (
            <p className="text-sm font-medium text-coral-700" role="alert">
              {resultado.mensaje}
            </p>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={() => setAbierto(false)} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton type="submit" disabled={enviando || elegido === estado || necesitaTecnico}>
              {enviando ? 'Guardando…' : 'Cambiar estado'}
            </Boton>
          </div>
        </form>
      </Dialogo>
    </>
  )
}

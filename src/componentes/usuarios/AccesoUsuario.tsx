'use client'

import { Check, KeyRound, TriangleAlert, UserCheck, UserX } from 'lucide-react'
import { useActionState, useState } from 'react'

import { alternarActivoUsuario, restablecerContrasena } from '@/acciones/usuarios'
import { Boton } from '@/componentes/ui/Boton'
import { Dialogo } from '@/componentes/ui/Dialogo'
import { ESTADO_INICIAL } from '@/lib/acciones'

import { ContrasenaTemporal } from './ContrasenaTemporal'

type Props = { id: string; nombre: string; activo: boolean }

function AvisoProblema({ mensaje }: { mensaje?: string }) {
  if (!mensaje) return null
  return (
    <div
      role="alert"
      className="flex gap-2.5 rounded-tarjeta bg-mantequilla-100 px-4 py-3 text-sm text-mantequilla-800 ring-1 ring-mantequilla-300 ring-inset"
    >
      <TriangleAlert className="mt-0.5 size-4.5 shrink-0" aria-hidden />
      <p>{mensaje}</p>
    </div>
  )
}

/**
 * Contenido del diálogo de restablecer. Se monta de nuevo cada vez que se abre
 * (con otra `key`), así la contraseña de la vez anterior no vuelve a aparecer.
 */
function Restablecer({ id, nombre, onCerrar }: { id: string; nombre: string; onCerrar: () => void }) {
  const [resultado, enviar, enviando] = useActionState(restablecerContrasena, ESTADO_INICIAL)

  if (resultado.ok && resultado.secreto) {
    return (
      <div className="flex flex-col gap-4">
        <ContrasenaTemporal contrasena={resultado.secreto} nombre={nombre} />
        <div className="flex justify-end">
          <Boton onClick={onCerrar}>Hecho</Boton>
        </div>
      </div>
    )
  }

  return (
    <form action={enviar} className="flex flex-col gap-4">
      <input type="hidden" name="id" value={id} />
      <p className="text-[0.9375rem] leading-relaxed text-gris-700">
        Se creará una contraseña temporal nueva para {nombre} y se cerrarán todas sus sesiones abiertas.
        Al entrar con ella tendrá que elegir una suya.
      </p>
      <AvisoProblema mensaje={resultado.mensaje} />
      <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Boton variante="secundario" onClick={onCerrar} disabled={enviando}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={enviando}>
          {enviando ? 'Generando…' : 'Restablecer'}
        </Boton>
      </div>
    </form>
  )
}

/** Restablecer la contraseña y activar o desactivar a un usuario. */
export function AccesoUsuario({ id, nombre, activo }: Props) {
  const [restablecer, setRestablecer] = useState(false)
  const [vez, setVez] = useState(0)

  const [cambiar, setCambiar] = useState(false)
  const [resultado, enviar, enviando] = useActionState(alternarActivoUsuario, ESTADO_INICIAL)

  // Si el servidor confirma, el diálogo se cierra (comparando durante el render).
  const [resultadoAnterior, setResultadoAnterior] = useState(resultado)
  if (resultadoAnterior !== resultado) {
    setResultadoAnterior(resultado)
    if (resultado.ok) setCambiar(false)
  }

  return (
    <div className="flex flex-col gap-3">
      {resultado.ok && resultado.mensaje && (
        <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-menta-700">
          <Check className="size-4" aria-hidden />
          {resultado.mensaje}
        </p>
      )}

      <Boton
        variante="secundario"
        onClick={() => {
          setVez((valor) => valor + 1)
          setRestablecer(true)
        }}
        disabled={!activo}
        className="justify-start"
      >
        <KeyRound className="size-4.5" aria-hidden />
        Restablecer la contraseña
      </Boton>

      <Boton
        variante="secundario"
        onClick={() => setCambiar(true)}
        className={activo ? 'justify-start text-coral-700' : 'justify-start'}
      >
        {activo ? <UserX className="size-4.5" aria-hidden /> : <UserCheck className="size-4.5" aria-hidden />}
        {activo ? 'Desactivar el usuario' : 'Reactivar el usuario'}
      </Boton>

      <Dialogo abierto={restablecer} onCerrar={() => setRestablecer(false)} titulo="Restablecer la contraseña">
        <Restablecer key={vez} id={id} nombre={nombre} onCerrar={() => setRestablecer(false)} />
      </Dialogo>

      <Dialogo
        abierto={cambiar}
        onCerrar={() => setCambiar(false)}
        titulo={activo ? 'Desactivar el usuario' : 'Reactivar el usuario'}
      >
        <form action={enviar} className="flex flex-col gap-4">
          <input type="hidden" name="id" value={id} />
          <p className="text-[0.9375rem] leading-relaxed text-gris-700">
            {activo
              ? `${nombre} no podrá entrar y sus sesiones abiertas se cerrarán al momento. Su nombre se conserva en la cronología de los avisos, y puedes reactivarlo cuando quieras.`
              : `${nombre} podrá volver a entrar con su contraseña.`}
          </p>
          <AvisoProblema mensaje={resultado.ok ? undefined : resultado.mensaje} />
          <div className="mt-1 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={() => setCambiar(false)} disabled={enviando}>
              Cancelar
            </Boton>
            <Boton type="submit" variante={activo ? 'peligro' : 'primario'} disabled={enviando}>
              {enviando ? 'Guardando…' : activo ? 'Sí, desactivar' : 'Reactivar'}
            </Boton>
          </div>
        </form>
      </Dialogo>
    </div>
  )
}

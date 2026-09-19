'use client'

import { CircleAlert, CircleCheck, Sparkles } from 'lucide-react'
import { useState, useTransition, type ReactNode } from 'react'

import { leerMensaje, type ResultadoLectura } from '@/acciones/lectura'
import { Boton } from '@/componentes/ui/Boton'
import { AreaTexto, AvisoError, Campo, GrupoCampos } from '@/componentes/ui/Campo'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { MAX_MENSAJE, type LecturaMensaje, type PropuestaAviso } from '@/lib/lecturaMensaje'

type Props = {
  /** Pasa la propuesta al formulario del aviso, que rellena sus campos. */
  alLeer: (propuesta: PropuestaAviso) => void
}

/**
 * Recuadro para pegar el WhatsApp o el email de un cliente: la IA lo lee y
 * rellena el formulario. No guarda nada; el aviso se registra con el botón de
 * siempre, después de revisarlo.
 */
export function LectorMensaje({ alLeer }: Props) {
  const [mensaje, setMensaje] = useState('')
  const [resultado, setResultado] = useState<ResultadoLectura | null>(null)
  const [leyendo, empezar] = useTransition()

  function leer() {
    empezar(async () => {
      try {
        const respuesta = await leerMensaje(mensaje)
        setResultado(respuesta)
        if (respuesta.lectura) alLeer(respuesta.lectura.propuesta)
      } catch {
        // Sin conexión con el servidor o la sesión caducada a mitad.
        setResultado({ ok: false, mensaje: 'No se ha podido leer el mensaje. Vuelve a probar.' })
      }
    })
  }

  return (
    <Tarjeta className="p-5 sm:p-6">
      <GrupoCampos
        titulo="Rellenar desde un mensaje"
        descripcion="Pega el WhatsApp o el email del cliente y la IA rellena el formulario. No guarda nada: revisa lo que ponga y registra el aviso como siempre."
      >
        <Campo etiqueta="Mensaje del cliente" nombre="mensajeCliente">
          <AreaTexto
            id="mensajeCliente"
            rows={4}
            value={mensaje}
            maxLength={MAX_MENSAJE}
            onChange={(evento) => setMensaje(evento.target.value)}
            placeholder="Hola, soy Marta, de la panadería de la calle Mayor. El horno grande no calienta…"
          />
        </Campo>

        <div>
          <Boton
            variante="suave"
            onClick={leer}
            disabled={leyendo || !mensaje.trim()}
            className="w-full sm:w-auto"
          >
            <Sparkles className="size-4.5" aria-hidden />
            {leyendo ? 'Leyendo el mensaje…' : 'Rellenar con IA'}
          </Boton>
        </div>

        <div aria-live="polite">
          {!leyendo && resultado?.mensaje && <AvisoError mensaje={resultado.mensaje} />}
          {!leyendo && resultado?.lectura && <ResumenLectura lectura={resultado.lectura} />}
        </div>
      </GrupoCampos>
    </Tarjeta>
  )
}

function ResumenLectura({ lectura }: { lectura: LecturaMensaje }) {
  const sinCliente = lectura.propuesta.clienteId === null
  const sinLocal = lectura.propuesta.localId === null

  return (
    <div className="flex flex-col gap-3 text-sm">
      <p className="flex items-start gap-2 rounded-tarjeta bg-marca-50 px-4 py-3 text-marca-800">
        <CircleCheck className="mt-0.5 size-4.5 shrink-0" aria-hidden />
        <span>
          <span className="font-medium">Formulario rellenado.</span> Revisa los datos antes de
          registrar el aviso.
        </span>
      </p>

      {sinCliente || sinLocal ? (
        <Aviso titulo={sinCliente ? 'Faltan el cliente y el local' : 'Falta el local'}>
          {lectura.identificacion} Elígelo tú en «Dónde».
        </Aviso>
      ) : (
        <p className="px-1 text-gris-600">
          <span className="font-medium text-gris-900">
            {lectura.cliente} · {lectura.local}.
          </span>{' '}
          {lectura.identificacion}
        </p>
      )}

      {lectura.dudas.length > 0 && (
        <Aviso titulo="Para revisar">
          <ul className="list-disc pl-4">
            {lectura.dudas.map((duda) => (
              <li key={duda}>{duda}</li>
            ))}
          </ul>
        </Aviso>
      )}
    </div>
  )
}

function Aviso({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-tarjeta border border-coral-200 bg-coral-50 px-4 py-3 text-coral-800">
      <CircleAlert className="mt-0.5 size-4.5 shrink-0" aria-hidden />
      <div>
        <p className="font-medium">{titulo}</p>
        <div className="mt-0.5">{children}</div>
      </div>
    </div>
  )
}

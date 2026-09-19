'use client'

import Link from 'next/link'
import { useActionState, useRef, useState } from 'react'

import { Boton } from '@/componentes/ui/Boton'
import { AreaTexto, AvisoError, Campo, Entrada, GrupoCampos, Selector } from '@/componentes/ui/Campo'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import type { LocalSelector } from '@/db/consultas/clientes'
import type { TecnicoSelector } from '@/db/consultas/tecnicos'
import type { Aviso } from '@/db/esquema'
import { ESTADO_INICIAL, valorPrevio, type ResultadoAccion } from '@/lib/acciones'
import {
  esEstado,
  OPCIONES_CANAL,
  OPCIONES_CATEGORIA,
  OPCIONES_ESTADO,
  OPCIONES_PRIORIDAD,
  type Estado,
} from '@/lib/dominio'
import type { PropuestaAviso } from '@/lib/lecturaMensaje'

import { LectorMensaje } from './LectorMensaje'

type Accion = (previo: ResultadoAccion, formData: FormData) => Promise<ResultadoAccion>

type Props = {
  accion: Accion
  clientes: { id: number; nombre: string }[]
  locales: LocalSelector[]
  tecnicos: TecnicoSelector[]
  /** Aviso existente al editar. */
  aviso?: Aviso
  /** Cliente y local preseleccionados al crear desde la ficha de un local. */
  inicial?: { clienteId?: number; localId?: number }
  volverA: string
}

export function FormularioAviso({ accion, clientes, locales, tecnicos, aviso, inicial, volverA }: Props) {
  const [resultado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL)
  const errores = resultado.errores ?? {}

  /*
   * Estos tres campos no van controlados, solo escuchados: se guarda su valor
   * en el estado para poder filtrar los locales del cliente y mostrar los
   * campos que dependen del estado, pero el valor que manda es el del DOM.
   *
   * Es a propósito: al terminar una acción React reinicia el formulario, y un
   * <select> controlado se quedaría en su primera opción mientras React sigue
   * creyendo otra cosa. Sin controlar, el reinicio lo devuelve a su valor por
   * defecto, que es justo el que acabamos de recibir del servidor.
   */
  const [clienteId, setClienteId] = useState(
    (aviso?.clienteId ?? inicial?.clienteId ?? '').toString(),
  )
  const [localId, setLocalId] = useState((aviso?.localId ?? inicial?.localId ?? '').toString())
  const [estado, setEstado] = useState<Estado>(aviso?.estado ?? 'pendiente')

  // Si la validación falla, el servidor devuelve lo que se había escrito.
  const [ultimoResultado, setUltimoResultado] = useState(resultado)
  if (ultimoResultado !== resultado) {
    setUltimoResultado(resultado)
    const clienteEnviado = valorPrevio(resultado, 'clienteId')
    const localEnviado = valorPrevio(resultado, 'localId')
    const estadoEnviado = valorPrevio(resultado, 'estado')
    if (clienteEnviado !== undefined) setClienteId(clienteEnviado)
    if (localEnviado !== undefined) setLocalId(localEnviado)
    if (esEstado(estadoEnviado)) setEstado(estadoEnviado)
  }

  const localesDelCliente = locales.filter((local) => String(local.clienteId) === clienteId)

  /*
   * Lo que propone la IA al leer un mensaje. Los campos de texto y los
   * desplegables que no dependen de nada se escriben directamente en el
   * formulario (no van controlados, ver arriba). Cliente y local van por el
   * estado: al cambiar su valor por defecto, el `Selector` se vuelve a montar
   * con el valor nuevo y el local ya con las opciones de ese cliente.
   *
   * Lo que la IA no tiene claro llega vacío y se queda vacío: un cliente o un
   * local en blanco es mejor que uno equivocado.
   */
  const formulario = useRef<HTMLFormElement>(null)

  function aplicarPropuesta(propuesta: PropuestaAviso) {
    const campos = formulario.current?.elements
    const valores: [string, string | null][] = [
      ['titulo', propuesta.titulo],
      ['descripcion', propuesta.descripcion],
      ['categoria', propuesta.categoria],
      ['prioridad', propuesta.prioridad],
      ['canalEntrada', propuesta.canalEntrada],
      ['contactoAviso', propuesta.contactoAviso],
    ]
    for (const [nombre, valor] of valores) {
      const campo = campos?.namedItem(nombre)
      const esCampo =
        campo instanceof HTMLInputElement ||
        campo instanceof HTMLTextAreaElement ||
        campo instanceof HTMLSelectElement
      if (esCampo && valor !== null) campo.value = valor
    }
    setClienteId(propuesta.clienteId?.toString() ?? '')
    setLocalId(propuesta.localId?.toString() ?? '')
  }

  /** Valor por defecto de un campo: lo último escrito o lo que ya había guardado. */
  function previo(campo: keyof Aviso & string): string {
    const anterior = valorPrevio(resultado, campo)
    if (anterior !== undefined) return anterior
    const guardado = aviso?.[campo as keyof Aviso]
    return guardado === null || guardado === undefined ? '' : String(guardado)
  }

  return (
    <div className="flex flex-col gap-5">
      {/* Solo al crear: al editar, el aviso ya está registrado. */}
      {!aviso && <LectorMensaje alLeer={aplicarPropuesta} />}

      <form ref={formulario} action={enviar} className="flex flex-col gap-5">
        {aviso && <input type="hidden" name="id" value={aviso.id} />}

        <AvisoError mensaje={resultado.mensaje} />

        <Tarjeta className="p-5 sm:p-6">
          <GrupoCampos titulo="Dónde" descripcion="El aviso se abre sobre un local concreto del cliente.">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Cliente" nombre="clienteId" error={errores.clienteId} obligatorio>
                <Selector
                  id="clienteId"
                  name="clienteId"
                  defaultValue={clienteId}
                  error={Boolean(errores.clienteId)}
                  onChange={(evento) => {
                    setClienteId(evento.target.value)
                    setLocalId('')
                  }}
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
                etiqueta="Local"
                nombre="localId"
                error={errores.localId}
                ayuda={clienteId ? undefined : 'Primero elige el cliente'}
                obligatorio
              >
                <Selector
                  id="localId"
                  name="localId"
                  defaultValue={localId}
                  disabled={!clienteId}
                  error={Boolean(errores.localId)}
                  onChange={(evento) => setLocalId(evento.target.value)}
                >
                  <option value="">
                    {!clienteId
                      ? 'Selecciona primero el cliente'
                      : localesDelCliente.length
                        ? 'Selecciona un local…'
                        : 'Este cliente no tiene locales'}
                  </option>
                  {localesDelCliente.map((local) => (
                    <option key={local.id} value={local.id}>
                      {local.nombre} — {local.ciudad}
                    </option>
                  ))}
                </Selector>
              </Campo>
            </div>
          </GrupoCampos>
        </Tarjeta>

        <Tarjeta className="p-5 sm:p-6">
          <GrupoCampos titulo="Qué pasa">
            <Campo etiqueta="Resumen de la incidencia" nombre="titulo" error={errores.titulo} obligatorio>
              <Entrada
                id="titulo"
                name="titulo"
                defaultValue={previo('titulo')}
                placeholder="Por ejemplo: la cámara de carnicería no baja de 8 grados"
                error={Boolean(errores.titulo)}
                autoComplete="off"
              />
            </Campo>

            <Campo
              etiqueta="Descripción"
              nombre="descripcion"
              error={errores.descripcion}
              ayuda="Lo que ha contado el cliente: desde cuándo pasa, qué han probado, si hay urgencia."
            >
              <AreaTexto
                id="descripcion"
                name="descripcion"
                rows={4}
                defaultValue={previo('descripcion')}
                error={Boolean(errores.descripcion)}
              />
            </Campo>

            <div className="grid gap-4 sm:grid-cols-3">
              <Campo etiqueta="Tipo de trabajo" nombre="categoria" error={errores.categoria} obligatorio>
                <Selector
                  id="categoria"
                  name="categoria"
                  defaultValue={previo('categoria') || 'fontaneria'}
                  error={Boolean(errores.categoria)}
                >
                  {OPCIONES_CATEGORIA.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </Selector>
              </Campo>

              <Campo etiqueta="Prioridad" nombre="prioridad" error={errores.prioridad} obligatorio>
                <Selector
                  id="prioridad"
                  name="prioridad"
                  defaultValue={previo('prioridad') || 'normal'}
                  error={Boolean(errores.prioridad)}
                >
                  {OPCIONES_PRIORIDAD.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </Selector>
              </Campo>

              <Campo etiqueta="Cómo ha entrado" nombre="canalEntrada" error={errores.canalEntrada}>
                <Selector
                  id="canalEntrada"
                  name="canalEntrada"
                  defaultValue={previo('canalEntrada') || 'telefono'}
                  error={Boolean(errores.canalEntrada)}
                >
                  {OPCIONES_CANAL.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </Selector>
              </Campo>
            </div>

            <Campo
              etiqueta="Quién avisa"
              nombre="contactoAviso"
              error={errores.contactoAviso}
              ayuda="La persona del local con la que hay que hablar al llegar."
            >
              <Entrada
                id="contactoAviso"
                name="contactoAviso"
                defaultValue={previo('contactoAviso')}
                placeholder="Nombre de la persona que ha llamado"
                error={Boolean(errores.contactoAviso)}
              />
            </Campo>
          </GrupoCampos>
        </Tarjeta>

        <Tarjeta className="p-5 sm:p-6">
          <GrupoCampos titulo="Quién y cuándo">
            <div className="grid gap-4 sm:grid-cols-2">
              <Campo
                etiqueta="Técnico asignado"
                nombre="tecnicoId"
                error={errores.tecnicoId}
                ayuda="Se puede dejar sin asignar y repartirlo después."
              >
                <Selector
                  id="tecnicoId"
                  name="tecnicoId"
                  defaultValue={previo('tecnicoId')}
                  error={Boolean(errores.tecnicoId)}
                >
                  <option value="">Sin asignar</option>
                  {tecnicos.map((tecnico) => (
                    <option key={tecnico.id} value={tecnico.id}>
                      {tecnico.nombre} {tecnico.apellidos ?? ''}
                    </option>
                  ))}
                </Selector>
              </Campo>

              <Campo etiqueta="Estado" nombre="estado" error={errores.estado} obligatorio>
                <Selector
                  id="estado"
                  name="estado"
                  defaultValue={estado}
                  error={Boolean(errores.estado)}
                  onChange={(evento) => setEstado(evento.target.value as Estado)}
                >
                  {OPCIONES_ESTADO.map((opcion) => (
                    <option key={opcion.valor} value={opcion.valor}>
                      {opcion.etiqueta}
                    </option>
                  ))}
                </Selector>
              </Campo>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Día previsto" nombre="fechaProgramada" error={errores.fechaProgramada}>
                <Entrada
                  id="fechaProgramada"
                  name="fechaProgramada"
                  type="date"
                  defaultValue={previo('fechaProgramada')}
                  error={Boolean(errores.fechaProgramada)}
                />
              </Campo>

              <Campo etiqueta="Hora prevista" nombre="horaProgramada" error={errores.horaProgramada}>
                <Entrada
                  id="horaProgramada"
                  name="horaProgramada"
                  type="time"
                  defaultValue={previo('horaProgramada')}
                  error={Boolean(errores.horaProgramada)}
                />
              </Campo>
            </div>

            {estado === 'en_espera' && (
              <Campo
                etiqueta="Motivo de la espera"
                nombre="motivoEspera"
                error={errores.motivoEspera}
                ayuda="Falta material, falta presupuesto, no hay acceso al local…"
                obligatorio
              >
                <AreaTexto
                  id="motivoEspera"
                  name="motivoEspera"
                  rows={2}
                  defaultValue={previo('motivoEspera')}
                  error={Boolean(errores.motivoEspera)}
                />
              </Campo>
            )}

            {estado === 'finalizado' && (
              <Campo
                etiqueta="Resumen de lo realizado"
                nombre="resumenCierre"
                error={errores.resumenCierre}
                ayuda="Lo que queda como cierre del aviso para el cliente."
                obligatorio
              >
                <AreaTexto
                  id="resumenCierre"
                  name="resumenCierre"
                  rows={3}
                  defaultValue={previo('resumenCierre')}
                  error={Boolean(errores.resumenCierre)}
                />
              </Campo>
            )}
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
            {enviando ? 'Guardando…' : aviso ? 'Guardar cambios' : 'Registrar aviso'}
          </Boton>
        </div>
      </form>
    </div>
  )
}

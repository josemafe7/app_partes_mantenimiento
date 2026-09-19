'use client'

import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCenter,
  pointerWithin,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core'
import { GripVertical, MapPin, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useState, useTransition } from 'react'

import { cambiarEstado } from '@/acciones/avisos'
import { IconoCategoria } from '@/componentes/avisos/IconoCategoria'
import { AvatarTecnico, Referencia } from '@/componentes/avisos/ListaAvisos'
import { Boton } from '@/componentes/ui/Boton'
import { AreaTexto, Campo } from '@/componentes/ui/Campo'
import { Dialogo } from '@/componentes/ui/Dialogo'
import { PrioridadEtiqueta } from '@/componentes/ui/Etiqueta'
import type { AvisoEnLista } from '@/db/consultas/avisos'
import { ESTADO, ESTADOS, requiereMotivoEspera, requiereResumenCierre, type Estado } from '@/lib/dominio'
import { fechaRelativa } from '@/lib/fechas'
import { cn } from '@/lib/utils'

type Columnas = Record<Estado, AvisoEnLista[]>

/**
 * Dónde se suelta la tarjeta: la columna donde está el cursor y, si el cursor
 * cae en el hueco entre dos columnas, la más cercana. Así soltar nunca se
 * queda en nada.
 */
const dondeSeSuelta: CollisionDetection = (argumentos) => {
  const bajoElCursor = pointerWithin(argumentos)
  return bajoElCursor.length > 0 ? bajoElCursor : closestCenter(argumentos)
}

/* ------------------------------------------------------------------ Tarjeta */

function ContenidoTarjeta({ aviso, conAsa }: { aviso: AvisoEnLista; conAsa?: boolean }) {
  return (
    <>
      <div className="flex items-start gap-2">
        <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-white/85 text-gris-800">
          <IconoCategoria categoria={aviso.categoria} className="size-3.5" />
        </span>
        <span className="min-w-0 flex-1">
          <Referencia className="text-xs text-gris-600">{aviso.referencia}</Referencia>
          <span className="block text-sm leading-snug font-medium text-gris-950">{aviso.titulo}</span>
        </span>
        {conAsa && <GripVertical className="mt-0.5 size-4 shrink-0 text-gris-500/60" aria-hidden />}
      </div>

      <p className="mt-2 flex items-start gap-1 text-[0.8125rem] text-gris-700">
        <MapPin className="mt-0.5 size-3.5 shrink-0 opacity-60" aria-hidden />
        <span className="line-clamp-2">
          {aviso.clienteNombre}, {aviso.localNombre}
        </span>
      </p>

      <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
        {/*
         * La prioridad normal no se rotula: es la mayoría y solo haría ruido.
         * Sobre el pastel la etiqueta va en blanco; la urgente conserva su coral.
         */}
        {aviso.prioridad !== 'normal' && (
          <PrioridadEtiqueta
            prioridad={aviso.prioridad}
            className={aviso.prioridad === 'urgente' ? undefined : 'bg-white/85'}
          />
        )}
        <span className="ml-auto flex items-center gap-1.5 text-xs font-medium text-gris-700">
          {aviso.fechaProgramada ? fechaRelativa(aviso.fechaProgramada) : 'Sin fecha'}
          <AvatarTecnico
            nombre={aviso.tecnicoNombre}
            apellidos={aviso.tecnicoApellidos}
            className="size-6 bg-white/85 text-[0.625rem]"
          />
        </span>
      </div>
    </>
  )
}

/**
 * Tarjeta arrastrable (solo en escritorio).
 *
 * La tarjeta no se mueve: se queda en su sitio marcando el hueco y lo que
 * sigue al ratón es la copia del <DragOverlay>. Moverla aquí no serviría,
 * porque las columnas recortan lo que sobresale de ellas y la tarjeta se
 * quedaría cortada y por detrás de la columna de al lado.
 */
function TarjetaArrastrable({ aviso }: { aviso: AvisoEnLista }) {
  const { attributes, listeners, setNodeRef, isDragging } = useDraggable({
    id: `aviso-${aviso.id}`,
    data: { aviso },
  })

  return (
    <div
      ref={setNodeRef}
      className={cn(
        'rounded-tarjeta p-3 ring-1 ring-inset transition-[opacity,box-shadow]',
        ESTADO[aviso.estado].tarjeta,
        isDragging && 'opacity-35',
      )}
    >
      <button
        type="button"
        {...listeners}
        {...attributes}
        aria-label={`Mover el aviso ${aviso.referencia}`}
        draggable={false}
        // `select-none` evita que al arrastrar se vaya seleccionando el texto
        // de la tarjeta, que pelea con el gesto y parece que no funciona.
        className="w-full cursor-grab touch-none select-none text-left active:cursor-grabbing"
      >
        <ContenidoTarjeta aviso={aviso} conAsa />
      </button>
      <Link
        href={`/avisos/${aviso.id}`}
        className="mt-2.5 inline-flex h-7 items-center rounded-full bg-white/85 px-3 text-xs font-medium text-gris-800 transition-colors hover:bg-white hover:text-marca-700"
      >
        Abrir el aviso
      </Link>
    </div>
  )
}

/* ------------------------------------------------------------------ Columna */

function Columna({
  estado,
  avisos,
  activa,
}: {
  estado: Estado
  avisos: AvisoEnLista[]
  activa: boolean
}) {
  const { setNodeRef, isOver } = useDroppable({ id: estado })

  return (
    <section
      ref={setNodeRef}
      className={cn(
        // Altura fija: las columnas se desplazan por dentro y el tablero
        // entero cabe en pantalla, como se espera de un tablero.
        'flex h-[calc(100dvh-15.5rem)] min-h-96 w-72 shrink-0 flex-col overflow-hidden rounded-panel transition-[background-color,box-shadow]',
        isOver ? 'bg-lima-50 ring-2 ring-lima-400' : 'bg-white ring-1 ring-gris-200/70',
        activa && !isOver && 'ring-gris-300',
      )}
    >
      <header className="flex items-center gap-2.5 px-4 pt-3.5 pb-3">
        <span className={cn('size-2.5 shrink-0 rounded-full', ESTADO[estado].punto)} aria-hidden />
        <h2 className="titular text-[0.9375rem] font-semibold text-gris-900">{ESTADO[estado].etiqueta}</h2>
        <span className="ml-auto grid h-6 min-w-6 place-items-center rounded-full bg-gris-100 px-1.5 text-xs font-semibold text-gris-700">
          {avisos.length}
        </span>
      </header>

      <div className="flex min-h-24 flex-1 flex-col gap-2 overflow-y-auto px-2.5 pb-2.5">
        {avisos.length === 0 ? (
          <p
            className={cn(
              'grid flex-1 place-items-center rounded-tarjeta border border-dashed px-2 py-8 text-center text-sm',
              isOver ? 'border-lima-500 text-lima-800' : 'border-gris-200 text-gris-400',
            )}
          >
            {isOver ? 'Suelta aquí' : 'Sin avisos'}
          </p>
        ) : (
          avisos.map((aviso) => <TarjetaArrastrable key={aviso.id} aviso={aviso} />)
        )}
      </div>
    </section>
  )
}

/* ------------------------------------------------------------------ Tablero */

export function Tablero({ columnas }: { columnas: Columnas }) {
  const [board, setBoard] = useState<Columnas>(columnas)
  /** La tarjeta que se está arrastrando, para pintarla en la capa flotante. */
  const [arrastrando, setArrastrando] = useState<AvisoEnLista | null>(null)
  const [, iniciarTransicion] = useTransition()
  const [error, setError] = useState<string | null>(null)

  // Movimiento que necesita una nota antes de confirmarse.
  const [pendiente, setPendiente] = useState<{ aviso: AvisoEnLista; destino: Estado } | null>(null)
  const [nota, setNota] = useState('')
  const [guardando, setGuardando] = useState(false)

  // Los datos del servidor mandan: cuando la página se revalida y llegan
  // columnas nuevas, se descarta la copia local. Se ajusta en el render en
  // lugar de con un efecto para no encadenar un segundo render.
  const [columnasServidor, setColumnasServidor] = useState(columnas)
  if (columnasServidor !== columnas) {
    setColumnasServidor(columnas)
    setBoard(columnas)
  }

  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  )

  /** Mueve la tarjeta en la vista antes de que responda el servidor. */
  function moverEnVista(aviso: AvisoEnLista, origen: Estado, destino: Estado) {
    setBoard((actual) => ({
      ...actual,
      [origen]: actual[origen].filter((item) => item.id !== aviso.id),
      [destino]: [{ ...aviso, estado: destino }, ...actual[destino]],
    }))
  }

  async function aplicar(aviso: AvisoEnLista, destino: Estado, textoNota: string) {
    const origen = aviso.estado
    moverEnVista(aviso, origen, destino)

    const resultado = await cambiarEstado(aviso.id, destino, textoNota)
    if (!resultado.ok) {
      // Se deshace el movimiento y se explica por qué no ha podido ser.
      setBoard((actual) => ({
        ...actual,
        [destino]: actual[destino].filter((item) => item.id !== aviso.id),
        [origen]: [aviso, ...actual[origen]],
      }))
      setError(resultado.mensaje ?? resultado.errores?.nota ?? 'No se ha podido cambiar el estado')
      return false
    }
    setError(null)
    return true
  }

  function alSoltar(evento: DragEndEvent) {
    setArrastrando(null)
    const destino = evento.over?.id
    const aviso = evento.active.data.current?.aviso as AvisoEnLista | undefined
    if (!aviso || typeof destino !== 'string') return
    if (!(ESTADOS as readonly string[]).includes(destino)) return

    const estadoDestino = destino as Estado
    if (estadoDestino === aviso.estado) return

    // Aparcar o cerrar un aviso exige explicar por qué: se pregunta antes.
    if (requiereMotivoEspera(estadoDestino) || requiereResumenCierre(estadoDestino)) {
      setNota('')
      setPendiente({ aviso, destino: estadoDestino })
      return
    }

    iniciarTransicion(() => {
      void aplicar(aviso, estadoDestino, '')
    })
  }

  function alEmpezar(evento: DragStartEvent) {
    setArrastrando((evento.active.data.current?.aviso as AvisoEnLista | undefined) ?? null)
    setError(null)
  }

  const etiquetaNota = pendiente && requiereMotivoEspera(pendiente.destino)
    ? { etiqueta: 'Motivo de la espera', ayuda: 'Falta material, falta presupuesto, no hay acceso…' }
    : { etiqueta: 'Resumen de lo realizado', ayuda: 'Queda como cierre del aviso.' }

  return (
    <>
      {error && (
        <div
          role="alert"
          className="mb-4 flex gap-2.5 rounded-tarjeta bg-mantequilla-100 px-4 py-3 text-sm text-mantequilla-800 ring-1 ring-mantequilla-300 ring-inset"
        >
          <TriangleAlert className="mt-0.5 size-4.5 shrink-0" aria-hidden />
          <p>{error}</p>
        </div>
      )}

      {/* Escritorio: columnas con arrastrar y soltar */}
      <div className="hidden lg:block">
        <DndContext
          // Identificador fijo: sin él, dnd-kit numera sus atributos de
          // accesibilidad con un contador que no coincide entre el servidor y
          // el navegador, y React avisa de un desajuste al hidratar.
          id="tablero-avisos"
          sensors={sensores}
          collisionDetection={dondeSeSuelta}
          onDragStart={alEmpezar}
          onDragEnd={alSoltar}
          onDragCancel={() => setArrastrando(null)}
        >
          <div className="-mx-4 flex gap-3 overflow-x-auto px-4 pb-3 sm:mx-0 sm:px-0">
            {ESTADOS.map((estado) => (
              <Columna
                key={estado}
                estado={estado}
                avisos={board[estado]}
                activa={arrastrando !== null}
              />
            ))}
          </div>

          {/*
           * La tarjeta que sigue al ratón se dibuja aquí, fuera de las
           * columnas: al ir en una capa flotante no la recorta el desbordamiento
           * de ninguna de ellas y siempre se ve por encima del tablero.
           */}
          <DragOverlay dropAnimation={null}>
            {arrastrando && (
              // Se inclina un poco al levantarla, como una nota que se despega
              // del tablero: así se ve claro qué se lleva en la mano.
              <div
                className={cn(
                  'w-67 -rotate-2 cursor-grabbing rounded-tarjeta p-3 shadow-flotante ring-1 ring-inset motion-reduce:rotate-0',
                  ESTADO[arrastrando.estado].tarjeta,
                )}
              >
                <ContenidoTarjeta aviso={arrastrando} conAsa />
              </div>
            )}
          </DragOverlay>
        </DndContext>
      </div>

      {/* Móvil: sin arrastrar, se abre el aviso para cambiarlo */}
      <div className="lg:hidden">
        <ListaPorEstados columnas={board} />
      </div>

      <Dialogo
        abierto={pendiente !== null}
        onCerrar={() => setPendiente(null)}
        titulo={
          pendiente
            ? `Pasar a «${ESTADO[pendiente.destino].etiqueta}»`
            : 'Cambiar el estado'
        }
        descripcion={pendiente?.aviso.titulo}
      >
        <div className="flex flex-col gap-4">
          <Campo etiqueta={etiquetaNota.etiqueta} nombre="nota-tablero" ayuda={etiquetaNota.ayuda} obligatorio>
            <AreaTexto
              id="nota-tablero"
              rows={3}
              value={nota}
              onChange={(evento) => setNota(evento.target.value)}
            />
          </Campo>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Boton variante="secundario" onClick={() => setPendiente(null)} disabled={guardando}>
              Cancelar
            </Boton>
            <Boton
              disabled={guardando || nota.trim().length === 0}
              onClick={async () => {
                if (!pendiente) return
                setGuardando(true)
                const hecho = await aplicar(pendiente.aviso, pendiente.destino, nota)
                setGuardando(false)
                if (hecho) setPendiente(null)
              }}
            >
              {guardando ? 'Guardando…' : 'Confirmar'}
            </Boton>
          </div>
        </div>
      </Dialogo>
    </>
  )
}

/* ---------------------------------------------------- Versión para el móvil */

function ListaPorEstados({ columnas }: { columnas: Columnas }) {
  const [activo, setActivo] = useState<Estado>('pendiente')
  const avisos = columnas[activo]

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sin-barra">
        {ESTADOS.map((estado) => (
          <button
            key={estado}
            type="button"
            onClick={() => setActivo(estado)}
            aria-pressed={activo === estado}
            className={cn(
              'flex h-10 shrink-0 items-center gap-2 rounded-full pr-2 pl-3.5 text-sm font-medium transition-colors',
              activo === estado
                ? 'bg-lima-300 text-gris-950'
                : 'bg-white text-gris-600 ring-1 ring-gris-200/70 ring-inset',
            )}
          >
            <span className={cn('size-2 rounded-full', ESTADO[estado].punto)} aria-hidden />
            {ESTADO[estado].etiqueta}
            <span
              className={cn(
                'grid h-6 min-w-6 place-items-center rounded-full px-1.5 text-xs font-semibold',
                activo === estado ? 'bg-white/70 text-gris-950' : 'bg-gris-100 text-gris-700',
              )}
            >
              {columnas[estado].length}
            </span>
          </button>
        ))}
      </div>

      <p className="text-[0.8125rem] text-gris-500">
        Para cambiar el estado desde el móvil, abre el aviso y usa «Cambiar estado».
      </p>

      {avisos.length === 0 ? (
        <p className="rounded-panel bg-white px-4 py-10 text-center text-sm text-gris-500 ring-1 ring-gris-200/70">
          No hay avisos en «{ESTADO[activo].etiqueta}»
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {avisos.map((aviso) => (
            <li key={aviso.id}>
              <Link
                href={`/avisos/${aviso.id}`}
                className={cn('block rounded-tarjeta p-3.5 ring-1 ring-inset transition-shadow', ESTADO[aviso.estado].tarjeta)}
              >
                <ContenidoTarjeta aviso={aviso} />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

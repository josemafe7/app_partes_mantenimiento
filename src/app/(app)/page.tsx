import { ArrowDown, ArrowUp, CircleCheck, Inbox, Plus, UserRound } from 'lucide-react'
import Link from 'next/link'

import { AvatarTecnico, ListaAvisosCompacta } from '@/componentes/avisos/ListaAvisos'
import { AgendaSemana } from '@/componentes/panel/AgendaSemana'
import { CargarEjemplos } from '@/componentes/panel/CargarEjemplos'
import { GraficoHoras } from '@/componentes/panel/GraficoHoras'
import { PanelTecnico } from '@/componentes/panel/PanelTecnico'
import { TarjetaContador } from '@/componentes/panel/TarjetaContador'
import { BotonEnlace } from '@/componentes/ui/Boton'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { CLASES_PANEL, Seccion, Tarjeta } from '@/componentes/ui/Tarjeta'
import { avisosProgramados } from '@/db/consultas/avisos'
import {
  actividadReciente,
  bdVacia,
  cargaPorTecnico,
  contadoresPanel,
  listasPanel,
  resumenHoras,
} from '@/db/consultas/panel'
import { ESTADO } from '@/lib/dominio'
import { haceTiempo, horasTexto, hoyISO, lunesDe, mesYAnio, semanaDesde, sumarDias } from '@/lib/fechas'
import { enlaceAvisos } from '@/lib/filtros'
import { esTecnico, puede } from '@/lib/permisos'
import { exigirUsuario } from '@/lib/sesion'
import { cn, plural } from '@/lib/utils'

const formatoHoras = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 })

export default async function PaginaPanel() {
  const usuario = await exigirUsuario()

  // El técnico tiene su propio inicio: su jornada.
  if (esTecnico(usuario)) return <PanelTecnico usuario={usuario} />

  if (await bdVacia()) {
    const administrador = puede(usuario, 'cargarDatosEjemplo')
    return (
      <>
        <EncabezadoPagina titulo="Qué hay pendiente" />
        <Tarjeta>
          <EstadoVacio
            icono={Inbox}
            titulo="La aplicación está vacía"
            texto={
              administrador
                ? 'Carga los datos de ejemplo para ver cómo queda todo con clientes, técnicos, avisos y partes de trabajo. Podrás borrarlos cuando quieras.'
                : 'Todavía no hay clientes. Empieza dando de alta el primero, o pide al administrador que cargue los datos de ejemplo.'
            }
            accion={
              administrador ? (
                <CargarEjemplos />
              ) : (
                <BotonEnlace href="/clientes/nuevo">
                  <Plus className="size-4.5" aria-hidden />
                  Crear el primer cliente
                </BotonEnlace>
              )
            }
          />
        </Tarjeta>
      </>
    )
  }

  const hoy = hoyISO()
  const dias = semanaDesde(lunesDe(hoy))
  // La agenda del panel enseña la semana entera y, si hoy es fin de semana,
  // también lo que viene: por eso llega hasta el más lejano de los dos días.
  const hasta = [dias[6], sumarDias(hoy, 7)].sort()[1]

  const [contadores, listas, actividad, carga, horas, visitas] = await Promise.all([
    contadoresPanel(),
    listasPanel(),
    actividadReciente(7),
    cargaPorTecnico(),
    resumenHoras(8),
    avisosProgramados(dias[0], hasta),
  ])

  const parteDe = (valor: number) =>
    contadores.abiertos ? `${Math.round((valor / contadores.abiertos) * 100)} %` : ''
  const DEL_TOTAL = 'Parte del trabajo sin cerrar'

  const cambioHoras =
    horas.anteriores30 > 0
      ? Math.round(((horas.ultimos30 - horas.anteriores30) / horas.anteriores30) * 100)
      : null
  const maxAbiertos = Math.max(1, ...carga.map((tecnico) => tecnico.abiertos))

  return (
    <>
      <EncabezadoPagina
        titulo="Qué hay pendiente"
        descripcion={`${plural(contadores.abiertos, 'aviso sin cerrar', 'avisos sin cerrar')} y ${plural(contadores.paraHoy, 'visita prevista', 'visitas previstas')} para hoy.`}
        acciones={
          <BotonEnlace href="/avisos/nuevo" tamano="lg" className="max-sm:hidden">
            <Plus className="size-5" aria-hidden />
            Nuevo aviso
          </BotonEnlace>
        }
      />

      {/* Contadores */}
      <section className={cn(CLASES_PANEL, 'overflow-hidden')}>
        <header className="flex flex-wrap items-center justify-between gap-3 px-5 pt-4.5 pb-4 sm:px-6">
          <div>
            <h2 className="titular text-[1.0625rem] font-semibold text-gris-900">Trabajo abierto</h2>
            <p className="mt-0.5 text-sm text-gris-500">Pulsa una cifra para ver esos avisos</p>
          </div>
          {/* En el móvil sobra: el listado está en la barra inferior */}
          <BotonEnlace href="/avisos" variante="secundario" tamano="sm" className="max-sm:hidden">
            Ver el listado
          </BotonEnlace>
        </header>
        <div className="grid grid-cols-2 gap-px border-t border-gris-200/70 bg-gris-200/70 sm:grid-cols-3 xl:grid-cols-6">
          <TarjetaContador
            etiqueta="Sin cerrar"
            valor={contadores.abiertos}
            href={enlaceAvisos({ vista: 'abiertos' })}
            punto="bg-marca-500"
            nota="todo el trabajo vivo"
            extra={
              contadores.recibidosSemana > 0
                ? {
                    texto: `+${contadores.recibidosSemana} nuevos`,
                    titulo: 'Avisos recibidos en los últimos 7 días',
                  }
                : undefined
            }
          />
          <TarjetaContador
            etiqueta="Sin asignar"
            valor={contadores.sinAsignar}
            href={enlaceAvisos({ vista: 'sin_asignar' })}
            punto="bg-mantequilla-500"
            nota="esperan técnico"
            extra={{ texto: parteDe(contadores.sinAsignar), titulo: DEL_TOTAL }}
          />
          <TarjetaContador
            etiqueta="Para hoy"
            valor={contadores.paraHoy}
            href={enlaceAvisos({ vista: 'hoy' })}
            punto="bg-lavanda-500"
            nota="visitas previstas"
            extra={{ texto: parteDe(contadores.paraHoy), titulo: DEL_TOTAL }}
          />
          <TarjetaContador
            etiqueta="Retrasados"
            valor={contadores.retrasados}
            href={enlaceAvisos({ vista: 'retrasados' })}
            punto="bg-coral-500"
            nota="se pasó su fecha"
            extra={{ texto: parteDe(contadores.retrasados), titulo: DEL_TOTAL, alerta: true }}
          />
          <TarjetaContador
            etiqueta="Urgentes"
            valor={contadores.urgentes}
            href={enlaceAvisos({ vista: 'urgentes' })}
            punto="bg-coral-500"
            nota="prioridad alta o urgente"
            extra={{ texto: parteDe(contadores.urgentes), titulo: DEL_TOTAL, alerta: true }}
          />
          <TarjetaContador
            etiqueta="En espera"
            valor={contadores.enEspera}
            href={enlaceAvisos({ estado: 'en_espera' })}
            punto="bg-orquidea-500"
            nota="falta material o permiso"
            extra={{ texto: parteDe(contadores.enEspera), titulo: DEL_TOTAL }}
          />
        </div>
      </section>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)]">
        {/* Horas */}
        <Seccion
          titulo="Horas de trabajo"
          descripcion="Anotadas en los partes, semana a semana"
          claseCuerpo="flex flex-1 flex-col"
        >
          <div className="mb-7 flex flex-wrap items-center gap-x-3 gap-y-1.5">
            <span className="cifra text-[2.75rem] leading-none font-medium text-gris-950">
              {formatoHoras.format(horas.ultimos30)}
              <span className="ml-1 text-2xl text-gris-500">h</span>
            </span>
            {cambioHoras !== null && (
              <span
                className={cn(
                  'inline-flex h-6 items-center gap-1 rounded-full px-2 text-xs font-medium ring-1 ring-inset',
                  cambioHoras > 0 && 'bg-menta-50 text-menta-800 ring-menta-200',
                  cambioHoras < 0 && 'bg-coral-50 text-coral-700 ring-coral-200',
                  cambioHoras === 0 && 'bg-gris-50 text-gris-600 ring-gris-200',
                )}
              >
                {cambioHoras > 0 && <ArrowUp className="size-3.5" aria-hidden />}
                {cambioHoras < 0 && <ArrowDown className="size-3.5" aria-hidden />}
                {Math.abs(cambioHoras)} %
              </span>
            )}
            <span className="basis-full text-sm text-gris-500">
              en los últimos 30 días
              {cambioHoras !== null && ', frente a los 30 anteriores'}
            </span>
          </div>
          {horas.semanas.some((semana) => semana.horas > 0) ? (
            <GraficoHoras semanas={horas.semanas} />
          ) : (
            <p className="rounded-tarjeta bg-gris-50 px-4 py-6 text-center text-sm text-gris-600">
              Todavía no hay partes de trabajo en estas semanas.
            </p>
          )}
        </Seccion>

        {/* Agenda */}
        <Seccion
          titulo="Agenda"
          descripcion={mesYAnio(hoy)}
          accion={
            <BotonEnlace href="/agenda" variante="secundario" tamano="sm">
              Ver la semana
            </BotonEnlace>
          }
        >
          <AgendaSemana hoy={hoy} dias={dias} avisos={visitas} />
        </Seccion>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* Retrasados */}
        <Seccion
          titulo="Retrasados"
          descripcion={
            listas.retrasados.length ? 'Su fecha prevista ya ha pasado y siguen abiertos' : undefined
          }
          sinRelleno
        >
          {listas.retrasados.length ? (
            <ListaAvisosCompacta avisos={listas.retrasados} />
          ) : (
            <EstadoVacio
              icono={CircleCheck}
              titulo="Nada retrasado"
              texto="Todos los avisos con fecha están dentro de plazo."
              className="py-9"
            />
          )}
        </Seccion>

        {/* Sin asignar */}
        <Seccion
          titulo="Esperando técnico"
          descripcion={
            listas.sinAsignar.length ? 'Entraron y todavía no tienen a nadie asignado' : undefined
          }
          sinRelleno
        >
          {listas.sinAsignar.length ? (
            <ListaAvisosCompacta avisos={listas.sinAsignar} />
          ) : (
            <EstadoVacio
              icono={CircleCheck}
              titulo="Todo repartido"
              texto="No queda ningún aviso sin técnico asignado."
              className="py-9"
            />
          )}
        </Seccion>

        {/* Carga por técnico */}
        <Seccion titulo="Carga por técnico" descripcion="Avisos abiertos de cada uno y horas del último mes" sinRelleno>
          {carga.length ? (
            <ul className="divide-y divide-gris-200/70">
              {carga.map((tecnico) => (
                <li key={tecnico.id}>
                  <Link
                    href={`/tecnicos/${tecnico.id}`}
                    className="flex items-center gap-3 px-5 py-3 transition-colors hover:bg-gris-50 sm:px-6"
                  >
                    <AvatarTecnico nombre={tecnico.nombre} apellidos={tecnico.apellidos} className="size-9 text-xs" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-gris-900">
                        {tecnico.nombre} {tecnico.apellidos ?? ''}
                      </span>
                      <span className="block text-[0.8125rem] text-gris-500">
                        {horasTexto(tecnico.horas)} en 30 días
                      </span>
                    </span>
                    <span className="flex w-28 shrink-0 items-center gap-2.5 sm:w-36">
                      <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-marca-50" aria-hidden>
                        <span
                          className="block h-full rounded-full bg-marca-500"
                          style={{ width: `${(tecnico.abiertos / maxAbiertos) * 100}%` }}
                        />
                      </span>
                      <span className="w-6 text-right text-sm font-semibold text-gris-900 tabular-nums">
                        {tecnico.abiertos}
                        <span className="sr-only"> {tecnico.abiertos === 1 ? 'aviso abierto' : 'avisos abiertos'}</span>
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EstadoVacio
              icono={UserRound}
              titulo="Todavía no hay técnicos"
              accion={
                puede(usuario, 'altaTecnicos') ? (
                  <BotonEnlace href="/tecnicos/nuevo">Añadir un técnico</BotonEnlace>
                ) : undefined
              }
              className="py-9"
            />
          )}
        </Seccion>

        {/* Actividad */}
        <Seccion titulo="Últimos movimientos" descripcion="Lo que se ha ido cambiando" sinRelleno>
          <ul className="divide-y divide-gris-200/70">
            {actividad.map((movimiento) => (
              <li key={movimiento.id}>
                <Link
                  href={`/avisos/${movimiento.avisoId}`}
                  className="group flex gap-3 px-5 py-3 transition-colors hover:bg-gris-50 sm:px-6"
                >
                  <span
                    className={cn('mt-1.5 size-2.5 shrink-0 rounded-full', ESTADO[movimiento.estadoNuevo].punto)}
                    aria-hidden
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline gap-3">
                      <span className="truncate font-medium text-gris-900 group-hover:text-marca-700">
                        {movimiento.titulo}
                      </span>
                      <span className="ml-auto shrink-0 text-xs text-gris-500">
                        {haceTiempo(movimiento.fecha)}
                      </span>
                    </span>
                    <span className="mt-0.5 block truncate text-[0.8125rem] text-gris-500">
                      <span className="font-medium text-gris-700">{ESTADO[movimiento.estadoNuevo].etiqueta}</span>
                      {movimiento.nota ? `: ${movimiento.nota}` : ''}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </Seccion>
      </div>
    </>
  )
}

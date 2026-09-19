import { CalendarDays, ChevronLeft, ChevronRight, Inbox } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { VistaMes } from '@/componentes/agenda/VistaMes'
import { VistaSemana } from '@/componentes/agenda/VistaSemana'
import { IconoCategoria } from '@/componentes/avisos/IconoCategoria'
import { BotonEnlace } from '@/componentes/ui/Boton'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { EstadoEtiqueta, PrioridadEtiqueta } from '@/componentes/ui/Etiqueta'
import { SelectorUrl } from '@/componentes/ui/SelectorUrl'
import { Seccion, Tarjeta } from '@/componentes/ui/Tarjeta'
import { avisosProgramados, avisosSinProgramar, type AvisoEnLista } from '@/db/consultas/avisos'
import { tecnicosParaSelector } from '@/db/consultas/tecnicos'
import {
  cuadriculaMes,
  esFechaISO,
  fechaBreve,
  hoyISO,
  inicioDeMes,
  lunesDe,
  mesYAnio,
  semanaDesde,
  sumarDias,
  sumarMeses,
} from '@/lib/fechas'
import { ambitoDe, puede } from '@/lib/permisos'
import { exigirUsuario } from '@/lib/sesion'
import { cn, plural } from '@/lib/utils'

export const metadata: Metadata = { title: 'Agenda' }

type Props = {
  /** `vista=mes` muestra el mes `mes` (`YYYY-MM`); si no, la semana del día `semana`. */
  searchParams: Promise<{ vista?: string; semana?: string; mes?: string; tecnico?: string }>
}

const CLASES_FLECHA =
  'grid size-9 place-items-center rounded-full text-gris-600 transition-colors hover:bg-gris-100 hover:text-gris-950'

/**
 * Opción de una píldora de botones: la elegida va en lima. En el móvil el relleno
 * es algo menor para que las dos píldoras quepan en una línea a 375 px.
 */
function claseOpcion(activa: boolean) {
  return cn(
    'flex h-9 items-center rounded-full px-3 text-sm font-medium transition-colors sm:px-3.5',
    activa ? 'bg-lima-300 text-gris-950' : 'text-gris-700 hover:bg-gris-100',
  )
}

export default async function PaginaAgenda({ searchParams }: Props) {
  const usuario = await exigirUsuario()
  const { vista, semana, mes, tecnico } = await searchParams
  // El técnico ve su agenda: sin selector de técnico y solo sus avisos.
  const oficina = puede(usuario, 'gestionarAvisos')
  const ambito = ambitoDe(usuario)

  const hoy = hoyISO()
  const enMes = vista === 'mes'
  const lunes = lunesDe(semana && esFechaISO(semana) ? semana : hoy)
  const inicio = mes && esFechaISO(`${mes}-01`) ? `${mes}-01` : inicioDeMes(hoy)
  const dias = enMes ? cuadriculaMes(inicio) : semanaDesde(lunes)
  const tecnicoId = oficina && tecnico && /^\d+$/.test(tecnico) ? Number(tecnico) : undefined

  const [avisos, sinProgramar, tecnicos] = await Promise.all([
    avisosProgramados(dias[0], dias[dias.length - 1], tecnicoId, ambito),
    avisosSinProgramar(20, ambito),
    oficina ? tecnicosParaSelector() : [],
  ])

  const porDia = new Map<string, AvisoEnLista[]>(dias.map((dia) => [dia, []]))
  for (const aviso of avisos) {
    if (aviso.fechaProgramada) porDia.get(aviso.fechaProgramada)?.push(aviso)
  }

  const conTecnico = tecnicoId ? `&tecnico=${tecnicoId}` : ''
  const enlaceSemana = (dia: string) => `/agenda?semana=${dia}${conTecnico}`
  const enlaceMes = (dia: string) => `/agenda?vista=mes&mes=${dia.slice(0, 7)}${conTecnico}`

  // Al cambiar de vista se sigue mirando la misma época. Desde una semana se va a
  // su mes: el de hoy si la semana lo incluye y, si no, el del jueves, que es el de
  // la mayoría de sus días. Desde un mes se va a la semana de hoy si es el mes
  // actual y, si no, a la que contiene el día 1.
  const esEstaSemana = lunes === lunesDe(hoy)
  const esEsteMes = inicio === inicioDeMes(hoy)
  const hrefSemana = enlaceSemana(enMes ? (esEsteMes ? hoy : inicio) : lunes)
  const hrefMes = enlaceMes(enMes ? inicio : esEstaSemana ? hoy : sumarDias(lunes, 3))

  const visitas = enMes
    ? avisos.filter((aviso) => aviso.fechaProgramada?.startsWith(inicio.slice(0, 7))).length
    : avisos.length
  const periodo = enMes ? mesYAnio(inicio) : `Semana del ${fechaBreve(lunes)} al ${fechaBreve(dias[6])}`

  const paso = enMes
    ? {
        anterior: enlaceMes(sumarMeses(inicio, -1)),
        actual: enlaceMes(hoy),
        siguiente: enlaceMes(sumarMeses(inicio, 1)),
        esActual: esEsteMes,
        etiquetas: ['Mes anterior', 'Este mes', 'Mes siguiente'],
      }
    : {
        anterior: enlaceSemana(sumarDias(lunes, -7)),
        actual: enlaceSemana(hoy),
        siguiente: enlaceSemana(sumarDias(lunes, 7)),
        esActual: esEstaSemana,
        etiquetas: ['Semana anterior', 'Esta semana', 'Semana siguiente'],
      }

  return (
    <>
      <EncabezadoPagina
        titulo="Agenda"
        descripcion={`${periodo}: ${plural(visitas, 'visita', 'visitas')}`}
        acciones={
          <>
            {oficina && (
              <SelectorUrl
                parametro="tecnico"
                valor={tecnicoId ? String(tecnicoId) : ''}
                etiqueta="Filtrar por técnico"
                textoTodos="Todos los técnicos"
                opciones={tecnicos.map((item) => ({
                  valor: String(item.id),
                  etiqueta: `${item.nombre} ${item.apellidos ?? ''}`.trim(),
                }))}
                className="w-full min-w-48 sm:w-auto"
              />
            )}
            <div className="flex h-11 items-center rounded-full bg-white p-1 ring-1 ring-gris-200/70">
              <Link href={paso.anterior} aria-label={paso.etiquetas[0]} className={CLASES_FLECHA}>
                <ChevronLeft className="size-5" aria-hidden />
              </Link>
              <Link
                href={paso.actual}
                aria-current={paso.esActual ? 'date' : undefined}
                className={claseOpcion(paso.esActual)}
              >
                {paso.etiquetas[1]}
              </Link>
              <Link href={paso.siguiente} aria-label={paso.etiquetas[2]} className={CLASES_FLECHA}>
                <ChevronRight className="size-5" aria-hidden />
              </Link>
            </div>
            <nav
              aria-label="Vista de la agenda"
              className="flex h-11 items-center rounded-full bg-white p-1 ring-1 ring-gris-200/70"
            >
              <Link href={hrefSemana} aria-current={enMes ? undefined : 'page'} className={claseOpcion(!enMes)}>
                Semana
              </Link>
              <Link href={hrefMes} aria-current={enMes ? 'page' : undefined} className={claseOpcion(enMes)}>
                Mes
              </Link>
            </nav>
          </>
        }
      />

      {enMes ? (
        <VistaMes inicio={inicio} dias={dias} porDia={porDia} hoy={hoy} enlaceSemana={enlaceSemana} />
      ) : (
        <VistaSemana dias={dias} porDia={porDia} hoy={hoy} />
      )}

      {/* Trabajo sin fecha */}
      <div className="mt-5">
        <Seccion
          titulo="Sin programar"
          descripcion="Avisos abiertos que todavía no tienen día previsto"
          accion={
            oficina && sinProgramar.length > 0 ? (
              <BotonEnlace href="/avisos?vista=sin_asignar" variante="secundario" tamano="sm">
                Ver en el listado
              </BotonEnlace>
            ) : undefined
          }
          sinRelleno
        >
          {sinProgramar.length ? (
            <ul className="grid gap-2.5 p-4 sm:grid-cols-2 sm:p-5 lg:grid-cols-3">
              {sinProgramar.map((aviso) => (
                <li key={aviso.id}>
                  <Link
                    href={`/avisos/${aviso.id}`}
                    className="flex h-full items-start gap-3 rounded-tarjeta bg-gris-50 p-3.5 ring-1 ring-gris-200/70 ring-inset transition-colors hover:bg-white hover:ring-gris-300"
                  >
                    <span className="grid size-9 shrink-0 place-items-center rounded-[0.625rem] bg-white text-gris-700 ring-1 ring-gris-200/70">
                      <IconoCategoria categoria={aviso.categoria} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-[0.9375rem] font-medium text-gris-950">{aviso.titulo}</span>
                      <span className="mt-0.5 block truncate text-[0.8125rem] text-gris-500">
                        {aviso.clienteNombre}, {aviso.localNombre}
                      </span>
                      <span className="mt-2 flex flex-wrap gap-1.5">
                        <EstadoEtiqueta estado={aviso.estado} />
                        <PrioridadEtiqueta prioridad={aviso.prioridad} />
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          ) : (
            <EstadoVacio
              icono={Inbox}
              titulo="Todo el trabajo tiene fecha"
              texto="No queda ningún aviso abierto sin día previsto."
              className="py-9"
            />
          )}
        </Seccion>
      </div>

      {avisos.length === 0 && sinProgramar.length === 0 && (
        <Tarjeta className="mt-5">
          <EstadoVacio
            icono={CalendarDays}
            titulo={enMes ? 'No hay nada en este mes' : 'No hay nada en esta semana'}
            texto={
              oficina
                ? `Prueba con ${enMes ? 'otro mes' : 'otra semana'} o quita el filtro de técnico.`
                : `No tienes visitas ${enMes ? 'este mes' : 'esta semana'}. Prueba con ${enMes ? 'otro mes' : 'otra semana'}.`
            }
          />
        </Tarjeta>
      )}
    </>
  )
}

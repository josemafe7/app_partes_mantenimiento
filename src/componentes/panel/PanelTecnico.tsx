import { CircleCheck, Link2Off } from 'lucide-react'

import { ListaAvisosCompacta } from '@/componentes/avisos/ListaAvisos'
import { AgendaSemana } from '@/componentes/panel/AgendaSemana'
import { TarjetaContador } from '@/componentes/panel/TarjetaContador'
import { BotonEnlace } from '@/componentes/ui/Boton'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { CLASES_PANEL, Seccion, Tarjeta } from '@/componentes/ui/Tarjeta'
import { avisosProgramados } from '@/db/consultas/avisos'
import { contadoresPanel, listasPanel } from '@/db/consultas/panel'
import { hoyISO, lunesDe, mesYAnio, semanaDesde, sumarDias } from '@/lib/fechas'
import { enlaceAvisos } from '@/lib/filtros'
import { ambitoDe, type Usuario } from '@/lib/permisos'
import { cn, plural } from '@/lib/utils'

/**
 * Inicio del técnico: su jornada. Lo mismo que el panel de la oficina, pero solo
 * con sus avisos y sin lo que no le toca (sin asignar, carga de los demás).
 */
export async function PanelTecnico({ usuario }: { usuario: Usuario }) {
  const nombre = usuario.nombre.split(' ')[0]

  if (!usuario.tecnicoId) {
    return (
      <>
        <EncabezadoPagina titulo={`Hola, ${nombre}`} />
        <Tarjeta>
          <EstadoVacio
            icono={Link2Off}
            titulo="Tu usuario no está vinculado a tu ficha de técnico"
            texto="Hasta que no lo esté, no puedes ver avisos. Pide al administrador que lo vincule desde Usuarios."
          />
        </Tarjeta>
      </>
    )
  }

  const ambito = ambitoDe(usuario)
  const hoy = hoyISO()
  const dias = semanaDesde(lunesDe(hoy))
  const hasta = [dias[6], sumarDias(hoy, 7)].sort()[1]

  const [contadores, listas, visitas] = await Promise.all([
    contadoresPanel(ambito),
    listasPanel(ambito),
    avisosProgramados(dias[0], hasta, undefined, ambito),
  ])

  return (
    <>
      <EncabezadoPagina
        titulo={`Hola, ${nombre}`}
        descripcion={`${plural(contadores.paraHoy, 'visita prevista', 'visitas previstas')} para hoy y ${plural(contadores.abiertos, 'aviso abierto', 'avisos abiertos')} a tu nombre.`}
      />

      <section className={cn(CLASES_PANEL, 'overflow-hidden')}>
        <header className="px-5 pt-4.5 pb-4 sm:px-6">
          <h2 className="titular text-[1.0625rem] font-semibold text-gris-900">Tu trabajo</h2>
          <p className="mt-0.5 text-sm text-gris-500">Pulsa una cifra para ver esos avisos</p>
        </header>
        <div className="grid grid-cols-2 gap-px border-t border-gris-200/70 bg-gris-200/70 sm:grid-cols-4">
          <TarjetaContador
            etiqueta="Sin cerrar"
            valor={contadores.abiertos}
            href={enlaceAvisos({ vista: 'abiertos' })}
            punto="bg-marca-500"
            nota="todo lo tuyo abierto"
          />
          <TarjetaContador
            etiqueta="Para hoy"
            valor={contadores.paraHoy}
            href={enlaceAvisos({ vista: 'hoy' })}
            punto="bg-lavanda-500"
            nota="visitas previstas"
          />
          <TarjetaContador
            etiqueta="Retrasados"
            valor={contadores.retrasados}
            href={enlaceAvisos({ vista: 'retrasados' })}
            punto="bg-coral-500"
            nota="se pasó su fecha"
          />
          <TarjetaContador
            etiqueta="En espera"
            valor={contadores.enEspera}
            href={enlaceAvisos({ estado: 'en_espera' })}
            punto="bg-orquidea-500"
            nota="falta material o permiso"
          />
        </div>
      </section>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-2">
        <Seccion
          titulo="Para hoy"
          descripcion={listas.paraHoy.length ? 'Tus visitas de hoy' : undefined}
          sinRelleno
        >
          {listas.paraHoy.length ? (
            <ListaAvisosCompacta avisos={listas.paraHoy} />
          ) : (
            <EstadoVacio
              icono={CircleCheck}
              titulo="Nada previsto para hoy"
              texto="No tienes visitas programadas para hoy."
              className="py-9"
            />
          )}
        </Seccion>

        <Seccion
          titulo="Tu agenda"
          descripcion={mesYAnio(hoy)}
          accion={
            <BotonEnlace href="/agenda" variante="secundario" tamano="sm">
              Ver la semana
            </BotonEnlace>
          }
        >
          <AgendaSemana hoy={hoy} dias={dias} avisos={visitas} />
        </Seccion>

        {listas.retrasados.length > 0 && (
          <Seccion titulo="Retrasados" descripcion="Su fecha prevista ya ha pasado y siguen abiertos" sinRelleno>
            <ListaAvisosCompacta avisos={listas.retrasados} />
          </Seccion>
        )}

        {listas.enEspera.length > 0 && (
          <Seccion titulo="En espera" descripcion="Esperando material, presupuesto o acceso" sinRelleno>
            <ListaAvisosCompacta avisos={listas.enEspera} />
          </Seccion>
        )}
      </div>
    </>
  )
}

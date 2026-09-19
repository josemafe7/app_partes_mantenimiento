import { Wrench } from 'lucide-react'
import type { Metadata } from 'next'
import { notFound } from 'next/navigation'

import { BotonImprimir } from '@/componentes/partes/BotonImprimir'

import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { obtenerAviso } from '@/db/consultas/avisos'
import { CANAL, CATEGORIA, ESTADO, PRIORIDAD, totalHoras } from '@/lib/dominio'
import { fechaCorta, fechaHora, horasTexto, hoyISO } from '@/lib/fechas'
import { puedeVerAviso } from '@/lib/permisos'
import { exigirUsuario } from '@/lib/sesion'
import { plural } from '@/lib/utils'

export const metadata: Metadata = { title: 'Hoja del parte de trabajo' }

type Props = { params: Promise<{ id: string }> }

/** Campo de la cabecera de la hoja. */
function Celda({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div className="border border-gris-300 px-3 py-2">
      <p className="text-[11px] font-medium text-gris-500">{etiqueta}</p>
      <p className="mt-0.5 text-sm text-gris-900">{children}</p>
    </div>
  )
}

export default async function PaginaImprimirAviso({ params }: Props) {
  const usuario = await exigirUsuario()
  const { id } = await params
  const aviso = await obtenerAviso(Number(id))
  if (!aviso || !puedeVerAviso(usuario, aviso)) notFound()

  const horas = totalHoras(aviso.partes)

  return (
    <>
      <EncabezadoPagina
        titulo="Hoja del parte de trabajo"
        descripcion="Así se imprime o se guarda en PDF para entregar al cliente."
        volver={{ href: `/avisos/${aviso.id}`, etiqueta: 'Volver al aviso' }}
        acciones={<BotonImprimir />}
      />

      {/* Hoja A4 */}
      <article className="hoja-impresa mx-auto max-w-[210mm] rounded-panel bg-white p-6 text-gris-900 ring-1 ring-gris-200/70 sm:p-10">
        <header className="flex items-start justify-between gap-6 border-b-2 border-gris-900 pb-4">
          <div className="flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-control bg-marca-700 text-lima-300">
              <Wrench className="size-5" aria-hidden />
            </span>
            <div>
              <p className="text-lg font-semibold">Mantenimiento de locales</p>
              <p className="text-xs text-gris-500">Parte de trabajo · Documento interno</p>
            </div>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold tabular-nums">{aviso.referencia}</p>
            <p className="text-xs text-gris-500">Emitido el {fechaCorta(hoyISO())}</p>
          </div>
        </header>

        {/* Datos del cliente y del local */}
        <section className="mt-5">
          <h2 className="mb-2 text-[0.9375rem] font-semibold text-gris-900">Cliente y local</h2>
          <div className="grid grid-cols-2 gap-0">
            <Celda etiqueta="Cliente">{aviso.cliente.nombre}</Celda>
            <Celda etiqueta="CIF">{aviso.cliente.cif ?? '—'}</Celda>
            <Celda etiqueta="Local">{aviso.local.nombre}</Celda>
            <Celda etiqueta="Teléfono del local">{aviso.local.telefono ?? '—'}</Celda>
            <Celda etiqueta="Dirección">
              {aviso.local.direccion}, {aviso.local.codigoPostal} {aviso.local.ciudad}
              {aviso.local.provincia ? ` (${aviso.local.provincia})` : ''}
            </Celda>
            <Celda etiqueta="Persona de contacto">
              {aviso.contactoAviso ?? aviso.local.personaContacto ?? '—'}
            </Celda>
          </div>
        </section>

        {/* Datos del aviso */}
        <section className="mt-5">
          <h2 className="mb-2 text-[0.9375rem] font-semibold text-gris-900">El aviso</h2>
          <div className="grid grid-cols-4 gap-0">
            <Celda etiqueta="Recibido">{fechaHora(aviso.fechaAviso)}</Celda>
            <Celda etiqueta="Vía">{CANAL[aviso.canalEntrada].etiqueta}</Celda>
            <Celda etiqueta="Tipo">{CATEGORIA[aviso.categoria].etiqueta}</Celda>
            <Celda etiqueta="Prioridad">{PRIORIDAD[aviso.prioridad].etiqueta}</Celda>
            <Celda etiqueta="Estado">{ESTADO[aviso.estado].etiqueta}</Celda>
            <Celda etiqueta="Fecha prevista">
              {aviso.fechaProgramada ? fechaCorta(aviso.fechaProgramada) : '—'}
            </Celda>
            <Celda etiqueta="Técnico asignado">
              {aviso.tecnico ? `${aviso.tecnico.nombre} ${aviso.tecnico.apellidos ?? ''}` : 'Sin asignar'}
            </Celda>
            <Celda etiqueta="Cerrado">{aviso.fechaCierre ? fechaHora(aviso.fechaCierre) : '—'}</Celda>
          </div>

          <div className="mt-3 border border-gris-300 px-3 py-2">
            <p className="text-[11px] font-medium text-gris-500">
              Incidencia comunicada
            </p>
            <p className="mt-1 text-sm font-medium">{aviso.titulo}</p>
            {aviso.descripcion && (
              <p className="mt-1 text-sm whitespace-pre-line text-gris-700">{aviso.descripcion}</p>
            )}
          </div>
        </section>

        {/* Partes */}
        <section className="mt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <h2 className="text-[0.9375rem] font-semibold text-gris-900">
              Trabajos realizados
            </h2>
            <p className="text-sm text-gris-600">
              {plural(aviso.partes.length, 'visita', 'visitas')} · {horasTexto(horas)}
            </p>
          </div>

          {aviso.partes.length === 0 ? (
            <p className="border border-gris-300 px-3 py-6 text-center text-sm text-gris-500">
              Todavía no se ha anotado ningún trabajo para este aviso.
            </p>
          ) : (
            <div className="border border-gris-300">
              {[...aviso.partes]
                .sort((a, b) => a.fecha.localeCompare(b.fecha))
                .map((parte, indice) => (
                  <div
                    key={parte.id}
                    className={`bloque-entero px-3 py-3 ${indice > 0 ? 'border-t border-gris-300' : ''}`}
                  >
                    <div className="flex flex-wrap items-baseline justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {fechaCorta(parte.fecha)} · {parte.tecnico.nombre}{' '}
                        {parte.tecnico.apellidos ?? ''}
                      </p>
                      <p className="text-sm text-gris-600">{horasTexto(parte.horas)}</p>
                    </div>
                    <p className="mt-1 text-sm whitespace-pre-line text-gris-800">
                      {parte.trabajoRealizado}
                    </p>
                    {parte.materiales && (
                      <p className="mt-1 text-sm text-gris-600">
                        <span className="font-medium">Materiales:</span> {parte.materiales}
                      </p>
                    )}
                  </div>
                ))}
            </div>
          )}
        </section>

        {/* Cierre */}
        {aviso.resumenCierre && (
          <section className="mt-5">
            <h2 className="mb-2 text-[0.9375rem] font-semibold text-gris-900">
              Resolución
            </h2>
            <p className="border border-gris-300 px-3 py-2 text-sm whitespace-pre-line">
              {aviso.resumenCierre}
            </p>
          </section>
        )}

        {/* Firmas */}
        <section className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <p className="border-t border-gris-400 pt-2 text-xs text-gris-500">
              Firma del técnico
            </p>
          </div>
          <div>
            <p className="border-t border-gris-400 pt-2 text-xs text-gris-500">
              Firma y sello del cliente
            </p>
          </div>
        </section>

        <footer className="mt-6 border-t border-gris-200 pt-3 text-[10px] text-gris-400">
          Total de horas dedicadas: {horasTexto(horas)} · Referencia {aviso.referencia} · Documento
          generado desde la aplicación de avisos y partes.
        </footer>
      </article>
    </>
  )
}

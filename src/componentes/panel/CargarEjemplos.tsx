'use client'

import { Database } from 'lucide-react'
import { useActionState } from 'react'

import { cargarDatosEjemplo } from '@/acciones/datos'
import { Boton } from '@/componentes/ui/Boton'
import { ESTADO_INICIAL } from '@/lib/acciones'

/** Botón del estado vacío: llena la base de datos con los datos de ejemplo. */
export function CargarEjemplos() {
  const [resultado, cargar, cargando] = useActionState(cargarDatosEjemplo, ESTADO_INICIAL)

  if (resultado.ok && resultado.mensaje) {
    return <p className="text-sm font-medium text-menta-700">{resultado.mensaje}</p>
  }

  return (
    <form action={cargar} className="flex flex-col items-center gap-3">
      <Boton type="submit" tamano="lg" disabled={cargando}>
        <Database className="size-4.5" aria-hidden />
        {cargando ? 'Cargando datos…' : 'Cargar datos de ejemplo'}
      </Boton>
      {resultado.mensaje && !resultado.ok && (
        <p role="alert" className="text-sm font-medium text-coral-700">
          {resultado.mensaje}
        </p>
      )}
    </form>
  )
}

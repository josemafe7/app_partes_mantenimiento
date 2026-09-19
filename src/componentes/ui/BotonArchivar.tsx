'use client'

import { Archive, ArchiveRestore } from 'lucide-react'
import { useFormStatus } from 'react-dom'

import { Boton } from './Boton'

type Props = {
  accion: (formData: FormData) => Promise<void>
  id: number
  archivado: boolean
  /** Qué se archiva, para el texto del botón: «cliente», «local», «técnico». */
  que: string
}

function BotonEnvio({ archivado, que }: { archivado: boolean; que: string }) {
  const { pending } = useFormStatus()
  const Icono = archivado ? ArchiveRestore : Archive

  return (
    <Boton type="submit" variante="secundario" disabled={pending}>
      <Icono className="size-4.5" aria-hidden />
      {pending ? 'Guardando…' : archivado ? `Reactivar ${que}` : `Archivar ${que}`}
    </Boton>
  )
}

/** Archiva o reactiva un registro sin salir de la página. */
export function BotonArchivar({ accion, id, archivado, que }: Props) {
  return (
    <form action={accion}>
      <input type="hidden" name="id" value={id} />
      <BotonEnvio archivado={archivado} que={que} />
    </form>
  )
}

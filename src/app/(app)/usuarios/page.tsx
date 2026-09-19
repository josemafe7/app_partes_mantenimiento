import { Plus } from 'lucide-react'
import type { Metadata } from 'next'
import Link from 'next/link'

import { BotonEnlace } from '@/componentes/ui/Boton'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { Etiqueta } from '@/componentes/ui/Etiqueta'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { listarUsuarios } from '@/db/consultas/usuarios'
import { ROL } from '@/lib/dominio'
import { haceTiempo } from '@/lib/fechas'
import { exigirPermiso } from '@/lib/sesion'
import { cn, iniciales, plural } from '@/lib/utils'

export const metadata: Metadata = { title: 'Usuarios' }

export default async function PaginaUsuarios() {
  const yo = await exigirPermiso('gestionarUsuarios')
  const usuarios = await listarUsuarios()
  const activos = usuarios.filter((usuario) => usuario.activo).length

  return (
    <>
      <EncabezadoPagina
        titulo="Usuarios"
        descripcion={`${plural(activos, 'usuario activo', 'usuarios activos')}. Cada uno entra con su email y su contraseña.`}
        acciones={
          <BotonEnlace href="/usuarios/nuevo">
            <Plus className="size-4.5" aria-hidden />
            Nuevo usuario
          </BotonEnlace>
        }
      />

      <Tarjeta className="overflow-hidden">
        <ul className="divide-y divide-gris-200/70">
          {usuarios.map((usuario) => (
            <li key={usuario.id}>
              <Link
                href={`/usuarios/${usuario.id}`}
                className={cn(
                  'flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4 transition-colors hover:bg-gris-50 sm:px-6',
                  !usuario.activo && 'bg-gris-50/60',
                )}
              >
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-full text-xs font-semibold',
                    usuario.activo ? 'bg-lima-300 text-gris-950' : 'bg-gris-200 text-gris-600',
                  )}
                  aria-hidden
                >
                  {iniciales(usuario.nombre)}
                </span>

                <span className="min-w-0 flex-1 basis-48">
                  <span className="flex flex-wrap items-center gap-2 font-medium text-gris-950">
                    {usuario.nombre}
                    {usuario.id === yo.id && <span className="text-sm font-normal text-gris-500">(tú)</span>}
                  </span>
                  <span className="block truncate text-sm text-gris-500">{usuario.email}</span>
                </span>

                <span className="flex flex-wrap items-center gap-1.5">
                  <Etiqueta
                    clases={
                      usuario.rol === 'administrador'
                        ? 'bg-marca-50 text-marca-800 ring-marca-200'
                        : 'bg-white text-gris-700 ring-gris-200'
                    }
                  >
                    {ROL[usuario.rol].etiqueta}
                    {usuario.rol === 'tecnico' &&
                      (usuario.tecnicoNombre ? `: ${usuario.tecnicoNombre} ${usuario.tecnicoApellidos ?? ''}`.trimEnd() : '')}
                  </Etiqueta>
                  {usuario.rol === 'tecnico' && !usuario.tecnicoId && (
                    <Etiqueta clases="bg-coral-50 text-coral-700 ring-coral-200">Sin ficha vinculada</Etiqueta>
                  )}
                  {!usuario.activo && (
                    <Etiqueta clases="bg-gris-200/70 text-gris-600 ring-gris-300">Desactivado</Etiqueta>
                  )}
                  {usuario.activo && usuario.debeCambiarContrasena && (
                    <Etiqueta
                      clases="bg-mantequilla-100 text-mantequilla-800 ring-mantequilla-300"
                      titulo="Tiene una contraseña temporal y aún no ha elegido la suya"
                    >
                      Contraseña temporal
                    </Etiqueta>
                  )}
                </span>

                <span className="w-full text-[0.8125rem] text-gris-500 sm:w-36 sm:text-right">
                  {usuario.ultimoAcceso ? `Entró ${haceTiempo(usuario.ultimoAcceso)}` : 'Aún no ha entrado'}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </Tarjeta>
    </>
  )
}

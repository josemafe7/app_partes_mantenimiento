import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'

import { actualizarUsuario } from '@/acciones/usuarios'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { Dato, ListaDatos, Seccion } from '@/componentes/ui/Tarjeta'
import { AccesoUsuario } from '@/componentes/usuarios/AccesoUsuario'
import { FormularioUsuario } from '@/componentes/usuarios/FormularioUsuario'
import { obtenerUsuario, tecnicosParaVincular } from '@/db/consultas/usuarios'
import { fechaHora } from '@/lib/fechas'
import { exigirPermiso } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Usuario' }

type Props = { params: Promise<{ id: string }> }

export default async function PaginaUsuario({ params }: Props) {
  const yo = await exigirPermiso('gestionarUsuarios')
  const { id } = await params
  const usuario = await obtenerUsuario(id)
  if (!usuario) notFound()

  const tecnicos = await tecnicosParaVincular(usuario.id)
  const esUnoMismo = usuario.id === yo.id

  return (
    <>
      <EncabezadoPagina
        titulo={usuario.nombre}
        descripcion={usuario.activo ? usuario.email : `${usuario.email} · desactivado`}
        volver={{ href: '/usuarios', etiqueta: 'Usuarios' }}
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <FormularioUsuario
          accion={actualizarUsuario}
          usuario={{
            id: usuario.id,
            nombre: usuario.nombre,
            email: usuario.email,
            rol: usuario.rol,
            tecnicoId: usuario.tecnicoId,
          }}
          tecnicos={tecnicos}
          esUnoMismo={esUnoMismo}
        />

        <aside className="flex flex-col gap-5">
          <Seccion titulo="Acceso">
            {esUnoMismo ? (
              <p className="text-sm leading-relaxed text-gris-600">
                Tu contraseña la cambias tú desde{' '}
                <Link href="/cuenta" className="font-medium text-marca-700 underline underline-offset-2">
                  Mi cuenta
                </Link>
                . Tampoco puedes desactivar tu propio usuario.
              </p>
            ) : (
              <AccesoUsuario id={usuario.id} nombre={usuario.nombre} activo={usuario.activo} />
            )}
          </Seccion>

          <Seccion titulo="Actividad">
            <ListaDatos className="sm:grid-cols-1">
              <Dato etiqueta="Último acceso">
                {usuario.ultimoAcceso ? fechaHora(usuario.ultimoAcceso) : 'Aún no ha entrado'}
              </Dato>
              <Dato etiqueta="Contraseña">
                {usuario.debeCambiarContrasena ? 'Temporal: la cambiará al entrar' : 'Elegida por el usuario'}
              </Dato>
              <Dato etiqueta="Usuario desde">{fechaHora(usuario.creadoEn)}</Dato>
            </ListaDatos>
          </Seccion>
        </aside>
      </div>
    </>
  )
}

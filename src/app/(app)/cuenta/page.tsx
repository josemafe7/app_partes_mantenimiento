import { LogOut, UserCog } from 'lucide-react'
import type { Metadata } from 'next'

import { cerrarSesion } from '@/acciones/sesion'
import { FormularioContrasena } from '@/componentes/acceso/FormularioContrasena'
import { Boton, BotonEnlace } from '@/componentes/ui/Boton'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { Dato, ListaDatos, Seccion } from '@/componentes/ui/Tarjeta'
import { obtenerTecnico } from '@/db/consultas/tecnicos'
import { ROL } from '@/lib/dominio'
import { puede } from '@/lib/permisos'
import { exigirUsuario } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Mi cuenta' }

export default async function PaginaCuenta() {
  const usuario = await exigirUsuario()
  const tecnico = usuario.tecnicoId ? await obtenerTecnico(usuario.tecnicoId) : null

  return (
    <>
      <EncabezadoPagina
        titulo="Mi cuenta"
        descripcion="Tus datos de acceso y tu contraseña."
        acciones={
          <form action={cerrarSesion}>
            <Boton type="submit" variante="secundario">
              <LogOut className="size-4.5" aria-hidden />
              Cerrar sesión
            </Boton>
          </form>
        }
      />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
        <Seccion titulo="Tus datos">
          <ListaDatos className="sm:grid-cols-1">
            <Dato etiqueta="Nombre">{usuario.nombre}</Dato>
            <Dato etiqueta="Email">{usuario.email}</Dato>
            <Dato etiqueta="Rol">
              {ROL[usuario.rol].etiqueta}
              <span className="mt-0.5 block text-sm text-gris-500">{ROL[usuario.rol].descripcion}</span>
            </Dato>
            {usuario.rol === 'tecnico' && (
              <Dato etiqueta="Ficha de técnico">
                {tecnico ? (
                  `${tecnico.nombre} ${tecnico.apellidos ?? ''}`.trim()
                ) : (
                  <span className="text-coral-700">
                    Sin vincular: no verás ningún aviso hasta que el administrador te vincule a tu ficha.
                  </span>
                )}
              </Dato>
            )}
          </ListaDatos>

          {puede(usuario, 'gestionarUsuarios') && (
            <BotonEnlace href="/usuarios" variante="suave" className="mt-5">
              <UserCog className="size-4.5" aria-hidden />
              Gestionar los usuarios
            </BotonEnlace>
          )}
        </Seccion>

        <Seccion
          titulo="Cambiar la contraseña"
          descripcion="Al cambiarla se cierran tus sesiones en otros dispositivos."
        >
          <FormularioContrasena temporal={false} email={usuario.email} />
        </Seccion>
      </div>
    </>
  )
}

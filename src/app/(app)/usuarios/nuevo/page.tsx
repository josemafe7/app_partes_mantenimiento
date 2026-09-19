import type { Metadata } from 'next'

import { crearUsuario } from '@/acciones/usuarios'
import { EncabezadoPagina } from '@/componentes/ui/EncabezadoPagina'
import { FormularioUsuario } from '@/componentes/usuarios/FormularioUsuario'
import { tecnicosParaVincular } from '@/db/consultas/usuarios'
import { exigirPermiso } from '@/lib/sesion'

export const metadata: Metadata = { title: 'Nuevo usuario' }

export default async function PaginaNuevoUsuario() {
  await exigirPermiso('gestionarUsuarios')
  const tecnicos = await tecnicosParaVincular()

  return (
    <>
      <EncabezadoPagina
        titulo="Nuevo usuario"
        descripcion="Se crea con una contraseña temporal que le darás tú. Al entrar, elegirá la suya."
        volver={{ href: '/usuarios', etiqueta: 'Usuarios' }}
      />
      <FormularioUsuario accion={crearUsuario} tecnicos={tecnicos} />
    </>
  )
}

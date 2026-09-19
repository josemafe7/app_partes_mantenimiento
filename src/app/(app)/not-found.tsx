import { FileQuestion } from 'lucide-react'

import { BotonEnlace } from '@/componentes/ui/Boton'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

/**
 * También es la respuesta a lo que el usuario no tiene permiso para ver (ver
 * `exigirPermiso` en src/lib/sesion.ts): no hace falta contarle qué hay detrás.
 */
export default function NoEncontrado() {
  return (
    <Tarjeta className="mt-6">
      <EstadoVacio
        icono={FileQuestion}
        titulo="Esta página no existe"
        texto="Puede que el registro se haya eliminado, que la dirección esté mal escrita o que tu usuario no tenga acceso a ella."
        accion={<BotonEnlace href="/">Volver al panel</BotonEnlace>}
      />
    </Tarjeta>
  )
}

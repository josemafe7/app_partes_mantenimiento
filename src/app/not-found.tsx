import { FileQuestion } from 'lucide-react'

import { BotonEnlace } from '@/componentes/ui/Boton'
import { EstadoVacio } from '@/componentes/ui/EstadoVacio'
import { Tarjeta } from '@/componentes/ui/Tarjeta'

/** Dirección que no existe. Se pinta sin la navegación, que es del layout de la aplicación. */
export default function NoEncontrado() {
  return (
    <main className="mx-auto w-full max-w-xl px-4 py-10">
      <Tarjeta>
        <EstadoVacio
          icono={FileQuestion}
          titulo="Esta página no existe"
          texto="Puede que el registro se haya eliminado o que la dirección esté mal escrita."
          accion={<BotonEnlace href="/">Volver al panel</BotonEnlace>}
        />
      </Tarjeta>
    </main>
  )
}

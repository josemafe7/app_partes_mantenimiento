import { BarraInferior, BarraLateral, BarraSuperior, CabeceraMovil } from '@/componentes/navegacion/Navegacion'
import { fechaLarga, hoyISO } from '@/lib/fechas'
import { exigirUsuario } from '@/lib/sesion'

/**
 * Layout de la aplicación: todo lo que hay detrás del inicio de sesión.
 *
 * Pide el usuario para pintar su menú (cada rol ve sus secciones). No sustituye
 * a la comprobación de cada página: al navegar entre páginas Next no vuelve a
 * ejecutar el layout, así que cada página llama a `exigirUsuario` o
 * `exigirPermiso` por su cuenta.
 */
export default async function LayoutAplicacion({ children }: { children: React.ReactNode }) {
  const usuario = await exigirUsuario()

  return (
    <>
      <div className="lg:grid lg:grid-cols-[17rem_minmax(0,1fr)]">
        <BarraLateral usuario={usuario} />
        <div className="flex min-h-dvh min-w-0 flex-col">
          <CabeceraMovil usuario={usuario} />
          <BarraSuperior hoy={fechaLarga(hoyISO())} />
          <main className="mx-auto w-full max-w-[78rem] flex-1 px-4 pt-3 pb-28 sm:px-6 lg:px-8 lg:pt-3 lg:pb-12">
            {children}
          </main>
        </div>
      </div>
      <BarraInferior usuario={usuario} />
    </>
  )
}

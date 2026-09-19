import { Marca } from '@/componentes/navegacion/Navegacion'

/** Pantallas de acceso (login y primera contraseña): un panel centrado, sin menú. */
export default function LayoutAcceso({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3">
          <Marca />
          <span className="leading-tight">
            <span className="titular block text-[1.0625rem] font-semibold text-gris-950">Avisos y partes</span>
            <span className="block text-[0.8125rem] text-gris-500">Mantenimiento de locales</span>
          </span>
        </div>
        {children}
      </div>
    </main>
  )
}

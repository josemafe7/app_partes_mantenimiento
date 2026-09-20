import type { Metadata, Viewport } from 'next'
import { Instrument_Sans } from 'next/font/google'

import './globals.css'

/*
 * Instrument Sans para todo. Se carga con su eje de anchura para poder
 * estrechar las cifras grandes (clase .cifra) sin traer otra familia.
 */
const fuente = Instrument_Sans({
  subsets: ['latin', 'latin-ext'],
  axes: ['wdth'],
  variable: '--fuente-app',
  display: 'swap',
})

export const metadata: Metadata = {
  title: {
    default: 'Avisos y partes de trabajo',
    template: '%s · Avisos y partes',
  },
  description:
    'Gestión de avisos, técnicos y partes de trabajo para una empresa de mantenimiento de locales.',
  // Es una aplicación privada: la única pantalla que ve un buscador es el login,
  // y no hace falta que salga en Google (también va en la cabecera X-Robots-Tag).
  robots: { index: false, follow: false },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#eaeee6',
}

/**
 * Todas las pantallas leen la base de datos en cada visita: no hay nada que
 * tenga sentido cachear ni generar en el momento de compilar. Además, una
 * respuesta cacheada podría llevar la cookie de sesión de otra persona.
 */
export const dynamic = 'force-dynamic'

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // La variable de la fuente va en <html> y no en <body>: el tema la lee
    // desde la raíz (--font-sans), y en <body> quedaría fuera de su alcance.
    <html lang="es" className={fuente.variable}>
      {/* La navegación va en el layout de la aplicación, (app)/layout.tsx: el login no la lleva. */}
      {/*
       * `suppressHydrationWarning` por las extensiones del navegador, que
       * marcan el <body> antes de que React hidrate (`data-atm-ext-installed`,
       * las de contraseñas, las de temas…). El servidor manda un <body> sin ese
       * atributo, React encuentra otro y avisa de un desajuste que no es de la
       * aplicación y que aquí nadie puede arreglar. Solo calla el aviso de este
       * elemento, no el de sus hijos: un desajuste de verdad dentro de la
       * aplicación se sigue viendo. No se pone en <html> a propósito, que es
       * donde va la variable de la fuente y donde sí interesa enterarse.
       */}
      <body className="antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  )
}

import { fileURLToPath } from 'node:url'

import type { NextConfig } from 'next'

/**
 * Cabeceras de seguridad de todas las respuestas. La política de contenido
 * (CSP) no va aquí sino en src/proxy.ts, porque lleva un nonce distinto en cada
 * petición.
 */
const CABECERAS_DE_SEGURIDAD = [
  // Que el navegador no adivine el tipo de un archivo (no ejecutar texto como script).
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  // Para navegadores antiguos que no entienden frame-ancestors de la CSP.
  { key: 'X-Frame-Options', value: 'DENY' },
  // Las direcciones internas (con ids de avisos) no se cuentan a otras webs.
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  // La aplicación no usa cámara, micrófono ni ubicación.
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), browsing-topics=()' },
  // Una vez visitada por HTTPS, el navegador ya no usa HTTP (se ignora en local).
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  // Una ventana abierta desde otra web (o hacia otra) no comparte nada con esta.
  { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
  // Aplicación privada: que los buscadores no guarden ni el login.
  { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
]

const nextConfig: NextConfig = {
  // No anunciar con qué está hecha la aplicación.
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:ruta*', headers: CABECERAS_DE_SEGURIDAD }]
  },
  turbopack: {
    // Esta carpeta es la raíz del proyecto; sin esto Next mira hacia arriba
    // buscando lock files y puede acabar en el directorio del usuario.
    root: fileURLToPath(new URL('.', import.meta.url)),
  },
}

export default nextConfig

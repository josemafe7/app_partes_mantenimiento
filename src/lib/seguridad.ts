/**
 * Política de seguridad de contenido (CSP) de las páginas.
 *
 * Le dice al navegador de dónde puede cargar cada cosa. Lo importante:
 * - scripts: solo los de la propia aplicación que lleven el `nonce` de esa
 *   petición (Next se lo pone a los suyos). Un script inyectado no lo tendría y
 *   el navegador no lo ejecutaría.
 * - `frame-ancestors 'none'`: ninguna otra web puede meter la aplicación en un
 *   marco (así no se puede engañar a nadie para que pulse botones sin verlos).
 * - `form-action 'self'`: los formularios solo se envían a la propia aplicación.
 *
 * Los estilos admiten `unsafe-inline` porque varios componentes usan atributos
 * `style` (las barras del gráfico, el arrastre del tablero) y el nonce no sirve
 * para atributos. En desarrollo React necesita `unsafe-eval` para sus avisos.
 */
export function politicaDeContenido(nonce: string): string {
  const desarrollo = process.env.NODE_ENV === 'development'
  return [
    `default-src 'self'`,
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${desarrollo ? ` 'unsafe-eval'` : ''}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' blob: data:`,
    `font-src 'self'`,
    `connect-src 'self'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
  ].join('; ')
}

/** Un valor al azar distinto en cada petición para el `nonce` de la CSP. */
export function nuevoNonce(): string {
  return btoa(crypto.randomUUID())
}

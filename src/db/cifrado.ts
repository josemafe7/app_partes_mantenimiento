/**
 * La conexión con la base va siempre cifrada (TLS).
 *
 * postgres.js no cifra si no se le pide, y el pooler de Supabase acepta también
 * conexiones sin cifrar: sin esto, los datos de los clientes viajaban en claro
 * entre la aplicación y la base (comprobado el 20-09-2026). Lo usan la conexión
 * de la aplicación (`cliente.ts`) y los scripts que abren la suya.
 *
 * Si la cadena ya trae su `sslmode` (por ejemplo `verify-full`) se respeta: en
 * postgres.js la opción del código manda sobre la de la URL, y la rebajaría.
 *
 * Va en un archivo aparte, sin efectos, para poder importarlo sin abrir la
 * conexión de la aplicación.
 */
export function cifrado(url: string): { ssl?: 'require' } {
  try {
    if (new URL(url).searchParams.has('sslmode')) return {}
  } catch {
    // Una cadena que no se entiende ya falla al conectar, con su propio aviso.
  }
  return { ssl: 'require' }
}

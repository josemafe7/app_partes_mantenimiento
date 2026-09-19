import 'server-only'

/**
 * ¿Aparece esta contraseña en filtraciones de datos conocidas?
 *
 * Se consulta el servicio público Pwned Passwords sin enviarle la contraseña:
 * se calcula su huella SHA-1 y solo viajan los 5 primeros caracteres. El
 * servicio devuelve todas las huellas que empiezan igual (cientos, con relleno
 * para que ni siquiera el tamaño de la respuesta diga nada) y la comparación
 * se hace aquí (técnica de k-anonimato).
 *
 * Si el servicio no responde en unos segundos, no se bloquea a nadie: la
 * contraseña ya ha pasado las reglas de longitud y variedad.
 */
export async function contrasenaFiltrada(contrasena: string): Promise<boolean> {
  try {
    const huella = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(contrasena))
    const hexadecimal = Array.from(new Uint8Array(huella), (byte) => byte.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
    const prefijo = hexadecimal.slice(0, 5)
    const resto = hexadecimal.slice(5)

    const respuesta = await fetch(`https://api.pwnedpasswords.com/range/${prefijo}`, {
      headers: { 'Add-Padding': 'true' },
      signal: AbortSignal.timeout(3000),
      cache: 'no-store',
    })
    if (!respuesta.ok) return false

    const lineas = (await respuesta.text()).split('\n')
    return lineas.some((linea) => {
      const [sufijo, veces] = linea.trim().split(':')
      return sufijo === resto && Number(veces) > 0
    })
  } catch {
    return false
  }
}

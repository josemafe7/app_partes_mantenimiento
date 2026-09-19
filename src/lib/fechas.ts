/**
 * Fechas en español, sin sorpresas de zona horaria.
 *
 * Las fechas "de calendario" (fecha programada de un aviso, fecha de un parte)
 * se guardan como texto `YYYY-MM-DD`: es lo que devuelve un <input type="date">,
 * se ordena y se compara alfabéticamente, y nunca se desplaza un día por el UTC.
 * Las marcas de tiempo (aviso recibido, cierre, creación) sí son fechas reales.
 */

import { format, formatDistanceToNowStrict, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'

/** Fecha de calendario en formato `YYYY-MM-DD`. */
export type FechaISO = string

/** Hoy, en hora local, como `YYYY-MM-DD`. */
export function hoyISO(): FechaISO {
  return aISO(new Date())
}

/** Convierte un Date a `YYYY-MM-DD` usando sus componentes locales. */
export function aISO(fecha: Date): FechaISO {
  const mes = String(fecha.getMonth() + 1).padStart(2, '0')
  const dia = String(fecha.getDate()).padStart(2, '0')
  return `${fecha.getFullYear()}-${mes}-${dia}`
}

/** Interpreta `YYYY-MM-DD` como mediodía local (evita saltos de día). */
export function desdeISO(iso: FechaISO): Date {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia, 12, 0, 0, 0)
}

/** El instante en que empieza el día `YYYY-MM-DD` (medianoche local). */
export function inicioDelDia(iso: FechaISO): Date {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return new Date(anio, mes - 1, dia, 0, 0, 0, 0)
}

/** Suma (o resta, con negativos) días a una fecha `YYYY-MM-DD`. */
export function sumarDias(iso: FechaISO, dias: number): FechaISO {
  const fecha = desdeISO(iso)
  fecha.setDate(fecha.getDate() + dias)
  return aISO(fecha)
}

/** Lunes de la semana a la que pertenece la fecha. */
export function lunesDe(iso: FechaISO): FechaISO {
  const fecha = desdeISO(iso)
  const dia = fecha.getDay() // 0 = domingo
  const desplazamiento = dia === 0 ? -6 : 1 - dia
  return sumarDias(iso, desplazamiento)
}

/** Los siete días de la semana que empieza en `lunes`. */
export function semanaDesde(lunes: FechaISO): FechaISO[] {
  return Array.from({ length: 7 }, (_, i) => sumarDias(lunes, i))
}

/** Día 1 del mes al que pertenece la fecha. */
export function inicioDeMes(iso: FechaISO): FechaISO {
  return `${iso.slice(0, 7)}-01`
}

/** Día 1 del mes que queda `meses` meses antes (con negativos) o después. */
export function sumarMeses(iso: FechaISO, meses: number): FechaISO {
  // Desde el día 1 no hay desbordes: el 31 de enero más un mes no salta a marzo.
  const fecha = desdeISO(inicioDeMes(iso))
  fecha.setMonth(fecha.getMonth() + meses)
  return aISO(fecha)
}

/**
 * Los días que pinta el calendario de un mes: semanas completas de lunes a
 * domingo, desde la que contiene el día 1 hasta la que contiene el último.
 */
export function cuadriculaMes(iso: FechaISO): FechaISO[] {
  const ultimoDia = sumarDias(sumarMeses(iso, 1), -1)
  const domingo = sumarDias(lunesDe(ultimoDia), 6)
  const dias: FechaISO[] = []
  for (let dia = lunesDe(inicioDeMes(iso)); dia <= domingo; dia = sumarDias(dia, 1)) dias.push(dia)
  return dias
}

/* ------------------------------------------------------------- Presentación */

/** `12/09/2026` */
export function fechaCorta(iso: FechaISO | null | undefined): string {
  if (!iso) return '—'
  return format(desdeISO(iso), 'dd/MM/yyyy')
}

/** `8 sept`: para ejes y cabeceras donde el año sobra. */
export function fechaBreve(iso: FechaISO): string {
  return format(desdeISO(iso), 'd MMM', { locale: es }).replace('.', '')
}

/** `Septiembre de 2026` */
export function mesYAnio(iso: FechaISO): string {
  const texto = format(desdeISO(iso), "MMMM 'de' yyyy", { locale: es })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** `Sábado 12 de septiembre` */
export function fechaLarga(iso: FechaISO): string {
  const texto = format(desdeISO(iso), "EEEE d 'de' MMMM", { locale: es })
  return texto.charAt(0).toUpperCase() + texto.slice(1)
}

/** `12/09/2026 09:40` */
export function fechaHora(fecha: Date | null | undefined): string {
  if (!fecha) return '—'
  return format(fecha, "dd/MM/yyyy HH:mm")
}

/** `hace 3 días` */
export function haceTiempo(fecha: Date | null | undefined): string {
  if (!fecha) return '—'
  return `hace ${formatDistanceToNowStrict(fecha, { locale: es })}`
}

/** `Hoy`, `Mañana`, `Ayer` o la fecha corta. */
export function fechaRelativa(iso: FechaISO | null | undefined): string {
  if (!iso) return 'Sin fecha'
  const hoy = hoyISO()
  if (iso === hoy) return 'Hoy'
  if (iso === sumarDias(hoy, 1)) return 'Mañana'
  if (iso === sumarDias(hoy, -1)) return 'Ayer'
  return fechaCorta(iso)
}

/** Días de retraso respecto a hoy (0 si aún no ha llegado la fecha). */
export function diasDeRetraso(iso: FechaISO | null | undefined): number {
  if (!iso) return 0
  const diferencia = desdeISO(hoyISO()).getTime() - desdeISO(iso).getTime()
  const dias = Math.round(diferencia / 86_400_000)
  return dias > 0 ? dias : 0
}

/** `2 h`, `2,5 h` */
export function horasTexto(horas: number): string {
  const formateado = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 2 }).format(horas)
  return `${formateado} h`
}

/** Valida que un texto sea una fecha `YYYY-MM-DD` real. */
export function esFechaISO(valor: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(valor)) return false
  const fecha = parseISO(valor)
  return !Number.isNaN(fecha.getTime()) && aISO(fecha) === valor
}

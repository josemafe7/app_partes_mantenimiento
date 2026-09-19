/**
 * Vocabulario del negocio: estados, prioridades, categorías y canales.
 *
 * Todo lo que el usuario lee en pantalla sobre estas listas (etiquetas, colores,
 * orden) sale de aquí. Si hay que añadir un estado o cambiar un color, se toca
 * este archivo y no las pantallas.
 */

/* ------------------------------------------------------------------ Estados */

export const ESTADOS = [
  'pendiente',
  'asignado',
  'en_curso',
  'en_espera',
  'finalizado',
  'cancelado',
] as const

export type Estado = (typeof ESTADOS)[number]

type InfoEstado = {
  etiqueta: string
  descripcion: string
  /** Clases de la etiqueta de color (badge). */
  clases: string
  /** Color del punto/indicador: cronología, tablero, cambio de estado. */
  punto: string
  /**
   * Tarjeta pastel de la agenda y el tablero. Cada estado tiene su color, como
   * los imanes de un tablero de planificación, pero la tarjeta lleva siempre
   * también su etiqueta: el color ayuda a ubicarse, no es la única pista.
   */
  tarjeta: string
}

export const ESTADO: Record<Estado, InfoEstado> = {
  pendiente: {
    etiqueta: 'Pendiente',
    descripcion: 'Aviso recibido, todavía sin técnico asignado',
    clases: 'bg-mantequilla-100 text-mantequilla-800 ring-mantequilla-300',
    punto: 'bg-mantequilla-500',
    tarjeta: 'bg-mantequilla-100 ring-mantequilla-200 hover:ring-mantequilla-300',
  },
  asignado: {
    etiqueta: 'Asignado',
    descripcion: 'Tiene técnico asignado pero aún no ha empezado',
    clases: 'bg-pervinca-100 text-pervinca-800 ring-pervinca-300',
    punto: 'bg-pervinca-500',
    tarjeta: 'bg-pervinca-100 ring-pervinca-200 hover:ring-pervinca-300',
  },
  en_curso: {
    etiqueta: 'En curso',
    descripcion: 'El técnico ya está trabajando en el aviso',
    clases: 'bg-lima-100 text-lima-800 ring-lima-300',
    punto: 'bg-lima-500',
    tarjeta: 'bg-lima-100 ring-lima-200 hover:ring-lima-400',
  },
  en_espera: {
    etiqueta: 'En espera',
    descripcion: 'Parado por falta de material, de presupuesto o de acceso al local',
    clases: 'bg-orquidea-100 text-orquidea-800 ring-orquidea-300',
    punto: 'bg-orquidea-500',
    tarjeta: 'bg-orquidea-100 ring-orquidea-200 hover:ring-orquidea-300',
  },
  finalizado: {
    etiqueta: 'Finalizado',
    descripcion: 'Trabajo terminado y cerrado',
    clases: 'bg-menta-100 text-menta-800 ring-menta-300',
    punto: 'bg-menta-500',
    tarjeta: 'bg-menta-100 ring-menta-200 hover:ring-menta-300',
  },
  cancelado: {
    etiqueta: 'Cancelado',
    descripcion: 'Anulado sin llegar a realizarse',
    clases: 'bg-gris-100 text-gris-600 ring-gris-300',
    punto: 'bg-gris-400',
    tarjeta: 'bg-gris-100 ring-gris-200 hover:ring-gris-300',
  },
}

/** Estados que dan el trabajo por terminado: no cuentan como pendiente. */
export const ESTADOS_FINALES: Estado[] = ['finalizado', 'cancelado']

/** Estados que siguen vivos, en el orden en que avanza el trabajo. */
export const ESTADOS_ABIERTOS: Estado[] = ['pendiente', 'asignado', 'en_curso', 'en_espera']

export function esEstadoFinal(estado: Estado): boolean {
  return ESTADOS_FINALES.includes(estado)
}

export function esEstado(valor: unknown): valor is Estado {
  return typeof valor === 'string' && (ESTADOS as readonly string[]).includes(valor)
}

/** Motivo obligatorio al aparcar un aviso. */
export function requiereMotivoEspera(estado: Estado): boolean {
  return estado === 'en_espera'
}

/** Resumen obligatorio al cerrar un aviso. */
export function requiereResumenCierre(estado: Estado): boolean {
  return estado === 'finalizado'
}

/* --------------------------------------------------------------- Prioridad */

export const PRIORIDADES = ['baja', 'normal', 'alta', 'urgente'] as const
export type Prioridad = (typeof PRIORIDADES)[number]

/*
 * La prioridad va en la escala de «atención»: gris lo tranquilo y coral lo que
 * aprieta. Urgente es la única etiqueta rellena de color en toda la aplicación,
 * para que se vea de lejos.
 */
export const PRIORIDAD: Record<Prioridad, { etiqueta: string; clases: string; punto: string; peso: number }> = {
  baja: { etiqueta: 'Baja', clases: 'bg-gris-100 text-gris-600 ring-gris-200', punto: 'bg-gris-400', peso: 0 },
  normal: { etiqueta: 'Normal', clases: 'bg-white text-gris-700 ring-gris-200', punto: 'bg-gris-500', peso: 1 },
  alta: { etiqueta: 'Alta', clases: 'bg-coral-50 text-coral-700 ring-coral-200', punto: 'bg-coral-400', peso: 2 },
  urgente: { etiqueta: 'Urgente', clases: 'bg-coral-400 text-gris-950 ring-coral-400', punto: 'bg-gris-950', peso: 3 },
}

/* --------------------------------------------------------------- Categoría */

export const CATEGORIAS = [
  'fontaneria',
  'electricidad',
  'climatizacion',
  'cerrajeria',
  'carpinteria',
  'pintura',
  'cristaleria',
  'albanileria',
  'otros',
] as const

export type Categoria = (typeof CATEGORIAS)[number]

export const CATEGORIA: Record<Categoria, { etiqueta: string }> = {
  fontaneria: { etiqueta: 'Fontanería' },
  electricidad: { etiqueta: 'Electricidad' },
  climatizacion: { etiqueta: 'Climatización' },
  cerrajeria: { etiqueta: 'Cerrajería' },
  carpinteria: { etiqueta: 'Carpintería' },
  pintura: { etiqueta: 'Pintura' },
  cristaleria: { etiqueta: 'Cristalería' },
  albanileria: { etiqueta: 'Albañilería' },
  otros: { etiqueta: 'Otros' },
}

/* ------------------------------------------------------------------- Canal */

export const CANALES = ['telefono', 'whatsapp', 'email', 'presencial', 'otro'] as const
export type Canal = (typeof CANALES)[number]

export const CANAL: Record<Canal, { etiqueta: string }> = {
  telefono: { etiqueta: 'Teléfono' },
  whatsapp: { etiqueta: 'WhatsApp' },
  email: { etiqueta: 'Email' },
  presencial: { etiqueta: 'En el local' },
  otro: { etiqueta: 'Otro' },
}

/* ---------------------------------------------------------- Especialidades */

export const ESPECIALIDADES = [
  'fontaneria',
  'electricidad',
  'climatizacion',
  'cerrajeria',
  'carpinteria',
  'pintura',
  'cristaleria',
  'albanileria',
  'multiservicio',
] as const

export type Especialidad = (typeof ESPECIALIDADES)[number]

export const ESPECIALIDAD: Record<Especialidad, { etiqueta: string }> = {
  fontaneria: { etiqueta: 'Fontanería' },
  electricidad: { etiqueta: 'Electricidad' },
  climatizacion: { etiqueta: 'Climatización' },
  cerrajeria: { etiqueta: 'Cerrajería' },
  carpinteria: { etiqueta: 'Carpintería' },
  pintura: { etiqueta: 'Pintura' },
  cristaleria: { etiqueta: 'Cristalería' },
  albanileria: { etiqueta: 'Albañilería' },
  multiservicio: { etiqueta: 'Multiservicio' },
}

/* -------------------------------------------------------------------- Roles */

/**
 * Roles de los usuarios. Aquí solo va el vocabulario (lo que se guarda y cómo
 * se llama en pantalla); lo que puede hacer cada uno está en `permisos.ts`.
 */
export const ROLES = ['administrador', 'oficina', 'tecnico'] as const

export type Rol = (typeof ROLES)[number]

export const ROL: Record<Rol, { etiqueta: string; descripcion: string }> = {
  administrador: {
    etiqueta: 'Administrador',
    descripcion: 'Todo lo de la oficina, más los usuarios y los borrados definitivos',
  },
  oficina: {
    etiqueta: 'Oficina',
    descripcion: 'Registra y reparte los avisos y lleva clientes, locales y técnicos',
  },
  tecnico: {
    etiqueta: 'Técnico',
    descripcion: 'Ve sus avisos, cambia su estado y rellena sus partes de trabajo',
  },
}

export function esRol(valor: unknown): valor is Rol {
  return typeof valor === 'string' && (ROLES as readonly string[]).includes(valor)
}

/* ------------------------------------------------------------------- Horas */

/** Horas dedicadas sumando todos los partes de un aviso. */
export function totalHoras(partes: readonly { horas: number }[]): number {
  return partes.reduce((total, parte) => total + parte.horas, 0)
}

/* ---------------------------------------------------------------- Opciones */

/** Convierte un vocabulario en opciones para un <Select>. */
export function opciones<C extends string>(
  claves: readonly C[],
  info: Record<C, { etiqueta: string }>,
): { valor: C; etiqueta: string }[] {
  return claves.map((clave) => ({ valor: clave, etiqueta: info[clave].etiqueta }))
}

export const OPCIONES_ESTADO = opciones(ESTADOS, ESTADO)
export const OPCIONES_PRIORIDAD = opciones(PRIORIDADES, PRIORIDAD)
export const OPCIONES_CATEGORIA = opciones(CATEGORIAS, CATEGORIA)
export const OPCIONES_CANAL = opciones(CANALES, CANAL)
export const OPCIONES_ESPECIALIDAD = opciones(ESPECIALIDADES, ESPECIALIDAD)
export const OPCIONES_ROL = opciones(ROLES, ROL)

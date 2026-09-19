/**
 * Validación de los formularios (zod).
 *
 * Todos los formularios llegan como texto desde el navegador. Aquí se comprueba,
 * se limpia y se convierte a los tipos que espera la base de datos, devolviendo
 * mensajes de error en español y por campo.
 */

import { z } from 'zod'

import { problemaContrasena } from './contrasenas'
import { CANALES, CATEGORIAS, ESPECIALIDADES, ESTADOS, PRIORIDADES, ROLES } from './dominio'
import { esFechaISO } from './fechas'

/* -------------------------------------------------------------- Auxiliares */

const REGEX_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const REGEX_HORA = /^([01]\d|2[0-3]):[0-5]\d$/

function obligatorio(mensaje: string, max = 160) {
  return z.string().trim().min(1, mensaje).max(max, `Como máximo ${max} caracteres`)
}

function opcional(max = 500) {
  return z
    .string()
    .trim()
    .max(max, `Como máximo ${max} caracteres`)
    .transform((valor) => (valor === '' ? null : valor))
}

const emailOpcional = z
  .string()
  .trim()
  .max(120, 'Como máximo 120 caracteres')
  .refine((valor) => valor === '' || REGEX_EMAIL.test(valor), 'Escribe un email válido')
  .transform((valor) => (valor === '' ? null : valor))

const fechaOpcional = z
  .string()
  .trim()
  .refine((valor) => valor === '' || esFechaISO(valor), 'Escribe una fecha válida')
  .transform((valor) => (valor === '' ? null : valor))

const fechaObligatoria = z
  .string()
  .trim()
  .min(1, 'Indica la fecha')
  .refine((valor) => esFechaISO(valor), 'Escribe una fecha válida')

const horaOpcional = z
  .string()
  .trim()
  .refine((valor) => valor === '' || REGEX_HORA.test(valor), 'Escribe una hora válida (por ejemplo 09:30)')
  .transform((valor) => (valor === '' ? null : valor))

const referenciaObligatoria = (mensaje: string) =>
  z
    .string()
    .trim()
    .min(1, mensaje)
    .transform((valor) => Number(valor))
    .refine((valor) => Number.isInteger(valor) && valor > 0, mensaje)

const referenciaOpcional = z
  .string()
  .trim()
  .transform((valor) => (valor === '' ? null : Number(valor)))
  .refine((valor) => valor === null || (Number.isInteger(valor) && valor > 0), 'Selección no válida')

/** Acepta «2,5» además de «2.5», que es como se escribe en español. */
const horasTrabajadas = z
  .string()
  .trim()
  .min(1, 'Indica las horas dedicadas')
  .transform((valor) => Number(valor.replace(',', '.')))
  .refine((valor) => Number.isFinite(valor) && valor > 0, 'Las horas deben ser mayores que 0')
  .refine((valor) => valor <= 24, 'Como máximo 24 horas en un mismo parte')

/* ---------------------------------------------------------------- Clientes */

export const esquemaCliente = z.object({
  nombre: obligatorio('Escribe el nombre del cliente'),
  cif: opcional(20),
  personaContacto: opcional(120),
  telefono: opcional(30),
  email: emailOpcional,
  direccionFacturacion: opcional(200),
  notas: opcional(1000),
})

export type DatosCliente = z.infer<typeof esquemaCliente>

/* ------------------------------------------------------------------ Locales */

export const esquemaLocal = z.object({
  clienteId: referenciaObligatoria('Selecciona el cliente'),
  nombre: obligatorio('Escribe el nombre del local'),
  direccion: obligatorio('Escribe la dirección', 200),
  ciudad: obligatorio('Escribe la ciudad', 80),
  provincia: opcional(80),
  codigoPostal: opcional(10),
  telefono: opcional(30),
  personaContacto: opcional(120),
  horario: opcional(120),
  notasAcceso: opcional(500),
})

export type DatosLocal = z.infer<typeof esquemaLocal>

/* ----------------------------------------------------------------- Técnicos */

export const esquemaTecnico = z.object({
  nombre: obligatorio('Escribe el nombre del técnico', 80),
  apellidos: opcional(120),
  telefono: opcional(30),
  email: emailOpcional,
  especialidades: z
    .array(z.enum(ESPECIALIDADES))
    .min(1, 'Marca al menos una especialidad'),
  zona: opcional(80),
  notas: opcional(1000),
})

export type DatosTecnico = z.infer<typeof esquemaTecnico>

/* ------------------------------------------------------------------- Avisos */

/** Una hora sin día no sirve: la agenda coloca los avisos por su día. */
function horaConDia(
  datos: { fechaProgramada: string | null; horaProgramada: string | null },
  ctx: z.RefinementCtx,
) {
  if (datos.horaProgramada && !datos.fechaProgramada) {
    ctx.addIssue({
      code: 'custom',
      path: ['fechaProgramada'],
      message: 'Si indicas la hora, indica también el día',
    })
  }
}

export const esquemaAviso = z
  .object({
    clienteId: referenciaObligatoria('Selecciona el cliente'),
    localId: referenciaObligatoria('Selecciona el local'),
    tecnicoId: referenciaOpcional,
    titulo: obligatorio('Resume la incidencia en una frase'),
    descripcion: opcional(2000),
    categoria: z.enum(CATEGORIAS, { message: 'Selecciona el tipo de trabajo' }),
    prioridad: z.enum(PRIORIDADES, { message: 'Selecciona la prioridad' }),
    estado: z.enum(ESTADOS, { message: 'Selecciona el estado' }),
    canalEntrada: z.enum(CANALES, { message: 'Indica cómo ha entrado el aviso' }),
    contactoAviso: opcional(120),
    fechaProgramada: fechaOpcional,
    horaProgramada: horaOpcional,
    motivoEspera: opcional(500),
    resumenCierre: opcional(1000),
  })
  .superRefine((datos, ctx) => {
    if (datos.estado === 'en_espera' && !datos.motivoEspera) {
      ctx.addIssue({
        code: 'custom',
        path: ['motivoEspera'],
        message: 'Explica por qué queda en espera (falta material, sin acceso al local…)',
      })
    }
    if (datos.estado === 'finalizado' && !datos.resumenCierre) {
      ctx.addIssue({
        code: 'custom',
        path: ['resumenCierre'],
        message: 'Resume lo realizado para poder cerrar el aviso',
      })
    }
    if (datos.estado !== 'pendiente' && datos.estado !== 'cancelado' && datos.tecnicoId === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['tecnicoId'],
        message: 'Asigna un técnico o deja el aviso como pendiente',
      })
    }
    horaConDia(datos, ctx)
  })

export type DatosAviso = z.infer<typeof esquemaAviso>

/* ---------------------------------------------------------- Cambio de estado */

export const esquemaCambioEstado = z
  .object({
    estado: z.enum(ESTADOS, { message: 'Selecciona el estado' }),
    nota: opcional(1000),
  })
  .superRefine((datos, ctx) => {
    if (datos.estado === 'en_espera' && !datos.nota) {
      ctx.addIssue({ code: 'custom', path: ['nota'], message: 'Explica por qué queda en espera' })
    }
    if (datos.estado === 'finalizado' && !datos.nota) {
      ctx.addIssue({ code: 'custom', path: ['nota'], message: 'Resume lo realizado para cerrar el aviso' })
    }
  })

export const esquemaAsignacion = z
  .object({
    tecnicoId: referenciaOpcional,
    fechaProgramada: fechaOpcional,
    horaProgramada: horaOpcional,
  })
  .superRefine(horaConDia)

/* -------------------------------------------------------- Partes de trabajo */

export const esquemaParte = z.object({
  tecnicoId: referenciaObligatoria('Selecciona el técnico que ha hecho el trabajo'),
  fecha: fechaObligatoria,
  horas: horasTrabajadas,
  trabajoRealizado: obligatorio('Describe el trabajo realizado', 2000),
  materiales: opcional(1000),
  resuelto: z.boolean(),
  observaciones: opcional(1000),
})

export type DatosParte = z.infer<typeof esquemaParte>

/* ----------------------------------------------------------------- Usuarios */

const datosUsuario = {
  nombre: obligatorio('Escribe el nombre de la persona', 120),
  rol: z.enum(ROLES, { message: 'Elige el rol' }),
  tecnicoId: referenciaOpcional,
}

/**
 * Un técnico tiene que ir vinculado a su ficha de técnico (es lo que decide qué
 * avisos ve); el resto de roles no lleva ficha.
 */
function conFichaDeTecnico<T extends { rol: (typeof ROLES)[number]; tecnicoId: number | null }>(
  datos: T,
  ctx: z.RefinementCtx,
) {
  if (datos.rol === 'tecnico' && datos.tecnicoId === null) {
    ctx.addIssue({
      code: 'custom',
      path: ['tecnicoId'],
      message: 'Elige la ficha de técnico de esta persona',
    })
  }
}

function sinFichaSiNoEsTecnico<T extends { rol: (typeof ROLES)[number]; tecnicoId: number | null }>(datos: T): T {
  return datos.rol === 'tecnico' ? datos : { ...datos, tecnicoId: null }
}

export const esquemaUsuarioNuevo = z
  .object({
    ...datosUsuario,
    email: z
      .string()
      .trim()
      .toLowerCase()
      .min(1, 'Escribe el email con el que entrará')
      .max(254, 'Como máximo 254 caracteres')
      .refine((valor) => REGEX_EMAIL.test(valor), 'Escribe un email válido'),
  })
  .superRefine(conFichaDeTecnico)
  .transform(sinFichaSiNoEsTecnico)

export type DatosUsuarioNuevo = z.infer<typeof esquemaUsuarioNuevo>

/** Al modificar no se toca el email: es el nombre de la cuenta en Supabase Auth. */
export const esquemaUsuario = z
  .object(datosUsuario)
  .superRefine(conFichaDeTecnico)
  .transform(sinFichaSiNoEsTecnico)

export type DatosUsuario = z.infer<typeof esquemaUsuario>

/**
 * Contraseña nueva, escrita dos veces. Sin `trim`: los espacios también cuentan.
 * `email` es el del usuario, para rechazar contraseñas que lo contengan.
 */
export function esquemaContrasenaNueva(email: string) {
  return z
    .object({
      nueva: z.string(),
      repetir: z.string(),
    })
    .superRefine((datos, ctx) => {
      const problema = problemaContrasena(datos.nueva, email)
      if (problema) {
        ctx.addIssue({ code: 'custom', path: ['nueva'], message: problema })
      } else if (datos.nueva !== datos.repetir) {
        ctx.addIssue({ code: 'custom', path: ['repetir'], message: 'Las dos contraseñas no coinciden' })
      }
    })
}

/* ------------------------------------------------------- Errores por campo */

export type ErroresCampo = Record<string, string>

/** Convierte los errores de zod en `{ campo: "mensaje" }` para pintarlos en el formulario. */
export function erroresDe(error: z.ZodError): ErroresCampo {
  const errores: ErroresCampo = {}
  for (const problema of error.issues) {
    const campo = problema.path.join('.') || 'general'
    if (!errores[campo]) errores[campo] = problema.message
  }
  return errores
}

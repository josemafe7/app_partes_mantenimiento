/**
 * Esquema de la base de datos (PostgreSQL en Supabase).
 *
 * Los vocabularios se guardan como texto con CHECK en lugar de enums de
 * Postgres: así la base de datos rechaza cualquier valor que no esté en
 * dominio.ts, y añadir uno es cambiar una lista y generar una migración.
 *
 * Tipos de fecha:
 * - Las fechas de calendario (`fechaProgramada`, `partes.fecha`) son `date` y
 *   se leen como texto `YYYY-MM-DD`: no se desplazan por la zona horaria.
 * - Los instantes (`fechaAviso`, `fechaCierre`, `movimientos.fecha` y las
 *   marcas de tiempo) son `timestamptz` y se leen como `Date`.
 *
 * Las migraciones SQL se generan desde aquí (`pnpm db:generar`) en
 * `supabase/migrations/`. Los permisos y el RLS van en migraciones escritas
 * a mano (`acceso_app`, `acceso_usuarios`), porque Drizzle no genera GRANT ni REVOKE.
 */

import { relations, sql } from 'drizzle-orm'
import {
  boolean,
  check,
  date,
  doublePrecision,
  index,
  integer,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core'
import { authUsers } from 'drizzle-orm/supabase'

import {
  CANALES,
  CATEGORIAS,
  ESPECIALIDADES,
  ESTADOS,
  PRIORIDADES,
  ROLES,
  type Canal,
  type Categoria,
  type Especialidad,
  type Estado,
  type Prioridad,
  type Rol,
} from '@/lib/dominio'

/** Lista de valores permitidos para un CHECK: 'a', 'b', 'c' */
function enLista(valores: readonly string[]): string {
  return valores.map((valor) => `'${valor}'`).join(', ')
}

/** Instante con zona horaria, leído como `Date`. */
function instante(nombre: string) {
  return timestamp(nombre, { withTimezone: true, mode: 'date' })
}

/** Día de calendario, leído como texto `YYYY-MM-DD`. */
function diaCalendario(nombre: string) {
  return date(nombre, { mode: 'string' })
}

/**
 * Clave primaria. Es `integer` (y no `bigint`) a propósito: el driver devuelve
 * los `bigint` como texto y toda la aplicación trabaja los ids como `number`.
 */
function idAutonumerico() {
  return integer('id').primaryKey().generatedAlwaysAsIdentity()
}

const marcasDeTiempo = {
  creadoEn: instante('creado_en').notNull().defaultNow(),
  actualizadoEn: instante('actualizado_en').notNull().defaultNow(),
}

/* ----------------------------------------------------------------- Clientes */

export const clientes = pgTable(
  'clientes',
  {
    id: idAutonumerico(),
    nombre: text('nombre').notNull(),
    cif: text('cif'),
    personaContacto: text('persona_contacto'),
    telefono: text('telefono'),
    email: text('email'),
    direccionFacturacion: text('direccion_facturacion'),
    notas: text('notas'),
    archivado: boolean('archivado').notNull().default(false),
    ...marcasDeTiempo,
  },
  (tabla) => [index('idx_clientes_nombre').on(tabla.nombre)],
)

/* ------------------------------------------------------------------- Locales */

export const locales = pgTable(
  'locales',
  {
    id: idAutonumerico(),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'restrict' }),
    nombre: text('nombre').notNull(),
    direccion: text('direccion').notNull(),
    ciudad: text('ciudad').notNull(),
    provincia: text('provincia'),
    codigoPostal: text('codigo_postal'),
    telefono: text('telefono'),
    personaContacto: text('persona_contacto'),
    horario: text('horario'),
    notasAcceso: text('notas_acceso'),
    archivado: boolean('archivado').notNull().default(false),
    ...marcasDeTiempo,
  },
  (tabla) => [index('idx_locales_cliente').on(tabla.clienteId)],
)

/* ------------------------------------------------------------------ Técnicos */

export const tecnicos = pgTable(
  'tecnicos',
  {
    id: idAutonumerico(),
    nombre: text('nombre').notNull(),
    apellidos: text('apellidos'),
    telefono: text('telefono'),
    email: text('email'),
    especialidades: text('especialidades')
      .array()
      .notNull()
      .$type<Especialidad[]>()
      .default(sql`'{}'::text[]`),
    zona: text('zona'),
    notas: text('notas'),
    archivado: boolean('archivado').notNull().default(false),
    ...marcasDeTiempo,
  },
  (tabla) => [
    check(
      'chk_tecnicos_especialidades',
      sql`${tabla.especialidades} <@ array[${sql.raw(enLista(ESPECIALIDADES))}]::text[]`,
    ),
  ],
)

/* ------------------------------------------------------------------ Usuarios */

/**
 * Perfil de cada usuario de la aplicación.
 *
 * La cuenta (email y contraseña) vive en Supabase Auth, en `auth.users`, y el
 * id es el mismo. Aquí va lo que decide qué puede hacer: el rol, la ficha de
 * técnico a la que está vinculado y si sigue activo. Solo lo lee y escribe el
 * servidor (rol `app_avisos`), nunca el navegador.
 */
export const perfiles = pgTable(
  'perfiles',
  {
    id: uuid('id')
      .primaryKey()
      .references(() => authUsers.id, { onDelete: 'cascade' }),
    nombre: text('nombre').notNull(),
    /** Copia del email de la cuenta, en minúsculas, para listarlo sin ir a Auth. */
    email: text('email').notNull(),
    rol: text('rol').$type<Rol>().notNull(),
    /**
     * Ficha de técnico del usuario. Solo la llevan los técnicos; si se borra la
     * ficha (o se recargan los datos de ejemplo) se queda vacía y el usuario no
     * ve ningún aviso hasta que un administrador lo vuelva a vincular.
     */
    tecnicoId: integer('tecnico_id').references(() => tecnicos.id, { onDelete: 'set null' }),
    activo: boolean('activo').notNull().default(true),
    /** Recibió la contraseña de un administrador: tiene que cambiarla al entrar. */
    debeCambiarContrasena: boolean('debe_cambiar_contrasena').notNull().default(true),
    /**
     * Las sesiones iniciadas antes de este instante dejan de valer. Se mueve al
     * restablecer la contraseña o al desactivar al usuario.
     */
    sesionesValidasDesde: instante('sesiones_validas_desde').notNull().defaultNow(),
    ultimoAcceso: instante('ultimo_acceso'),
    ...marcasDeTiempo,
  },
  (tabla) => [
    uniqueIndex('idx_perfiles_email').on(tabla.email),
    uniqueIndex('idx_perfiles_tecnico').on(tabla.tecnicoId),
    check('chk_perfiles_rol', sql`${tabla.rol} in (${sql.raw(enLista(ROLES))})`),
    check('chk_perfiles_tecnico', sql`${tabla.tecnicoId} is null or ${tabla.rol} = 'tecnico'`),
  ],
)

/**
 * Intentos de inicio de sesión, para frenar a quien prueba contraseñas: tras
 * varios fallos seguidos con un email o desde una IP, se espera un rato. Solo
 * se guardan unas horas.
 */
export const intentosAcceso = pgTable(
  'intentos_acceso',
  {
    id: idAutonumerico(),
    email: text('email').notNull(),
    ip: text('ip'),
    exito: boolean('exito').notNull(),
    fecha: instante('fecha').notNull().defaultNow(),
  },
  (tabla) => [
    index('idx_intentos_email_fecha').on(tabla.email, tabla.fecha),
    index('idx_intentos_ip_fecha').on(tabla.ip, tabla.fecha),
  ],
)

/**
 * Lecturas de mensajes con IA, para poner un tope de uso por usuario: cada una
 * es una llamada de pago a OpenRouter, y sin tope una cuenta de oficina robada
 * (o un bucle) gastaría el saldo. Solo se guarda quién y cuándo, nunca el
 * mensaje, y solo un día.
 */
export const lecturasIa = pgTable(
  'lecturas_ia',
  {
    id: idAutonumerico(),
    usuarioId: uuid('usuario_id')
      .notNull()
      .references(() => perfiles.id, { onDelete: 'cascade' }),
    fecha: instante('fecha').notNull().defaultNow(),
  },
  (tabla) => [index('idx_lecturas_ia_usuario_fecha').on(tabla.usuarioId, tabla.fecha)],
)

/* -------------------------------------------------------------------- Avisos */

export const avisos = pgTable(
  'avisos',
  {
    id: idAutonumerico(),
    /** Referencia legible tipo AV-2026-0001. */
    referencia: text('referencia').notNull(),
    clienteId: integer('cliente_id')
      .notNull()
      .references(() => clientes.id, { onDelete: 'restrict' }),
    localId: integer('local_id')
      .notNull()
      .references(() => locales.id, { onDelete: 'restrict' }),
    tecnicoId: integer('tecnico_id').references(() => tecnicos.id, { onDelete: 'restrict' }),
    titulo: text('titulo').notNull(),
    descripcion: text('descripcion'),
    categoria: text('categoria').$type<Categoria>().notNull(),
    prioridad: text('prioridad').$type<Prioridad>().notNull().default('normal'),
    estado: text('estado').$type<Estado>().notNull().default('pendiente'),
    canalEntrada: text('canal_entrada').$type<Canal>().notNull().default('telefono'),
    /** Quién dio el aviso desde el local. */
    contactoAviso: text('contacto_aviso'),
    /** Cuándo entró el aviso. */
    fechaAviso: instante('fecha_aviso').notNull().defaultNow(),
    /** Día previsto de la visita, como YYYY-MM-DD. */
    fechaProgramada: diaCalendario('fecha_programada'),
    /** Hora prevista, como HH:mm. */
    horaProgramada: text('hora_programada'),
    fechaCierre: instante('fecha_cierre'),
    /** Por qué está aparcado (obligatorio en estado «en espera»). */
    motivoEspera: text('motivo_espera'),
    /** Cómo se resolvió (obligatorio al finalizar). */
    resumenCierre: text('resumen_cierre'),
    ...marcasDeTiempo,
  },
  (tabla) => [
    uniqueIndex('idx_avisos_referencia').on(tabla.referencia),
    index('idx_avisos_estado').on(tabla.estado),
    index('idx_avisos_cliente').on(tabla.clienteId),
    index('idx_avisos_tecnico').on(tabla.tecnicoId),
    index('idx_avisos_local').on(tabla.localId),
    index('idx_avisos_fecha_programada').on(tabla.fechaProgramada),
    check('chk_avisos_estado', sql`${tabla.estado} in (${sql.raw(enLista(ESTADOS))})`),
    check('chk_avisos_prioridad', sql`${tabla.prioridad} in (${sql.raw(enLista(PRIORIDADES))})`),
    check('chk_avisos_categoria', sql`${tabla.categoria} in (${sql.raw(enLista(CATEGORIAS))})`),
    check('chk_avisos_canal', sql`${tabla.canalEntrada} in (${sql.raw(enLista(CANALES))})`),
    check('chk_avisos_hora', sql`${tabla.horaProgramada} ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'`),
  ],
)

/* ------------------------------------------------------- Partes de trabajo */

export const partes = pgTable(
  'partes',
  {
    id: idAutonumerico(),
    avisoId: integer('aviso_id')
      .notNull()
      .references(() => avisos.id, { onDelete: 'cascade' }),
    tecnicoId: integer('tecnico_id')
      .notNull()
      .references(() => tecnicos.id, { onDelete: 'restrict' }),
    /** Día de la intervención, como YYYY-MM-DD. */
    fecha: diaCalendario('fecha').notNull(),
    horas: doublePrecision('horas').notNull().default(1),
    trabajoRealizado: text('trabajo_realizado').notNull(),
    materiales: text('materiales'),
    /** ¿La incidencia queda resuelta con esta visita? */
    resuelto: boolean('resuelto').notNull().default(false),
    observaciones: text('observaciones'),
    /** Quién lo anotó: el propio técnico o alguien de la oficina. */
    creadoPor: uuid('creado_por').references(() => perfiles.id, { onDelete: 'set null' }),
    ...marcasDeTiempo,
  },
  (tabla) => [
    index('idx_partes_aviso').on(tabla.avisoId),
    index('idx_partes_tecnico').on(tabla.tecnicoId),
    index('idx_partes_fecha').on(tabla.fecha),
    index('idx_partes_creado_por').on(tabla.creadoPor),
    check('chk_partes_horas', sql`${tabla.horas} > 0 and ${tabla.horas} <= 24`),
  ],
)

/* --------------------------------------------------- Movimientos (historial) */

export const movimientos = pgTable(
  'movimientos',
  {
    id: idAutonumerico(),
    avisoId: integer('aviso_id')
      .notNull()
      .references(() => avisos.id, { onDelete: 'cascade' }),
    estadoAnterior: text('estado_anterior').$type<Estado>(),
    estadoNuevo: text('estado_nuevo').$type<Estado>().notNull(),
    nota: text('nota'),
    fecha: instante('fecha').notNull().defaultNow(),
    /** Quién hizo el cambio. Vacío en los datos de ejemplo y si se borra el usuario. */
    usuarioId: uuid('usuario_id').references(() => perfiles.id, { onDelete: 'set null' }),
  },
  (tabla) => [
    index('idx_movimientos_aviso').on(tabla.avisoId),
    index('idx_movimientos_fecha').on(tabla.fecha),
    index('idx_movimientos_usuario').on(tabla.usuarioId),
    check(
      'chk_movimientos_estado_anterior',
      sql`${tabla.estadoAnterior} in (${sql.raw(enLista(ESTADOS))})`,
    ),
    check('chk_movimientos_estado_nuevo', sql`${tabla.estadoNuevo} in (${sql.raw(enLista(ESTADOS))})`),
  ],
)

/* --------------------------------------------------------------- Relaciones */

export const relacionesClientes = relations(clientes, ({ many }) => ({
  locales: many(locales),
  avisos: many(avisos),
}))

export const relacionesLocales = relations(locales, ({ one, many }) => ({
  cliente: one(clientes, { fields: [locales.clienteId], references: [clientes.id] }),
  avisos: many(avisos),
}))

export const relacionesTecnicos = relations(tecnicos, ({ many }) => ({
  avisos: many(avisos),
  partes: many(partes),
}))

export const relacionesAvisos = relations(avisos, ({ one, many }) => ({
  cliente: one(clientes, { fields: [avisos.clienteId], references: [clientes.id] }),
  local: one(locales, { fields: [avisos.localId], references: [locales.id] }),
  tecnico: one(tecnicos, { fields: [avisos.tecnicoId], references: [tecnicos.id] }),
  partes: many(partes),
  movimientos: many(movimientos),
}))

export const relacionesPartes = relations(partes, ({ one }) => ({
  aviso: one(avisos, { fields: [partes.avisoId], references: [avisos.id] }),
  tecnico: one(tecnicos, { fields: [partes.tecnicoId], references: [tecnicos.id] }),
  creador: one(perfiles, { fields: [partes.creadoPor], references: [perfiles.id] }),
}))

export const relacionesMovimientos = relations(movimientos, ({ one }) => ({
  aviso: one(avisos, { fields: [movimientos.avisoId], references: [avisos.id] }),
  usuario: one(perfiles, { fields: [movimientos.usuarioId], references: [perfiles.id] }),
}))

export const relacionesPerfiles = relations(perfiles, ({ one }) => ({
  tecnico: one(tecnicos, { fields: [perfiles.tecnicoId], references: [tecnicos.id] }),
}))

/* -------------------------------------------------------------------- Tipos */

export type Cliente = typeof clientes.$inferSelect
export type ClienteNuevo = typeof clientes.$inferInsert
export type Local = typeof locales.$inferSelect
export type LocalNuevo = typeof locales.$inferInsert
export type Tecnico = typeof tecnicos.$inferSelect
export type TecnicoNuevo = typeof tecnicos.$inferInsert
export type Aviso = typeof avisos.$inferSelect
export type AvisoNuevo = typeof avisos.$inferInsert
export type Parte = typeof partes.$inferSelect
export type ParteNuevo = typeof partes.$inferInsert
export type Movimiento = typeof movimientos.$inferSelect
export type MovimientoNuevo = typeof movimientos.$inferInsert
export type Perfil = typeof perfiles.$inferSelect
export type PerfilNuevo = typeof perfiles.$inferInsert

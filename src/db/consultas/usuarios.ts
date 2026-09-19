/** Consultas de usuarios: perfiles, vínculo con los técnicos e intentos de acceso. */

import { and, asc, count, desc, eq, gte, isNull, lt, ne, or, type SQL } from 'drizzle-orm'

import { bd } from '@/db/cliente'
import { intentosAcceso, perfiles, tecnicos } from '@/db/esquema'

/* ------------------------------------------------------------------ Perfiles */

export async function obtenerPerfil(id: string) {
  const fila = await bd.query.perfiles.findFirst({ where: eq(perfiles.id, id) })
  return fila ?? null
}

export async function perfilPorEmail(email: string) {
  const fila = await bd.query.perfiles.findFirst({ where: eq(perfiles.email, email) })
  return fila ?? null
}

/** Usuarios con su ficha de técnico: primero los activos, por nombre. */
export async function listarUsuarios() {
  return bd
    .select({
      id: perfiles.id,
      nombre: perfiles.nombre,
      email: perfiles.email,
      rol: perfiles.rol,
      activo: perfiles.activo,
      debeCambiarContrasena: perfiles.debeCambiarContrasena,
      ultimoAcceso: perfiles.ultimoAcceso,
      tecnicoId: tecnicos.id,
      tecnicoNombre: tecnicos.nombre,
      tecnicoApellidos: tecnicos.apellidos,
    })
    .from(perfiles)
    .leftJoin(tecnicos, eq(perfiles.tecnicoId, tecnicos.id))
    .orderBy(desc(perfiles.activo), asc(perfiles.nombre))
}

export type UsuarioEnLista = Awaited<ReturnType<typeof listarUsuarios>>[number]

const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Usuario con su ficha. Acepta cualquier texto (llega de la URL o de un formulario). */
export async function obtenerUsuario(id: string) {
  // Postgres rechaza con un error lo que no tiene forma de uuid: mejor «no existe».
  if (!REGEX_UUID.test(id)) return null
  const fila = await bd.query.perfiles.findFirst({
    where: eq(perfiles.id, id),
    with: { tecnico: true },
  })
  return fila ?? null
}

/**
 * Fichas de técnico que se pueden vincular a un usuario: las no archivadas que
 * no tienen ya usuario (o la que tiene este mismo usuario, al modificarlo).
 */
export async function tecnicosParaVincular(usuarioId?: string) {
  return bd
    .select({ id: tecnicos.id, nombre: tecnicos.nombre, apellidos: tecnicos.apellidos })
    .from(tecnicos)
    .leftJoin(perfiles, eq(perfiles.tecnicoId, tecnicos.id))
    .where(
      and(
        eq(tecnicos.archivado, false),
        usuarioId ? or(isNull(perfiles.id), eq(perfiles.id, usuarioId)) : isNull(perfiles.id),
      ),
    )
    .orderBy(asc(tecnicos.nombre))
}

/** ¿Tiene ya usuario esta ficha de técnico? (sin contar a `excepto`) */
export async function tecnicoConUsuario(tecnicoId: number, excepto?: string): Promise<boolean> {
  const [fila] = await bd
    .select({ total: count() })
    .from(perfiles)
    .where(and(eq(perfiles.tecnicoId, tecnicoId), excepto ? ne(perfiles.id, excepto) : undefined))
  return (fila?.total ?? 0) > 0
}

/** Administradores activos: siempre tiene que quedar al menos uno. */
export async function administradoresActivos(): Promise<number> {
  const [fila] = await bd
    .select({ total: count() })
    .from(perfiles)
    .where(and(eq(perfiles.rol, 'administrador'), eq(perfiles.activo, true)))
  return fila?.total ?? 0
}

/* ------------------------------------------------------- Intentos de acceso */

/** Ventana en la que se cuentan los fallos. */
export const MINUTOS_BLOQUEO = 15
/** Fallos seguidos con el mismo email antes de esperar. */
export const MAX_FALLOS_EMAIL = 5
/** Fallos desde la misma IP (con cualquier email) antes de esperar. */
export const MAX_FALLOS_IP = 20

/**
 * ¿Hay que hacer esperar a quien intenta entrar? Frena a quien prueba
 * contraseñas: con un email concreto (5 fallos) o muchos emails desde la misma
 * IP (20 fallos) en los últimos 15 minutos.
 */
export async function accesoBloqueado(email: string, ip: string | null): Promise<boolean> {
  const desde = new Date(Date.now() - MINUTOS_BLOQUEO * 60_000)
  const fallos = (condicion: SQL) =>
    bd
      .select({ total: count() })
      .from(intentosAcceso)
      .where(and(condicion, eq(intentosAcceso.exito, false), gte(intentosAcceso.fecha, desde)))

  const [porEmail] = await fallos(eq(intentosAcceso.email, email))
  if ((porEmail?.total ?? 0) >= MAX_FALLOS_EMAIL) return true
  if (!ip) return false

  const [porIp] = await fallos(eq(intentosAcceso.ip, ip))
  return (porIp?.total ?? 0) >= MAX_FALLOS_IP
}

/**
 * Anota un intento de acceso. Uno correcto borra los fallos anteriores de ese
 * email, y de paso se borra lo que tenga más de un día: no hace falta más.
 */
export async function registrarIntento(email: string, ip: string | null, exito: boolean) {
  await bd.transaction(async (tx) => {
    await tx.delete(intentosAcceso).where(lt(intentosAcceso.fecha, new Date(Date.now() - 24 * 3_600_000)))
    if (exito) {
      await tx
        .delete(intentosAcceso)
        .where(and(eq(intentosAcceso.email, email), eq(intentosAcceso.exito, false)))
    }
    await tx.insert(intentosAcceso).values({ email: email.slice(0, 254), ip, exito, fecha: new Date() })
  })
}

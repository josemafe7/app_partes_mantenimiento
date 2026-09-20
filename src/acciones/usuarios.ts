'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'

import { bd } from '@/db/cliente'
import {
  administradoresActivos,
  obtenerUsuario,
  perfilPorEmail,
  tecnicoConUsuario,
} from '@/db/consultas/usuarios'
import { obtenerTecnico } from '@/db/consultas/tecnicos'
import { perfiles } from '@/db/esquema'
import { ESTADO_INICIAL, SIN_PERMISO, texto, valoresDe, type ResultadoAccion } from '@/lib/acciones'
import { generarContrasenaTemporal } from '@/lib/contrasenas'
import { puede, type Usuario } from '@/lib/permisos'
import { usuarioDeLaAccion } from '@/lib/sesion'
import { clienteAdmin } from '@/lib/supabase/admin'
import { erroresDe, esquemaUsuario, esquemaUsuarioNuevo } from '@/lib/validaciones'

/*
 * Gestión de usuarios: solo para administradores.
 *
 * La cuenta (email y contraseña) está en Supabase Auth y se maneja con el
 * cliente de administración; el rol y la ficha de técnico, en `perfiles`. Nadie
 * elige su contraseña al darse de alta: el administrador recibe una temporal,
 * se la da en mano y el usuario la cambia al entrar. Así no hace falta enviar
 * emails, que el servidor de correo de prueba de Supabase no permite.
 */

/** Un año tras otro: bloqueado hasta que se reactive. */
const BLOQUEO_INDEFINIDO = '876000h'

function refrescar(id?: string) {
  revalidatePath('/usuarios')
  if (id) revalidatePath(`/usuarios/${id}`)
}

/**
 * Rastro de los cambios de permisos en los registros del servidor (en Vercel,
 * «Logs»): qué se hizo, quién y a quién. Solo identificadores: ni emails, ni
 * nombres, ni por supuesto contraseñas.
 */
function anotar(accion: string, autor: Usuario, afectadoId: string, detalle = '') {
  console.info(`[usuarios] ${accion}: por=${autor.id} a=${afectadoId}${detalle ? ` ${detalle}` : ''}`)
}

async function administrador(): Promise<Usuario | null> {
  const usuario = await usuarioDeLaAccion()
  return puede(usuario, 'gestionarUsuarios') ? usuario : null
}

/** La ficha de técnico existe, no está archivada y no la usa otro usuario. */
async function problemaFicha(tecnicoId: number | null, usuarioId?: string): Promise<string | null> {
  if (tecnicoId === null) return null
  const tecnico = await obtenerTecnico(tecnicoId)
  if (!tecnico || tecnico.archivado) return 'Esa ficha de técnico no existe o está archivada'
  if (await tecnicoConUsuario(tecnicoId, usuarioId)) return 'Esa ficha ya está vinculada a otro usuario'
  return null
}

/* -------------------------------------------------------------------- Crear */

export async function crearUsuario(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  const yo = await administrador()
  if (!yo) return SIN_PERMISO

  const analisis = esquemaUsuarioNuevo.safeParse({
    nombre: texto(formData, 'nombre'),
    email: texto(formData, 'email'),
    rol: texto(formData, 'rol'),
    tecnicoId: texto(formData, 'tecnicoId'),
  })
  if (!analisis.success) {
    return { ok: false, errores: erroresDe(analisis.error), valores: valoresDe(formData) }
  }

  const datos = analisis.data
  if (await perfilPorEmail(datos.email)) {
    return { ok: false, errores: { email: 'Ya hay un usuario con este email' }, valores: valoresDe(formData) }
  }
  const ficha = await problemaFicha(datos.tecnicoId)
  if (ficha) return { ok: false, errores: { tecnicoId: ficha }, valores: valoresDe(formData) }

  const contrasena = generarContrasenaTemporal()
  const admin = clienteAdmin()
  const { data, error } = await admin.auth.admin.createUser({
    email: datos.email,
    password: contrasena,
    // La cuenta la crea el administrador: no hace falta confirmar el email.
    email_confirm: true,
  })
  if (error || !data.user) {
    const existe = error?.code === 'email_exists' || error?.status === 422
    return {
      ok: false,
      ...(existe
        ? { errores: { email: 'Ya hay una cuenta de Supabase con este email' } }
        : { mensaje: 'Supabase no ha podido crear la cuenta. Prueba de nuevo en unos minutos.' }),
      valores: valoresDe(formData),
    }
  }

  try {
    await bd.insert(perfiles).values({
      id: data.user.id,
      nombre: datos.nombre,
      email: datos.email,
      rol: datos.rol,
      tecnicoId: datos.tecnicoId,
      debeCambiarContrasena: true,
    })
  } catch (errorPerfil) {
    // Sin perfil la cuenta no serviría de nada: se deshace para poder repetir.
    await admin.auth.admin.deleteUser(data.user.id)
    throw errorPerfil
  }

  anotar('usuario creado', yo, data.user.id, `rol=${datos.rol}`)
  refrescar()
  return {
    ok: true,
    mensaje: `${datos.nombre} ya tiene usuario.`,
    secreto: contrasena,
    valores: { id: data.user.id, nombre: datos.nombre },
  }
}

/* --------------------------------------------------------------- Modificar */

export async function actualizarUsuario(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  const yo = await administrador()
  if (!yo) return SIN_PERMISO

  const usuario = await obtenerUsuario(texto(formData, 'id'))
  if (!usuario) return { ok: false, mensaje: 'Ese usuario ya no existe' }

  const analisis = esquemaUsuario.safeParse({
    nombre: texto(formData, 'nombre'),
    rol: texto(formData, 'rol'),
    tecnicoId: texto(formData, 'tecnicoId'),
  })
  if (!analisis.success) {
    return { ok: false, errores: erroresDe(analisis.error), valores: valoresDe(formData) }
  }

  const datos = analisis.data
  // Uno mismo no se quita el rol de administrador: podría quedarse sin nadie
  // que pueda gestionar los usuarios.
  if (usuario.id === yo.id && datos.rol !== usuario.rol) {
    return {
      ok: false,
      errores: { rol: 'No puedes cambiar tu propio rol. Pídeselo a otro administrador.' },
      valores: valoresDe(formData),
    }
  }
  const ficha = await problemaFicha(datos.tecnicoId, usuario.id)
  if (ficha) return { ok: false, errores: { tecnicoId: ficha }, valores: valoresDe(formData) }

  await bd
    .update(perfiles)
    .set({ ...datos, actualizadoEn: new Date() })
    .where(eq(perfiles.id, usuario.id))

  if (datos.rol !== usuario.rol) anotar('rol cambiado', yo, usuario.id, `de=${usuario.rol} a=${datos.rol}`)
  refrescar(usuario.id)
  redirect('/usuarios')
}

/* -------------------------------------------------- Restablecer contraseña */

/**
 * Le pone una contraseña temporal nueva (para quien la ha olvidado) y cierra
 * todas sus sesiones abiertas.
 */
export async function restablecerContrasena(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  const yo = await administrador()
  if (!yo) return SIN_PERMISO

  const usuario = await obtenerUsuario(texto(formData, 'id'))
  if (!usuario) return { ok: false, mensaje: 'Ese usuario ya no existe' }
  if (usuario.id === yo.id) {
    return { ok: false, mensaje: 'Tu propia contraseña se cambia desde «Mi cuenta».' }
  }

  const contrasena = generarContrasenaTemporal()
  const { error } = await clienteAdmin().auth.admin.updateUserById(usuario.id, { password: contrasena })
  if (error) return { ok: false, mensaje: 'Supabase no ha podido cambiar la contraseña. Prueba de nuevo.' }

  await bd
    .update(perfiles)
    .set({ debeCambiarContrasena: true, sesionesValidasDesde: new Date(), actualizadoEn: new Date() })
    .where(eq(perfiles.id, usuario.id))

  anotar('contraseña restablecida', yo, usuario.id)
  refrescar(usuario.id)
  return { ok: true, mensaje: `Nueva contraseña temporal para ${usuario.nombre}.`, secreto: contrasena }
}

/* ------------------------------------------------------ Activar / desactivar */

/**
 * Un usuario no se borra: se desactiva. No puede entrar, sus sesiones abiertas
 * dejan de valer al momento y su nombre se conserva en la cronología.
 */
export async function alternarActivoUsuario(
  _previo: ResultadoAccion = ESTADO_INICIAL,
  formData: FormData,
): Promise<ResultadoAccion> {
  const yo = await administrador()
  if (!yo) return SIN_PERMISO

  const usuario = await obtenerUsuario(texto(formData, 'id'))
  if (!usuario) return { ok: false, mensaje: 'Ese usuario ya no existe' }
  if (usuario.id === yo.id) return { ok: false, mensaje: 'No puedes desactivar tu propio usuario.' }
  if (usuario.activo && usuario.rol === 'administrador' && (await administradoresActivos()) <= 1) {
    return { ok: false, mensaje: 'Tiene que quedar al menos un administrador activo.' }
  }

  const admin = clienteAdmin()
  if (usuario.activo) {
    // Primero la aplicación (deja de entrar al momento) y después Supabase
    // (no podrá renovar la sesión ni volver a entrar). Si lo segundo fallase,
    // la aplicación ya lo tiene fuera.
    await bd
      .update(perfiles)
      .set({ activo: false, sesionesValidasDesde: new Date(), actualizadoEn: new Date() })
      .where(eq(perfiles.id, usuario.id))
    await admin.auth.admin.updateUserById(usuario.id, { ban_duration: BLOQUEO_INDEFINIDO })
  } else {
    // Al revés: primero se levanta el bloqueo en Supabase y después se reactiva.
    const { error } = await admin.auth.admin.updateUserById(usuario.id, { ban_duration: 'none' })
    if (error) return { ok: false, mensaje: 'Supabase no ha podido reactivar la cuenta. Prueba de nuevo.' }
    await bd
      .update(perfiles)
      .set({ activo: true, actualizadoEn: new Date() })
      .where(eq(perfiles.id, usuario.id))
  }

  anotar(usuario.activo ? 'usuario desactivado' : 'usuario reactivado', yo, usuario.id)
  refrescar(usuario.id)
  return { ok: true, mensaje: usuario.activo ? 'Usuario desactivado.' : 'Usuario reactivado.' }
}

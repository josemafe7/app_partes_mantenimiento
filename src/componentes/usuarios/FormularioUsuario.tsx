'use client'

import Link from 'next/link'
import { useActionState, useState } from 'react'

import { Boton, BotonEnlace } from '@/componentes/ui/Boton'
import { AvisoError, Campo, Entrada, GrupoCampos, Selector } from '@/componentes/ui/Campo'
import { Tarjeta } from '@/componentes/ui/Tarjeta'
import { ESTADO_INICIAL, valorPrevio, type ResultadoAccion } from '@/lib/acciones'
import { ROL, ROLES, esRol, type Rol } from '@/lib/dominio'

import { ContrasenaTemporal } from './ContrasenaTemporal'

type Accion = (previo: ResultadoAccion, formData: FormData) => Promise<ResultadoAccion>

type Props = {
  accion: Accion
  /** Al modificar: el usuario tal y como está guardado. */
  usuario?: { id: string; nombre: string; email: string; rol: Rol; tecnicoId: number | null }
  /** Fichas de técnico libres (y la suya, al modificar). */
  tecnicos: { id: number; nombre: string; apellidos: string | null }[]
  /** El administrador se está editando a sí mismo: no puede cambiarse el rol. */
  esUnoMismo?: boolean
}

export function FormularioUsuario({ accion, usuario, tecnicos, esUnoMismo = false }: Props) {
  const [resultado, enviar, enviando] = useActionState(accion, ESTADO_INICIAL)
  const errores = resultado.errores ?? {}

  function previo(campo: string, porDefecto = ''): string {
    return valorPrevio(resultado, campo) ?? porDefecto
  }

  // El rol decide si hace falta la ficha de técnico, así que se sigue en el
  // estado. Tras un error se vuelve a tomar de lo enviado (React reinicia el
  // formulario al terminar la acción).
  const rolGuardado = previo('rol', usuario?.rol ?? 'oficina')
  const [rol, setRol] = useState<string>(rolGuardado)
  const [resultadoAnterior, setResultadoAnterior] = useState(resultado)
  if (resultadoAnterior !== resultado) {
    setResultadoAnterior(resultado)
    const enviado = valorPrevio(resultado, 'rol')
    if (enviado) setRol(enviado)
  }

  // Alta hecha: se enseña la contraseña temporal, una sola vez.
  if (resultado.ok && resultado.secreto) {
    return (
      <Tarjeta className="flex flex-col gap-5 p-5 sm:p-6">
        <div>
          <h2 className="titular text-[1.0625rem] font-semibold text-gris-900">{resultado.mensaje}</h2>
          <p className="mt-0.5 text-sm text-gris-500">Ya puede entrar con su email y esta contraseña.</p>
        </div>
        <ContrasenaTemporal contrasena={resultado.secreto} nombre={previo('nombre', 'el usuario')} />
        <div className="flex justify-end">
          <BotonEnlace href="/usuarios">Volver a los usuarios</BotonEnlace>
        </div>
      </Tarjeta>
    )
  }

  return (
    <form action={enviar} className="flex flex-col gap-5">
      {usuario && <input type="hidden" name="id" value={usuario.id} />}

      <AvisoError mensaje={resultado.mensaje} />

      <Tarjeta className="p-5 sm:p-6">
        <GrupoCampos titulo="La persona">
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre y apellidos" nombre="nombre" error={errores.nombre} obligatorio>
              <Entrada
                id="nombre"
                name="nombre"
                autoComplete="off"
                defaultValue={previo('nombre', usuario?.nombre)}
                error={Boolean(errores.nombre)}
              />
            </Campo>

            {usuario ? (
              <div className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-gris-800">Email</span>
                <p className="flex h-11 items-center rounded-control bg-gris-50 px-3.5 text-gris-700">
                  {usuario.email}
                </p>
                <p className="text-[0.8125rem] text-gris-500">
                  Es el nombre de su cuenta y no se cambia. Si cambia de email, crea otro usuario.
                </p>
              </div>
            ) : (
              <Campo
                etiqueta="Email"
                nombre="email"
                error={errores.email}
                ayuda="Con él entrará en la aplicación."
                obligatorio
              >
                <Entrada
                  id="email"
                  name="email"
                  type="email"
                  inputMode="email"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  defaultValue={previo('email')}
                  error={Boolean(errores.email)}
                />
              </Campo>
            )}
          </div>
        </GrupoCampos>
      </Tarjeta>

      <Tarjeta className="p-5 sm:p-6">
        <GrupoCampos titulo="Qué puede hacer" descripcion="El rol decide qué ve y qué puede cambiar.">
          {esUnoMismo && usuario ? (
            <>
              <input type="hidden" name="rol" value={usuario.rol} />
              <p className="rounded-tarjeta bg-gris-50 px-4 py-3 text-sm text-gris-700">
                Eres <span className="font-medium">{ROL[usuario.rol].etiqueta.toLowerCase()}</span>. Tu propio rol
                no lo puedes cambiar: pídeselo a otro administrador.
              </p>
            </>
          ) : (
            <fieldset className="grid gap-2" aria-invalid={Boolean(errores.rol) || undefined}>
              <legend className="sr-only">Rol</legend>
              {ROLES.map((opcion) => (
                <label
                  key={opcion}
                  className="flex cursor-pointer items-start gap-3 rounded-tarjeta border border-gris-200 bg-white p-3.5 transition-colors hover:border-gris-300 has-checked:border-lima-400 has-checked:bg-lima-100"
                >
                  <input
                    type="radio"
                    name="rol"
                    value={opcion}
                    defaultChecked={rolGuardado === opcion}
                    onChange={() => setRol(opcion)}
                    className="mt-0.5 size-5 shrink-0 accent-marca-700"
                  />
                  <span className="text-sm">
                    <span className="font-medium text-gris-900">{ROL[opcion].etiqueta}</span>
                    <span className="mt-0.5 block text-[0.8125rem] text-gris-600">{ROL[opcion].descripcion}</span>
                  </span>
                </label>
              ))}
              {errores.rol && (
                <p className="text-[0.8125rem] font-medium text-coral-700" role="alert">
                  {errores.rol}
                </p>
              )}
            </fieldset>
          )}

          {esRol(rol) && rol === 'tecnico' && (
            <Campo
              etiqueta="Su ficha de técnico"
              nombre="tecnicoId"
              error={errores.tecnicoId}
              ayuda="Verá los avisos asignados a esta ficha y firmará los partes con ella."
              obligatorio
            >
              {tecnicos.length > 0 ? (
                <Selector
                  id="tecnicoId"
                  name="tecnicoId"
                  defaultValue={previo('tecnicoId', usuario?.tecnicoId ? String(usuario.tecnicoId) : '')}
                  error={Boolean(errores.tecnicoId)}
                >
                  <option value="">Elige la ficha…</option>
                  {tecnicos.map((tecnico) => (
                    <option key={tecnico.id} value={tecnico.id}>
                      {tecnico.nombre} {tecnico.apellidos ?? ''}
                    </option>
                  ))}
                </Selector>
              ) : (
                <p className="rounded-tarjeta bg-mantequilla-100 px-4 py-3 text-sm text-mantequilla-800 ring-1 ring-mantequilla-300 ring-inset">
                  No queda ninguna ficha de técnico libre. Da de alta primero su ficha en{' '}
                  <Link href="/tecnicos/nuevo" className="font-medium underline underline-offset-2">
                    Técnicos
                  </Link>
                  .
                </p>
              )}
            </Campo>
          )}
        </GrupoCampos>
      </Tarjeta>

      <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
        <Link
          href="/usuarios"
          className="inline-flex h-11 items-center justify-center rounded-control px-4 text-[0.9375rem] font-medium text-gris-600 transition-colors hover:bg-white hover:text-gris-900"
        >
          Cancelar
        </Link>
        <Boton type="submit" tamano="lg" disabled={enviando}>
          {enviando ? 'Guardando…' : usuario ? 'Guardar cambios' : 'Crear el usuario'}
        </Boton>
      </div>
    </form>
  )
}

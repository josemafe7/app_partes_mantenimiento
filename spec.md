# Especificación: app de avisos y partes de trabajo

Este es el plan de implementación que se aprobó el 17-09-2026. Se ha actualizado con lo que realmente
se construyó, así que describe el estado actual del proyecto. **Estado: implementado.** El 19-09-2026
los datos pasaron de SQLite local a PostgreSQL en Supabase (ver «Base de datos en Supabase») y ese
mismo día se añadió el inicio de sesión con tres roles (ver «Usuarios, roles y permisos») y la
lectura de mensajes con IA en «Nuevo aviso» (ver «Lectura de mensajes con IA»).

## Contexto

Una empresa de mantenimiento de locales recibe hoy los avisos por teléfono y WhatsApp, los reparte
entre los técnicos por mensajes y no tiene una forma fiable de saber qué queda pendiente ni qué se ha
hecho. La información vive en conversaciones: se duplica, se pierde y nadie ve el estado real del
trabajo.

El objetivo es una aplicación web de gestión interna que sustituya ese caos por un registro único:
clientes con sus locales, técnicos, avisos con estado y fecha, y partes de trabajo con lo realizado.
Todo en español, pensada para usarse en el móvil a pie de obra y en el ordenador de la oficina, con
datos de ejemplo para probarla desde el primer arranque. Cada persona entra con su usuario y ve lo
que le toca según su rol. La única función de IA ayuda a registrar avisos: lee el mensaje que manda
el cliente y rellena el formulario, sin guardar nada.

**Decisiones tomadas con el usuario:**

| Decisión | Elección |
|---|---|
| Persistencia | Next.js + PostgreSQL en Supabase (al principio, SQLite local; migrado el 19-09-2026) |
| Clientes | Un cliente (empresa) tiene varios locales; el aviso se abre sobre un local |
| Partes | Aviso + N partes de trabajo (una visita = un parte) |
| Vistas extra | Panel con contadores, agenda por días, tablero kanban, hoja imprimible |
| Estados | Pendiente → Asignado → En curso → En espera → Finalizado → Cancelado |
| Borrado | Archivar + borrado definitivo bloqueado si hay registros vinculados |
| Uso | Local, con `pnpm dev` en el PC (diseño móvil verificado con emulador) |
| Acceso | Supabase Auth con email y contraseña; tres roles (administrador, oficina, técnico); sin registro público: el administrador da de alta a cada usuario |
| IA | Solo en «Nuevo aviso»: se pega el WhatsApp o el email del cliente y la IA propone los campos. No guarda nada; si no tiene claro el cliente o el local, lo deja en blanco y avisa. Proveedor: OpenRouter (sin SDK de Anthropic), con el modelo configurable |

---

## Stack

Sigue la convención de los proyectos hermanos (`Agentes de Voz`, `crm-dominia-agentes-main`):

- **Next.js 16** (App Router, Turbopack) + **React 19** + **TypeScript**, con **pnpm** como gestor
  (configurado en `pnpm-workspace.yaml`) y **Node 22** o posterior
- **Tailwind CSS v4** (`@tailwindcss/postcss`) y componentes propios, sin librería de UI
- **PostgreSQL en Supabase** + **Drizzle ORM** con el driver `postgres` (postgres.js); `drizzle-kit`
  genera las migraciones en `supabase/migrations/`. Las pruebas usan **PGlite** (Postgres en
  memoria)
- **Supabase Auth** con **`@supabase/ssr`** y **`@supabase/supabase-js`** (versiones fijas) para el
  inicio de sesión. Solo desde el servidor: el navegador no habla con Supabase
- **zod** para validar los formularios y **date-fns** (locale `es`) para las fechas
- **OpenRouter** para la lectura de mensajes con IA, con `fetch` desde el servidor (sin SDK)
- **lucide-react** (iconos), **clsx** + **tailwind-merge** (clases), **@dnd-kit/core** (arrastrar
  en el kanban)
- Lectura con **Server Components** y escritura con **Server Actions**, sin capa REST propia. El
  layout raíz fija `dynamic = 'force-dynamic'`, así que cada visita lee la base de datos

Scripts de `package.json`: `dev`, `build`, `start`, `lint`, `typecheck`, `test`, `db:reset` (con su
alias `db:seed`), `db:generar`, `datos:copiar` (producción → desarrollo), `usuarios:prueba` y
`usuarios:admin`.

---

## Modelo de datos (`src/db/esquema.ts`)

Los IDs son `integer` con identidad (`generated always as identity`). Los vocabularios son columnas
`text` protegidas con `CHECK`; sus valores, etiquetas en español y colores están en un único sitio,
`src/lib/dominio.ts`. Las migraciones SQL viven en `supabase/migrations/` y se aplican en Supabase
aparte (la aplicación no puede cambiar el esquema).

- **clientes**: `nombre`, `cif`, `personaContacto`, `telefono`, `email`,
  `direccionFacturacion`, `notas`, `archivado`, `creadoEn`, `actualizadoEn`
- **locales**: `clienteId` (restrict), `nombre`, `direccion`, `ciudad`, `provincia`,
  `codigoPostal`, `telefono`, `personaContacto`, `horario`, `notasAcceso`, `archivado`, marcas de
  tiempo
- **tecnicos**: `nombre`, `apellidos`, `telefono`, `email`, `especialidades` (`text[]`, con un
  `CHECK` que solo admite las de `dominio.ts`), `zona`, `notas`, `archivado`, marcas de tiempo
- **avisos**:
  - identificación: `referencia` (`AV-2026-0001`, única), `clienteId` (restrict), `localId`
    (restrict), `tecnicoId` (restrict, opcional)
  - contenido: `titulo`, `descripcion`, `categoria`, `prioridad`, `estado`, `canalEntrada`,
    `contactoAviso`
  - fechas: `fechaAviso`, `fechaProgramada` (opcional), `horaProgramada` (opcional),
    `fechaCierre` (opcional)
  - cierre y espera: `motivoEspera`, `resumenCierre`
  - marcas de tiempo
- **partes**: `avisoId` (cascade), `tecnicoId` (restrict), `fecha`, `horas`,
  `trabajoRealizado`, `materiales`, `resuelto`, `observaciones`, marcas de tiempo
- **movimientos**: `avisoId` (cascade), `estadoAnterior`, `estadoNuevo`, `nota`, `fecha`,
  `usuarioId` (set null). Alimenta la cronología del aviso: qué se ha hecho, cuándo y quién
- **perfiles**: `id` (el mismo `uuid` que la cuenta en `auth.users`, cascade), `nombre`, `email`,
  `rol`, `tecnicoId` (único, set null: la ficha del técnico), `activo`, `debeCambiarContrasena`,
  `sesionesValidasDesde`, `ultimoAcceso`, marcas de tiempo. Un `CHECK` impide que lleve ficha
  quien no es técnico
- **intentos_acceso**: `email`, `ip`, `exito`, `fecha`. Los intentos de inicio de sesión de las
  últimas 24 horas, para frenar a quien prueba contraseñas
- **lecturas_ia**: `usuarioId` (cascade) y `fecha`. Quién ha pedido una lectura con IA y cuándo, en
  las últimas 24 horas, para el tope de uso por usuario. Nunca el mensaje
- **partes** lleva además `creadoPor` (set null): quién lo anotó, que puede no ser el técnico

**Tipos de fecha**
- Las fechas de calendario (`fechaProgramada`, `partes.fecha`) son `date` y la aplicación las lee
  como texto `YYYY-MM-DD`: es lo que devuelve un campo de fecha del navegador, se ordena solo y no
  se desplaza por la zona horaria.
- Los instantes (`fechaAviso`, `fechaCierre`, `movimientos.fecha` y las marcas de tiempo) son
  `timestamptz` y se leen como `Date`.
- `horaProgramada` es texto `HH:mm`, con un `CHECK` que rechaza horas imposibles.

**Vocabulario (`src/lib/dominio.ts`)**
- `estado`: `pendiente` · `asignado` · `en_curso` · `en_espera` · `finalizado` · `cancelado`
- `prioridad`: `baja` · `normal` · `alta` · `urgente`
- `categoria`: fontanería · electricidad · climatización · cerrajería · carpintería · pintura ·
  cristalería · albañilería · otros
- `canalEntrada`: teléfono · WhatsApp · email · presencial · otro
- `rol`: `administrador` · `oficina` · `tecnico`
- Utilidades:
  - en `dominio.ts`: `esEstadoFinal()`, `requiereMotivoEspera()`, `requiereResumenCierre()`,
    `totalHoras()`, las listas `OPCIONES_*` para los desplegables y los mapas `ESTADO` y
    `PRIORIDAD` con etiqueta y clases de color
  - en `fechas.ts`: `diasDeRetraso()`
  - en `consultas/avisos.ts`: `siguienteReferencia()`

**Reglas de negocio** (en `src/acciones/avisos.ts` y `src/acciones/partes.ts`)
- Al asignar un técnico a un aviso `pendiente`, pasa a `asignado`; al quitar el técnico, vuelve a
  `pendiente`.
- Salvo `pendiente` y `cancelado`, cualquier estado necesita un técnico asignado. Desde el panel de
  asignación, a un aviso en curso, en espera o finalizado se le puede cambiar el técnico, pero no
  quitárselo: hay que pasarlo antes a pendiente o cancelado.
- Una hora prevista necesita su día, tanto en el formulario del aviso como al asignar.
- Pasar a `en_espera` exige `motivoEspera`. Pasar a `finalizado` exige `resumenCierre` y fija
  `fechaCierre`.
- Un parte marcado como «resuelto» finaliza el aviso, con su texto como resumen. Un parte sobre un
  aviso `pendiente` o `asignado` lo pasa a `en_curso`.
- Cada cambio de estado escribe un registro en `movimientos`, en la misma transacción que el
  cambio: se guardan los dos o ninguno. El aviso se lee con `FOR UPDATE`, así que dos cambios
  simultáneos sobre el mismo aviso se hacen uno detrás de otro.
- Los desplegables de cliente, local y técnico solo ofrecen registros no archivados. Los ya
  asignados se siguen mostrando en los históricos.
- El borrado definitivo de un cliente, local o técnico se bloquea con un mensaje explícito si tiene
  avisos o partes. Borrar un aviso se lleva sus partes y movimientos, y la confirmación dice cuántos
  son.

---

## Usuarios, roles y permisos

Decidido con el usuario el 19-09-2026: tres roles, que salen de cómo se trabaja. La oficina recibe
los avisos y los reparte; los técnicos hacen las visitas y anotan los partes desde el móvil.

| Acción | Administrador | Oficina | Técnico |
|---|:-:|:-:|:-:|
| Panel | Completo | Completo | Su jornada (hoy, retrasados, en espera, su semana) |
| Ver avisos | Todos | Todos | Solo los asignados a su ficha |
| Crear, modificar, asignar y cancelar avisos; tablero | ✅ | ✅ | ❌ |
| Cambiar estado | Cualquiera | Cualquiera | Sus avisos asignados, en curso o en espera, a en curso, en espera o finalizado |
| Borrar avisos | ✅ | ❌ | ❌ |
| Partes | Todos | Todos (a nombre de cualquier técnico) | Los anota en sus avisos abiertos, siempre a su nombre; corrige y borra solo los suyos con el aviso abierto |
| Agenda | Completa | Completa | La suya |
| Clientes y locales: ver, crear, modificar, archivar | ✅ | ✅ | Solo lo del local, dentro del aviso |
| Borrar clientes y locales | ✅ | ❌ | ❌ |
| Técnicos: ver y corregir fichas | ✅ | ✅ | ❌ |
| Técnicos: alta, archivar, borrar | ✅ | ❌ | ❌ |
| Usuarios; cargar datos de ejemplo | ✅ | ❌ | ❌ |

Descartados: un rol de solo lectura (lo cubre el administrador en una empresa de este tamaño) y un
portal de clientes (es otro proyecto).

**Dónde se decide**: todas las reglas están en `src/lib/permisos.ts` (funciones puras, probadas en
`tests/permisos.test.ts`). Las usan tres capas, porque esconder un botón no basta:
- las **páginas** (`exigirUsuario` / `exigirPermiso` de `src/lib/sesion.ts`): lo que un rol no puede
  ver responde como página inexistente, igual que un aviso de otro técnico;
- las **acciones de servidor**, que se pueden llamar a mano: cada una comprueba el permiso y
  devuelve `SIN_PERMISO`; el técnico solo firma partes a su nombre aunque el formulario traiga otro;
- las **consultas**: el ámbito del técnico (`ambitoDe`) va con AND en la consulta, y ningún filtro
  de la URL lo amplía. Un técnico sin ficha vinculada no ve ningún aviso.

**Sesión**
- Inicia, renueva y cierra la sesión el servidor de Next (`@supabase/ssr`). La cookie es `httpOnly`,
  `sameSite=lax` y `secure` en producción. El navegador no recibe ninguna clave de Supabase.
- `src/proxy.ts` renueva el token en cada petición y manda al login a quien no lo tenga. Cada
  página y cada acción verifican después el token con `getClaims()` (firma ES256 con las claves
  públicas del proyecto) y leen el perfil de la base en cada petición: un cambio de rol o una
  desactivación se notan en el siguiente clic.
- **Revocar sesiones**: al restablecer la contraseña o desactivar a alguien se mueve
  `sesionesValidasDesde`, y cualquier sesión abierta antes (según el `amr` del token, que conserva el
  momento del acceso) deja de valer. Al cambiar uno su propia contraseña se cierran también sus
  sesiones en otros dispositivos.

**Contraseñas y altas**
- Sin registro público. El administrador crea el usuario y recibe una contraseña temporal
  (16 caracteres al azar, sin caracteres confusos) que se enseña una sola vez. El usuario tiene que
  cambiarla al entrar (`/cambiar-contrasena`) antes de ver nada más.
- Reglas: 12 caracteres como mínimo y 72 bytes como máximo (límite de bcrypt), minúscula, mayúscula,
  número y símbolo, sin contener el email ni un carácter repetido seis veces. Al elegirla se
  consulta Pwned Passwords por k-anonimato (solo viajan 5 caracteres de su huella SHA-1); si el
  servicio no responde, no se bloquea.
- Freno de intentos, en 15 minutos: 5 fallos con un email **desde una misma IP**, 30 con ese email
  desde donde sea, o 20 desde una IP con cualquier email, obligan a esperar. Los 5 van por email y
  por IP a propósito: contados solo por email, a quien supiera el de otra persona (el del único
  administrador) le bastaban 5 contraseñas inventadas cada cuarto de hora para dejarla fuera. Los 30
  son el tope contra quien reparte el ataque entre varias IP (lo encarece, no lo impide). El mensaje
  de error es siempre el mismo, exista o no el email. Lo tecleado en «email» que no tiene forma de
  email no se pregunta a Supabase ni se guarda (se anota «(no es un email)»): es un despiste
  corriente escribir ahí la contraseña. Un fallo de Supabase (caído, saturado) no cuenta como
  intento, ni al entrar ni al comprobar la contraseña actual en «Mi cuenta».
- Recuperar la contraseña la hace el administrador (restablecer). No hay correo: el SMTP de serie
  de Supabase solo envía a los miembros del equipo del proyecto.
- Un usuario no se borra, se desactiva (y se bloquea en Supabase Auth). Nadie puede quitarse su
  propio rol de administrador ni desactivarse, y siempre queda al menos un administrador activo.
- El primer administrador se crea con `pnpm usuarios:admin <email> "<nombre>"`.

**Cabeceras de seguridad**: CSP con nonce por petición (`src/lib/seguridad.ts`; scripts solo con
nonce, `frame-ancestors 'none'`, `form-action 'self'`), y en `next.config.ts` `X-Frame-Options`,
`X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy` y HSTS, sin `X-Powered-By`.

---

## Base de datos en Supabase

- **Dos proyectos**, los dos en eu-central-1 y con Postgres 17, iguales por dentro y con datos
  distintos:
  - **Producción**: «App de Partes» (ref `qiydpgnryyypnkhuqzyv`). Es el de la web publicada en
    Vercel. Sus claves están en `.env.produccion.local`.
  - **Desarrollo**: «App de Partes - Desarrollo» (ref `ujftpokeijrivicdwpnx`). Es contra el que se
    trabaja en local. Sus claves están en `.env.local`, que es lo que lee `pnpm dev`.

  Se mantienen iguales **por las migraciones**, no clonando la base: el de desarrollo se levantó
  aplicando las mismas cuatro de `supabase/migrations/`, con sus nombres y versiones, y la
  estructura de los dos da la misma huella (la consulta está en `AGENTS.md`). Lo que no viaja en las
  migraciones y hay que repetir en cada proyecto: la contraseña del rol `app_avisos`, la
  configuración de Auth y la clave secreta.

  Todos los scripts van a desarrollo salvo que se les diga `--entorno=produccion`, y `pnpm db:reset`
  —que vacía las tablas— se niega a tocar producción. La decisión vive en `scripts/entornos.ts` y se
  prueba en `tests/entornos.test.ts`. `pnpm datos:copiar` trae a desarrollo los datos de producción
  (sin los usuarios, que en desarrollo son de mentira: `pnpm usuarios:prueba`) y deja un respaldo en
  `respaldos/`, que en el plan free es la única copia de seguridad que hay.
- **Conexión**: `DATABASE_URL` en el archivo del entorno (plantilla en `.env.example`), por el pooler
  Supavisor en **modo sesión** (puerto 5432). El modo transacción (6543) no sirve con postgres.js:
  las consultas se quedan colgadas, y `src/db/cliente.ts` se niega a arrancar con él.
  Ese modo reserva una de las **15 conexiones** del proyecto por cada cliente conectado, y se las
  reparten la web publicada en Vercel y cualquier `pnpm dev` abierto, así que cada proceso abre
  como mucho **2** (`max: 2`, `idle_timeout: 10`). Con 10 por proceso se agotaron el 20-09-2026,
  nada más publicar en Vercel, y todas las pantallas con datos fallaron.
- **Rol `app_avisos`**: la aplicación entra con un rol propio que solo lee y escribe filas de sus
  tablas, sin poder crear, modificar ni borrar tablas. En `perfiles` no puede borrar; en
  `intentos_acceso`, `lecturas_ia` y `movimientos` no puede modificar (la cronología solo crece). Su contraseña no está en las migraciones: se generó en
  local y en Supabase solo se guardó su huella SCRAM.
- **API de datos cerrada**: la aplicación no usa PostgREST; `supabase-js` solo se usa para Auth.
  `anon` y `authenticated` no tienen permisos sobre las tablas y el RLS está activado en todas, con
  una política por tabla solo para `app_avisos`. Ni con la clave publicable ni con el token de un
  usuario que ha iniciado sesión se lee o se escribe nada.
- **Auth**: claves de firma asimétricas (ES256). En la configuración de Auth del proyecto el registro
  público está desactivado y las contraseñas exigen 12 caracteres y los cuatro tipos de carácter.
  Las variables `SUPABASE_URL` y `SUPABASE_PUBLISHABLE_KEY` no son secretas; `SUPABASE_SECRET_KEY`
  sí (solo la usa el servidor para gestionar usuarios).
- **Migraciones** (`supabase/migrations/`, con los mismos nombres y versiones que el historial de
  los dos proyectos): `esquema_inicial` y `usuarios`, generadas con `drizzle-kit` desde
  `src/db/esquema.ts`, y `acceso_app` y `acceso_usuarios`, escritas a mano (rol, permisos, RLS y
  políticas). Una migración nueva se aplica primero en desarrollo y, cuando funciona, en producción:
  hasta que está en los dos, no está terminada.
- El asesor de seguridad de Supabase solo da un aviso: «Leaked password protection disabled». Es la
  comprobación de contraseñas filtradas de Supabase, que solo existe en el plan Pro; la aplicación
  hace esa misma comprobación al elegir contraseña (`src/lib/filtraciones.ts`). Si el proyecto pasa
  a Pro, conviene activarla también en Auth. El asesor de rendimiento solo marca índices aún sin
  usar, que es lo normal con 42 avisos.

---

## Pantallas

**Navegación**
- En escritorio, una barra lateral que flota sobre el lienzo, con «Nuevo aviso» como una entrada
  más del menú y, abajo, quién ha entrado (lleva a «Mi cuenta») y el botón de salir. Encima del
  contenido hay una franja con la búsqueda rápida de avisos (se enfoca con la tecla «/» y busca
  también en los cerrados) y la fecha de hoy, que lleva a la agenda.
- En el móvil, una cabecera compacta con el botón «Aviso» y las iniciales del usuario (a «Mi
  cuenta»), y una barra inferior con 5 destinos: Inicio, Avisos, Agenda, Clientes y Técnicos. El
  tablero se abre desde el listado de avisos.
- Cada rol ve sus secciones (`enlacesDe` en `enlaces.ts`): el técnico, Inicio, Avisos y Agenda;
  «Usuarios», solo el administrador (en el móvil, desde «Mi cuenta»).

| Ruta | Contenido |
|---|---|
| `/` | Panel. Una fila de seis contadores (Sin cerrar, Sin asignar, Para hoy, Retrasados, Urgentes, En espera) que abren el listado ya filtrado, cada uno con su parte del trabajo abierto. Debajo, las horas anotadas en los partes (últimos 30 días frente a los 30 anteriores y un gráfico de las últimas 8 semanas con la media) y la agenda de la semana con las visitas de hoy y de la siguiente jornada. Al final: «Retrasados», «Esperando técnico», carga por técnico y últimos movimientos. Si la base está vacía, ofrece cargar los datos de ejemplo |
| `/avisos` | Listado con buscador y filtros. El buscador cubre referencia, título, descripción, cliente, local, ciudad, dirección y técnico, y no distingue acentos. Filtros: estado, prioridad, técnico, cliente, categoría y fechas, más vistas rápidas. Los filtros van en la URL para poder enlazarlos. Tabla en escritorio, tarjetas en el móvil |
| `/avisos/nuevo`, `/avisos/[id]/editar` | Formulario de aviso; el local depende del cliente elegido. Al crear, encima va el recuadro «Rellenar desde un mensaje» (ver «Lectura de mensajes con IA») |
| `/avisos/[id]` | Detalle: estado y prioridad, cliente y local con teléfono `tel:` clicable, descripción, cambio de estado en línea, asignación de técnico, fecha programada, partes con el total de horas, cronología y acciones |
| `/avisos/[id]/partes/nuevo`, `/avisos/[id]/partes/[parteId]/editar` | Formulario de parte de trabajo |
| `/avisos/[id]/imprimir` | Hoja A4 imprimible del aviso con todos sus partes; el CSS de impresión permite guardarla como PDF desde el navegador |
| `/agenda` | Semana con los avisos programados por día, filtro por técnico y paso a la semana anterior o siguiente. Un conmutador «Semana / Mes» cambia a la vista mensual (`?vista=mes&mes=YYYY-MM`): cada día muestra hasta tres visitas en el pastel de su estado, o dos y «+N más» si no caben, con una leyenda de los colores debajo, y pulsar un día abre su semana. Al cambiar de vista se sigue en la misma época y se conserva el técnico. Al final, el trabajo sin fecha. En el móvil, la semana es una lista agrupada por días y el mes pinta un punto por visita |
| `/tablero` | Kanban por estado. En escritorio se arrastran las tarjetas (dnd-kit con `DragOverlay`); en el móvil las columnas se recorren por pestañas |
| `/clientes`, `/clientes/nuevo`, `/clientes/[id]`, `/clientes/[id]/editar` | Listado con buscador; el detalle muestra sus locales y su historial de avisos |
| `/clientes/[id]/locales/nuevo`, `/locales/[id]`, `/locales/[id]/editar` | Gestión de locales |
| `/tecnicos`, `/tecnicos/nuevo`, `/tecnicos/[id]`, `/tecnicos/[id]/editar` | Listado con la carga de trabajo; el detalle muestra los avisos asignados y las horas dedicadas |
| `/login` | Email y contraseña, con el ojo para ver lo escrito. Tras entrar vuelve a la página que se pedía (`?siguiente=`, solo rutas internas) |
| `/cambiar-contrasena` | Parada obligatoria con una contraseña temporal, con la lista de requisitos que se marca al escribir |
| `/cuenta` | Mi cuenta: datos, rol, ficha vinculada, cambio de contraseña (pide la actual) y salir |
| `/usuarios`, `/usuarios/nuevo`, `/usuarios/[id]` | Solo administrador: listado (rol, ficha, desactivado, contraseña temporal, último acceso), alta con la contraseña temporal a la vista una vez, cambio de rol y ficha, restablecer contraseña y desactivar |

Las pantallas de la aplicación están en el grupo de rutas `(app)`, cuyo layout pinta el menú del
usuario; `/login` y `/cambiar-contrasena` están en `(acceso)`, sin menú.

**Diseño** (rediseño del 18-09-2026, tomando como referencia la captura de un panel que pasó el
usuario)
- Paneles blancos muy redondeados que flotan sobre un lienzo gris salvia, sin sombras debajo de
  cada bloque: lo que los separa es el lienzo.
- Los colores tienen cuatro papeles fijos, definidos como tokens en `globals.css` (`@theme`):
  - `gris`: neutros con un punto de salvia, con las mismas luminancias que `slate` para no perder
    contraste
  - `marca`: verde bosque para las acciones (botón principal, enlaces, foco)
  - `lima`: lo seleccionado (sección activa del menú, filtro elegido, casilla marcada)
  - `coral`: lo que pide atención (urgente, retrasado, borrar)
- Cada estado del aviso tiene su pastel, como los imanes de un tablero de planificación:
  pendiente en mantequilla, asignado en pervinca, en curso en lima, en espera en orquídea,
  finalizado en menta y cancelado en gris. Las tarjetas de la agenda y del tablero toman ese
  color, y siempre llevan también el nombre del estado. En el mes de la agenda, donde no cabe,
  lo dan la leyenda y el texto al pasar el ratón. El reparto está en `src/lib/dominio.ts`.
- Tipografía Instrument Sans con `next/font`, cargada con su eje de anchura: las cifras grandes
  (clase `.cifra`) van algo estrechas, como en un marcador. Sin mayúsculas en las etiquetas.
- Radios con jerarquía: panel 22 px, tarjeta 16 px, control 12 px y etiquetas en píldora.
- El único movimiento que no pide nadie son las barras del gráfico de horas, que crecen al abrir
  el panel. Se desactiva con «reducir movimiento».
- Pensado primero para el móvil:
  - botones y enlaces de al menos 44 px
  - campos de texto a 16 px, para que iOS no haga zoom
  - teclado adecuado a cada campo (`inputMode`) y `<input type="date">`
  - sin scroll horizontal a 375 px
- Componentes propios en `src/componentes/ui`: `Boton`, `Campo` (entrada, área de texto,
  selector, casilla), `Etiqueta` (insignias de estado, prioridad, retraso y archivado), `Tarjeta`,
  `Dialogo`, `Buscador`, `SelectorUrl`, `EstadoVacio`, `EncabezadoPagina`, `BotonBorrar` y
  `BotonArchivar`.
- Los formularios usan `useActionState`: errores por campo en español, estado de envío y sin perder
  lo escrito cuando falla la validación.
- Los estados vacíos proponen una salida, por ejemplo «Aún no hay avisos → Crear el primero».
- Un error inesperado muestra una pantalla propia en español (`app/error.tsx`) con «Reintentar» y
  «Volver al panel», sin perder la navegación. Si falla el propio layout raíz, lo cubre
  `app/global-error.tsx`.

---

## Lectura de mensajes con IA

Pedido por el usuario el 19-09-2026: pegar en «Nuevo aviso» el mensaje que manda un cliente por
WhatsApp o por email y que la IA rellene el formulario. La persona de la oficina revisa, corrige y
registra el aviso como siempre.

- **Qué rellena**: cliente, local, título, descripción, tipo de trabajo, prioridad, canal de entrada
  y quién avisa. No toca el técnico, el estado ni las fechas.
- **No guarda nada del mensaje ni de la propuesta.** La acción `leerMensaje`
  (`src/acciones/lectura.ts`) devuelve una propuesta y `FormularioAviso` la escribe en sus campos.
  Lo único que anota en la base es quién ha pedido la lectura y cuándo (`lecturas_ia`), para el tope. El aviso se crea con el botón
  «Registrar aviso» y la acción `crearAviso`, con todas sus validaciones.
- **Sin inventar el sitio**: si la IA no tiene claro el cliente o el local, lo deja en blanco (y lo
  que hubiera elegido antes también se vacía) y explica qué le falta («El Horno de Lucía tiene tres
  locales y el mensaje no dice cuál»). Cuando sí lo sitúa, dice en qué se ha basado. Además, el
  servidor contrasta la respuesta con el catálogo (`ajustarLectura`): descarta ids que no existen y
  un local que no es de ese cliente, deduce el cliente a partir del local y completa el local cuando
  el cliente solo tiene uno.
- **Dudas**: lo que convenga revisar (una prioridad o un canal dudosos) sale en un aviso en coral
  bajo el botón.
- **Quién**: los que pueden crear avisos (`gestionarAvisos`: administrador y oficina).
- **Tope de uso**: 20 lecturas por minuto y 300 por día **por usuario** (`lecturaPermitida`, en
  `src/db/consultas/usuarios.ts`). Cada lectura es una llamada de pago y la acción se puede llamar a
  mano sin pasar por el botón: sin tope, una cuenta de oficina robada o un bucle gastaban el saldo.
  Se cuenta y se anota en una transacción bajo un cerrojo por usuario (`pg_advisory_xact_lock`), para
  que una ráfaga en paralelo no se cuele, y antes de llamar a la IA: una lectura que falla también
  cuenta. La otra red es el límite de gasto de la clave en OpenRouter.
- **Cómo**: una sola llamada a la API de chat de OpenRouter desde el servidor
  (`src/lib/openrouter.ts`, `server-only`, con `fetch` y sin SDK). El modelo sale de
  `OPENROUTER_MODELO` y, si no está, es `google/gemini-3-flash-preview` (Gemini 3 Flash, elegido
  por el usuario: con salida estructurada en todos sus proveedores y menos de un céntimo por
  mensaje; responde en unos 2 o 3 segundos). La salida estructurada va en modo estricto: la
  respuesta tiene que cumplir `ESQUEMA_SALIDA`, con las categorías, prioridades y canales de
  `dominio.ts`. Con `require_parameters: true`, OpenRouter solo la manda a proveedores que admiten
  ese esquema, y si el proveedor elegido falla prueba con otro. Un minuto de espera como mucho.
- **Qué se envía y a quién**: el mensaje y el catálogo de clientes y locales activos con nombre,
  dirección, ciudad, persona de contacto, teléfono y email, que es lo que permite reconocer el local.
  Pasa por OpenRouter y llega al proveedor del modelo, pero solo a proveedores que no guardan ni
  entrenan con los datos (`data_collection: 'deny'`). Si hace falta más, en la configuración de
  privacidad de OpenRouter se puede exigir retención cero (ZDR) para toda la cuenta. Las
  instrucciones y el catálogo van en el mensaje de sistema, sin nada que cambie entre peticiones,
  para que los proveedores con caché la aprovechen. En el registro del servidor solo queda el código
  de error y el motivo que da OpenRouter, nunca el mensaje.
- **Errores**: cada fallo sale en el recuadro con un texto claro: clave no válida (401), sin saldo
  (402), modelo que no existe o sin proveedores que cumplan lo pedido (404), demasiadas peticiones
  (429), respuesta rechazada, cortada o que no cumple el esquema.
- **El mensaje del cliente es un dato, no una orden**: va marcado aparte y las instrucciones le dicen
  a la IA que no obedezca lo que diga. Aunque lo hiciera, solo puede proponer valores válidos, y los
  revisa una persona.
- **Límites**: mensajes de hasta 4000 caracteres. Sin `OPENROUTER_API_KEY` en `.env.local`, el
  recuadro responde que la IA no está activada y el resto funciona igual.

---

## Estructura

```
src/
  app/(app)/           rutas tras el login (panel, avisos, partes, agenda, tablero, clientes, locales,
                       tecnicos, usuarios, cuenta) y su layout con el menú
  app/(acceso)/        login y cambiar-contrasena
  proxy.ts             renueva la sesión, manda al login y pone la CSP
  acciones/            Server Actions: clientes, locales, tecnicos, avisos, partes, datos, sesion, usuarios,
                       lectura (IA)
  componentes/         ui/ (base) + avisos/, partes/, clientes/, tecnicos/, panel/, agenda/, tablero/,
                       navegacion/, acceso/, usuarios/
  db/                  esquema.ts, cliente.ts (conexión), consultas/ (con usuarios.ts), semilla.ts
  lib/                 dominio.ts, permisos.ts, sesion.ts, sesiones.ts, contrasenas.ts, filtraciones.ts,
                       seguridad.ts, supabase/ (clientes de Auth), validaciones.ts, fechas.ts, filtros.ts,
                       lecturaMensaje.ts y openrouter.ts (lectura con IA)…
supabase/migrations/   migraciones SQL aplicadas en los dos proyectos (y meta/ de drizzle-kit)
scripts/               entornos.ts (desarrollo o producción, y las guardias) y entorno.ts (las carga);
                       seed.ts (datos de ejemplo), copiar-datos.ts (producción -> desarrollo),
                       usuarios-prueba.ts (un usuario por rol) y crear-admin.ts (primer administrador)
tests/                 pruebas de dominio, fechas, filtros, permisos, validaciones, consultas y acciones
                       (estas dos, sobre PGlite) y lectura con IA (sin llamar a la API); ayudas/ monta
                       la base en memoria y sustituye Next y Supabase
.env.local             claves de Supabase en desarrollo (no se versiona; plantilla en .env.example)
.env.produccion.local  lo mismo para producción; solo lo leen los scripts con --entorno=produccion
respaldos/             copias de producción que deja «pnpm datos:copiar» (no se versionan)
```

---

## Datos de ejemplo

Se cargan con `pnpm db:reset` (o su alias `pnpm db:seed`) o con el botón del panel cuando la base
está vacía. Se insertan de una vez por tabla, en una sola transacción: contra Supabase tardan en
torno a un segundo. Las fechas se calculan **respecto al día en que se cargan**, para que el panel, la agenda y
el kanban tengan siempre contenido realista.

- **8 clientes** (cadena de panaderías, franquicia de cafeterías, gimnasio, clínica dental, tienda
  de ropa, restaurante, supermercado y peluquería) con **18 locales** en varias ciudades
- **6 técnicos** con especialidades distintas (fontanería, electricidad, climatización, cerrajería
  y multiservicio), uno de ellos archivado para ver ese caso
- **42 avisos** repartidos por todos los estados:
  - sin asignar
  - programados para hoy y para esta semana
  - en curso
  - en espera por falta de material o porque no hay acceso al local
  - finalizados de semanas anteriores
  - alguno cancelado
  - varios retrasados, para que el contador de retrasos no salga vacío
- **22 partes** en los avisos en curso y finalizados, con horas, materiales y trabajo realizado
  creíbles, y **99 movimientos** en las cronologías
- `db:reset` vacía las seis tablas de datos, reinicia la numeración de los ids y recarga los datos.
  Trabaja sobre la base de Supabase, así que se lleva por delante lo que haya. Los usuarios se
  conservan, pero los técnicos pierden el vínculo con su ficha (las fichas se crean de nuevo) y hay
  que volver a vincularlos en «Usuarios»
- El botón del panel («Cargar datos de ejemplo») es otra cosa: solo lo ve el administrador, solo
  cuando no hay clientes, y **no borra nada** (`sembrar({ limpiar: false })`). Existe también en
  producción, y «sin clientes» no es «sin nada»: los técnicos que ya estuvieran dados de alta se
  conservan, con su vínculo al usuario, y conviven con los de ejemplo

---

## Fases de implementación

Todas están completadas.

1. **Andamiaje**: proyecto Next + Tailwind v4 + TypeScript, tokens de diseño, layout con
   navegación para escritorio y móvil, componentes base de UI y `.gitignore`
2. **Datos**: esquema Drizzle, conexión SQLite, `dominio.ts`, validaciones zod, consultas y datos
   de ejemplo
3. **Clientes y locales**: listados con buscador, detalles, formularios, archivar y borrado
   protegido
4. **Técnicos**: listado, detalle con la carga de trabajo, formularios, archivar y borrado
   protegido
5. **Avisos**: listado con buscador y filtros en la URL, detalle, formularios y cambios de estado
   con sus reglas y su registro en `movimientos`
6. **Partes de trabajo**: alta, edición y borrado desde el aviso, suma de horas y hoja imprimible
7. **Panel, agenda y tablero**: contadores enlazados, semana por días y kanban con arrastre
8. **Repaso final**:
   - revisión en el móvil, de los estados vacíos y de los errores de formulario
   - `typecheck`, `lint` y `build` sin errores
   - `README.md` en español
9. **Migración a Supabase** (19-09-2026): esquema en `pg-core`, migraciones aplicadas con el
   conector de Supabase, rol `app_avisos` con RLS, transacciones asíncronas con `FOR UPDATE`,
   siembra por lotes, pruebas sobre PGlite y datos de ejemplo cargados en el proyecto
10. **Inicio de sesión y roles** (19-09-2026): Supabase Auth desde el servidor, tablas `perfiles` e
    `intentos_acceso`, autoría en la cronología y en los partes, permisos en páginas, acciones y
    consultas, gestión de usuarios, cambio obligatorio de la contraseña temporal, freno de intentos
    y cabeceras de seguridad
11. **Lectura de mensajes con IA** (19-09-2026): recuadro en «Nuevo aviso», acción `leerMensaje`,
    llamada a la IA con salida estructurada y comprobación de la respuesta contra el catálogo. El
    mismo día se cambió el proveedor de Anthropic a OpenRouter, a petición del usuario

---

## Verificación

**Automática**

```bash
pnpm typecheck && pnpm lint && pnpm build
```

- `pnpm test` (node:test + tsx) lanza 213 pruebas sobre el dominio, las fechas, los filtros, los
  permisos, las contraseñas, la sesión, las validaciones de los formularios, las consultas (también
  lo que ve un técnico, en el listado y en la agenda) y las acciones de servidor. Las de consultas y
  acciones montan un Postgres en memoria (PGlite) con las migraciones de `supabase/migrations/`, así
  que no tocan Supabase.
  - `consultas.test.ts` compara cada recuento y suma del panel (también las horas por semana del
    gráfico), el listado y los técnicos con un cálculo hecho en JavaScript, y comprueba la
    cronología de cada aviso, la numeración de referencias, el reinicio de los ids y el orden de la
    agenda.
  - `acciones-avisos.test.ts` recorre las reglas de estado de avisos y partes (con su línea en la
    cronología y quién la hizo), lo que puede cada rol y que el cambio y su cronología se guardan
    juntos o ninguno (con un disparador que hace fallar la cronología).
  - `acciones-fichas.test.ts`: borrado protegido, archivado y carga de los datos de ejemplo.
  - `acciones-usuarios.test.ts`: quién puede actuar (desactivados, contraseña temporal, sesiones
    anuladas), la gestión de usuarios, el inicio de sesión con su freno de intentos y el cambio de
    contraseña, contra un Supabase Auth de mentira.
  - `acciones-lectura.test.ts`: la lectura con IA de punta a punta con un `fetch` de mentira: la
    petición a OpenRouter (con `data_collection: 'deny'`), los errores y que no se guarda nada.

**Manual, recorriendo la app (`pnpm db:reset && pnpm dev`)**. Tras la migración se recorrieron
de nuevo los puntos 2 a 6 y 11 contra Supabase, comprobando cada cambio también con SQL.

1. Panel: los contadores cuadran con el listado y cada uno abre el filtro correcto.
2. Crear un aviso nuevo: aparece en Pendientes y en el kanban.
3. Asignar técnico y fecha: pasa a Asignado y sale en la agenda ese día, en la semana y en el
   mes. Pulsar ese día en el mes abre su semana.
4. Pasar a En espera sin motivo da un error de validación. Con motivo, cambia y queda en la
   cronología.
5. Añadir dos partes de trabajo: el total de horas suma. Editar y borrar uno.
6. Finalizar exige un resumen, fija la fecha de cierre y el aviso desaparece de los pendientes.
7. Imprimir la hoja del aviso con la vista previa de impresión del navegador.
8. Buscar por referencia, por texto de la descripción y por nombre de cliente.
9. Kanban: arrastrar una tarjeta entre columnas y comprobar que el cambio sigue ahí al recargar.
10. Archivar un cliente: desaparece de los desplegables, pero su historial sigue accesible.
11. Intentar borrar ese cliente con avisos se bloquea con un mensaje claro. Borrar un aviso se lleva
    sus partes.
12. Reiniciar el servidor y comprobar que todo lo creado sigue ahí.
13. En «Nuevo aviso», pegar «Hola, soy Marta, de la panadería de la calle Mayor. El horno grande no
    calienta desde esta mañana y tenemos pedidos para las 12, ¡urgente!» y pulsar «Rellenar con IA»:
    sale El Horno de Lucía — Centro, prioridad urgente y Marta como contacto, y no se ha creado
    ningún aviso hasta pulsar «Registrar aviso». Con «Hola, soy de la panadería, el horno no va», el
    local queda en blanco con el aviso de que tiene tres.

**Acceso y roles**
1. Sin sesión, cualquier página lleva al login, y tras entrar se vuelve a ella.
2. Un email o una contraseña mal escritos dan el mismo mensaje; al sexto fallo hay que esperar.
3. Un usuario nuevo entra con la contraseña temporal y no puede hacer nada hasta cambiarla.
4. El técnico ve solo sus avisos, su agenda y su panel; un aviso de otro, `/clientes` o `/usuarios`
   responden como página inexistente. Puede pasar sus avisos a en curso, en espera o finalizado y
   anotar partes a su nombre.
5. La oficina no ve «Usuarios» ni los botones de borrar.
6. Restablecer la contraseña o desactivar a un usuario cierra al momento la sesión que tuviera abierta.

**Móvil**: recorrido completo a 390×844 en el navegador integrado. Hay que comprobar que no aparece
scroll horizontal ni hay textos cortados en el panel, el listado, el detalle del aviso y el
formulario de parte.

---

## Pendiente para producción

Los datos ya están en PostgreSQL (Supabase) y cada persona entra con su usuario. Antes de abrir la
aplicación fuera de la oficina faltan:

- una **política de copias de seguridad** del historial: el plan free de Supabase no hace ninguna,
  y de momento lo único que hay son los respaldos que deja `pnpm datos:copiar` en `respaldos/`
- en Vercel, las variables están puestas a la vez en `production` y en `preview`, así que un
  despliegue de vista previa escribiría en la base de producción. Mientras todo vaya por `main` no
  llega a pasar; con ramas, hay que apuntar `preview` al proyecto de desarrollo
- un **SMTP propio** en Supabase si se quiere que cada usuario recupere su contraseña por email
- un **segundo factor** (TOTP) para las cuentas de administrador
- revisar el **tratamiento de datos** de la lectura con IA: envía a OpenRouter y al proveedor del
  modelo el mensaje del cliente y los datos de contacto de clientes y locales (ver «Lectura de
  mensajes con IA»)
- **desplegar** el servidor de Next.js con HTTPS. Si es en una plataforma serverless, revisar la
  conexión (el modo sesión del pooler reserva una conexión por cliente) y el freno de intentos, que
  toma la IP de `x-forwarded-for`: detrás de un proxy hay que fiarse solo de la que pone la plataforma

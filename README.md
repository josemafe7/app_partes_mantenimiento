# Avisos y partes de trabajo

Aplicación de gestión para una empresa de mantenimiento de locales. Sustituye el reparto de trabajo
por teléfono y WhatsApp por un registro único: **clientes** con sus **locales**, **técnicos**,
**avisos** con estado y fecha, y **partes de trabajo** con lo realizado en cada visita.

Todo en español, pensada para usarse en el móvil a pie de obra y en el ordenador de oficina.
Cada persona entra con su usuario, y lo que ve y puede hacer depende de su rol: **administrador**,
**oficina** o **técnico**. Tiene una sola función de IA, opcional: al crear un aviso, se pega el
WhatsApp o el email del cliente y la IA rellena el formulario para revisarlo antes de guardar.

---

## Arrancar

Hace falta **Node 22** o posterior y **pnpm**.

```bash
pnpm install
```

Los datos y los usuarios viven en **Supabase** (PostgreSQL y Supabase Auth). Hay **dos proyectos**:
«App de Partes» para producción y «App de Partes - Desarrollo» para trabajar en local (ver
[Los dos entornos](#los-dos-entornos)). En local se trabaja siempre contra el de desarrollo.

La aplicación lee sus claves de `.env.local`, que no se sube al repositorio. Si no lo tienes, copia
`.env.example` como `.env.local` (ya trae los valores del proyecto de desarrollo) y rellena las dos
claves secretas:

- `DATABASE_URL`: la contraseña del rol `app_avisos` (más abajo se explica cómo cambiarla).
- `SUPABASE_SECRET_KEY`: la clave secreta del proyecto. Se crea en Supabase, en **Project Settings →
  API Keys → Secret keys**. Da acceso total al proyecto: no se comparte ni se pega en ningún chat.
- `OPENROUTER_API_KEY` (opcional): la clave de OpenRouter para leer los mensajes con IA. Se crea en
  <https://openrouter.ai/keys>, mejor con un límite de gasto. También es secreta. Sin ella, todo
  funciona igual salvo ese recuadro. Con `OPENROUTER_MODELO` se puede cambiar el modelo (por
  defecto, `google/gemini-3-flash-preview`).

```bash
pnpm dev
```

Y abrir <http://localhost:3000>. Sin sesión, la aplicación lleva al login.

**Para entrar en desarrollo** hay tres usuarios de prueba, uno por rol:

```bash
pnpm usuarios:prueba
```

Escribe en la terminal las contraseñas de `admin@example.com`, `oficina@example.com` y
`tecnico@example.com`, una sola vez. Se puede repetir después de `pnpm db:reset` o de
`pnpm datos:copiar`, y con `--renovar` da contraseñas nuevas si se han perdido.

**El primer administrador de producción** se crea desde la terminal (los demás usuarios, desde la
aplicación):

```bash
pnpm usuarios:admin --entorno=produccion tu@email.com "Nombre y apellidos"
```

Escribe en la terminal una contraseña temporal. Al entrar con ella, la aplicación pide elegir una
propia.

Las tablas ya están creadas en Supabase y cargadas con los **datos de ejemplo** (8 clientes, 18
locales, 6 técnicos, 42 avisos y 22 partes de trabajo, con fechas calculadas respecto al día en que
se cargan). Si la base está vacía, el panel ofrece un botón para cargarlos.

Para volver a dejarlo todo como al principio, con las fechas recalculadas respecto a hoy:

```bash
pnpm db:reset
```

Trabaja sobre la base de **desarrollo** y borra todo lo que hubiera en ella. Contra producción se
niega a ejecutarse.

Y para trabajar con lo que hay en la aplicación de verdad, en lugar de con los datos de ejemplo:

```bash
pnpm datos:copiar
```

Copia los datos de producción a desarrollo (y deja antes un respaldo en `respaldos/`).

---

## Qué hace

| Pantalla | Para qué sirve |
| --- | --- |
| **Inicio** (`/`) | Los contadores de un vistazo: sin cerrar, sin asignar, para hoy, retrasados, urgentes y en espera. Cada uno abre el listado ya filtrado. Debajo, lo de hoy, lo retrasado, lo que espera técnico, la carga de cada uno y los últimos movimientos. |
| **Avisos** (`/avisos`) | Listado con buscador y filtros. Tarjetas en el móvil, tabla en el escritorio. Los filtros viven en la dirección, así que el enlace se puede guardar o mandar por WhatsApp. |
| **Nuevo aviso** (`/avisos/nuevo`) | Arriba, un recuadro para pegar el WhatsApp o el email del cliente: la IA propone el cliente, el local, el título, la descripción, el tipo de trabajo, la prioridad, el canal y quién avisa. No guarda nada: se revisa y se registra como siempre. Si no tiene claro el cliente o el local, lo deja en blanco y lo dice. |
| **Ficha del aviso** | La incidencia, el técnico y la fecha, los partes de trabajo con el total de horas, la cronología completa y el teléfono del local para llamar de un toque. |
| **Partes de trabajo** | Cada visita se anota aparte: fecha, horas, trabajo realizado, materiales y observaciones. Al marcar «la incidencia queda resuelta» el aviso se cierra solo con ese texto como resumen. |
| **Hoja imprimible** | Una hoja A4 del aviso con todos sus partes, lista para imprimir o guardar en PDF y entregar al cliente. |
| **Agenda** (`/agenda`) | La semana repartida por días o el mes entero, con filtro por técnico, y al final el trabajo que todavía no tiene fecha. En el mes, cada día muestra sus visitas con el color de su estado y, al pulsarlo, abre esa semana. |
| **Tablero** (`/tablero`) | Columnas por estado. En el escritorio se arrastran las tarjetas para cambiar el estado; en el móvil se navega por pestañas y el estado se cambia desde la ficha. |
| **Clientes y locales** | El cliente es la empresa; de él cuelgan sus locales, cada uno con dirección, contacto, horario y notas de acceso. Los avisos se abren siempre sobre un local. |
| **Técnicos** | Con sus especialidades y zona. Al asignar un aviso, los que tienen la especialidad del trabajo aparecen destacados. Su ficha muestra la carga, los avisos y las horas del último mes. |
| **Usuarios** (`/usuarios`) | Solo el administrador. Da de alta a cada persona con su rol, vincula a cada técnico con su ficha, restablece contraseñas olvidadas y desactiva a quien ya no debe entrar. |
| **Mi cuenta** (`/cuenta`) | Los datos de quien ha entrado, el cambio de contraseña y la salida. |

### Usuarios y permisos

| | Administrador | Oficina | Técnico |
| --- | :-: | :-: | :-: |
| Panel | Completo | Completo | Su jornada |
| Avisos | Todos | Todos | Solo los suyos |
| Crear, modificar, asignar y cancelar avisos | ✅ | ✅ | — |
| Cambiar el estado | A cualquiera | A cualquiera | Sus avisos en marcha, a en curso, en espera o finalizado |
| Borrar un aviso | ✅ | — | — |
| Partes de trabajo | Todos | Todos | Los anota en sus avisos abiertos; corrige solo los suyos |
| Agenda | Completa | Completa | La suya |
| Tablero | ✅ | ✅ | — |
| Clientes y locales (ver, crear, modificar, archivar) | ✅ | ✅ | Solo los datos del local, desde el aviso |
| Borrar clientes y locales sin historial | ✅ | — | — |
| Técnicos: ver y corregir su ficha | ✅ | ✅ | — |
| Técnicos: alta, archivar y borrar | ✅ | — | — |
| Usuarios y datos de ejemplo | ✅ | — | — |

- **Nadie se registra solo.** El administrador crea cada usuario y recibe una contraseña temporal,
  que se enseña una sola vez y se da en mano. El usuario la cambia al entrar.
- **Contraseñas**: al menos 12 caracteres, con minúsculas, mayúsculas, números y algún símbolo, sin
  contener el email. Al elegirla se comprueba que no aparezca en filtraciones de datos conocidas.
- **Tras 5 intentos fallidos** con un email desde un mismo sitio (o 20 desde ese sitio con cualquier
  email, o 30 con ese email desde donde sea), hay que esperar 15 minutos. Fallar con el email de otra
  persona no la deja fuera a ella.
- **Un usuario no se borra, se desactiva**: no puede entrar y sus sesiones se cierran al momento,
  pero su nombre se conserva en la cronología de los avisos, que dice quién hizo cada cambio.
- **Restablecer la contraseña** de alguien cierra todas sus sesiones abiertas.

### Cómo avanza un aviso

```
Pendiente → Asignado → En curso → Finalizado
                ↕
            En espera                 (y Cancelado desde cualquier punto)
```

- Asignar un técnico a un aviso pendiente lo pasa a **Asignado**; quitarlo lo devuelve a
  **Pendiente**.
- **En espera** exige explicar el motivo (falta material, falta presupuesto, no hay acceso al local).
- **Finalizado** exige un resumen de lo realizado y guarda la fecha de cierre.
- Un aviso no puede pasar de pendiente sin técnico asignado.
- Cada cambio queda anotado en la cronología del aviso.

### Archivar y eliminar

Clientes, locales y técnicos se pueden **archivar**: desaparecen de los listados y de los
desplegables, pero su historial sigue intacto y accesible. El borrado definitivo existe, y se
**bloquea con un mensaje claro** si hay avisos o partes vinculados. Borrar un aviso sí se lleva sus
partes y su cronología, avisando antes de cuántos son.

---

## Cómo está hecho

Next.js 16 (App Router) con React 19, TypeScript y Tailwind CSS v4. Los datos se leen desde
componentes de servidor y se escriben con acciones de servidor: no hay una API propia que mantener.
La base de datos es **PostgreSQL en Supabase** con **Drizzle ORM**. El servidor se conecta
directamente a Postgres (por el pooler de Supabase), no a través de la API de datos.

```
src/
  app/            Las rutas y las pantallas
    (acceso)/     El login y la primera contraseña, sin menú
    (app)/        Todo lo demás, detrás del inicio de sesión
  proxy.ts        Antes de cada petición: renueva la sesión y aplica la política de seguridad
  componentes/    ui/ (piezas base) + avisos/, partes/, clientes/, tecnicos/, usuarios/, acceso/…
  acciones/       Acciones de servidor: crear, modificar, archivar, eliminar, sesión y usuarios
  db/             esquema.ts, cliente.ts (conexión), consultas/, semilla.ts (datos de ejemplo)
  lib/            dominio.ts, permisos.ts, sesion.ts, validaciones.ts, fechas.ts, filtros.ts,
                  lecturaMensaje.ts y openrouter.ts (lectura con IA)…
supabase/
  migrations/     Las migraciones SQL aplicadas en Supabase
tests/            Pruebas de fechas, dominio, filtros y consultas
```

Tres archivos concentran las decisiones del negocio y son el mejor sitio por donde empezar a
tocar:

- **`src/lib/dominio.ts`** — estados, prioridades, tipos de trabajo, canales de entrada,
  especialidades y roles, con sus etiquetas y sus colores. Añadir un estado o cambiar un color se
  hace aquí y no en las pantallas.
- **`src/lib/permisos.ts`** — qué puede hacer cada rol. Lo usan las pantallas, las acciones y las
  consultas, así que cambiar un permiso se hace en un solo sitio.
- **`src/lib/validaciones.ts`** — qué se exige en cada formulario y con qué mensaje.
- **`src/db/esquema.ts`** — las tablas, sus relaciones y las reglas que protege la propia base de
  datos.

### Detalles que conviene saber

- **Las fechas de calendario son `date` y la aplicación las maneja como texto `YYYY-MM-DD`.** Es lo
  que devuelve un campo de fecha del navegador, se ordena solo y nunca se desplaza un día por la
  zona horaria.
- **La búsqueda ignora acentos.** «climatizacion» encuentra «climatización», porque a pie de obra
  se escribe deprisa. Se resuelve en memoria con la misma función en todos los buscadores.
- **La propia base protege las reglas**: los vocabularios con `CHECK`, el borrado protegido y el
  borrado en cascada con claves ajenas, y cada cambio de estado se guarda en la misma transacción
  que su anotación en la cronología.
- **La IA solo propone.** Lee el mensaje en el servidor (el navegador nunca ve la clave), a través
  de OpenRouter y solo con proveedores que no guardan ni usan los datos para entrenar. Lo que
  devuelve se contrasta con los clientes y locales de verdad antes de rellenar nada. Para reconocer
  el local se le envían los nombres, direcciones, personas de contacto, teléfonos y emails de los
  clientes y locales activos, además del mensaje.
- **Todas las pantallas se generan en cada visita.** No hay nada cacheado: lo que se ve es lo que
  hay en la base de datos.

---

## Comandos

| Comando | Qué hace |
| --- | --- |
| `pnpm dev` | Arranca la aplicación en <http://localhost:3000> |
| `pnpm build` · `pnpm start` | Compila y arranca la versión de producción |
| `pnpm db:reset` | Vacía la base de **desarrollo** y carga los datos de ejemplo (`db:seed` hace lo mismo) |
| `pnpm db:generar` | Genera la migración SQL en `supabase/migrations/` tras cambiar `src/db/esquema.ts` |
| `pnpm entornos` | Dice a qué proyecto apunta cada entorno y si conecta (no escribe nada) |
| `pnpm datos:copiar` | Copia los datos de producción a desarrollo, con respaldo previo en `respaldos/` |
| `pnpm usuarios:prueba` | Crea en desarrollo un usuario de cada rol (`--renovar` cambia sus contraseñas) |
| `pnpm usuarios:admin <email> "<nombre>"` | Crea un administrador con una contraseña temporal (el primero, o si no queda ninguno) |
| `pnpm test` | Pruebas de fechas, dominio, filtros, permisos, contraseñas, validaciones, consultas y acciones de servidor (estas dos, sobre un Postgres en memoria) y la lectura con IA (sin llamar a la API) |
| `pnpm typecheck` · `pnpm lint` | Tipos y estilo |

---

## Los dos entornos

Hay dos proyectos de Supabase, iguales por dentro y con datos distintos:

| | Producción | Desarrollo |
| --- | --- | --- |
| Proyecto | «App de Partes» (`qiydpgnryyypnkhuqzyv`) | «App de Partes - Desarrollo» (`ujftpokeijrivicdwpnx`) |
| Quién lo usa | La web publicada en Vercel | `pnpm dev` y los scripts de la terminal |
| Archivo de claves | `.env.produccion.local` | `.env.local` |
| Datos | Los de verdad | Los de ejemplo, o una copia de producción |

**Lo normal va a desarrollo.** `pnpm dev`, `pnpm db:reset`, `pnpm usuarios:prueba` y el destino de
`pnpm datos:copiar` trabajan sobre `.env.local` sin que haya que decir nada. Para ir a producción
hay que escribirlo:

```bash
pnpm usuarios:admin --entorno=produccion tu@email.com "Nombre y apellidos"
```

Y hay dos barreras para que un descuido no se lleve por delante los datos de verdad:

- **`pnpm db:reset` se niega a tocar producción.** Vacía las tablas antes de sembrarlas, así que ni
  con `--entorno=produccion` basta: hace falta además `--si-borrar-produccion`, que nadie escribe
  sin querer. La comprobación está en `scripts/entornos.ts` y se prueba en `tests/entornos.test.ts`.
- **La base y Supabase Auth tienen que ser del mismo proyecto.** Si un archivo mezcla el
  `DATABASE_URL` de uno con el `SUPABASE_URL` de otro, los scripts se paran: si no, la aplicación
  leería los datos de un sitio y crearía los usuarios en el otro.

Para saber en cualquier momento sobre qué base estás trabajando, que con dos proyectos iguales por
dentro no se ve a simple vista:

```bash
pnpm entornos
```

Ojo con una cosa: si cambias a qué proyecto apunta `.env.local` con `pnpm dev` abierto, **hay que
reiniciarlo**. Next recarga las variables, pero la conexión a la base se guarda en `globalThis` y
sigue siendo la de antes.

**Los dos proyectos se mantienen iguales por las migraciones**, no clonando la base: el de
desarrollo se levantó aplicando las mismas cuatro de `supabase/migrations/`, con sus mismos nombres
y versiones. Cada migración nueva se aplica **primero en desarrollo** y, cuando funciona, en
producción.

Lo que **no** es igual en los dos y hay que repetir a mano al crear un proyecto:

1. La contraseña del rol `app_avisos` (`alter role app_avisos with login password '…'`), que no
   está en ninguna migración.
2. La configuración de Auth: registro público desactivado y contraseñas de 12 caracteres con los
   cuatro tipos de carácter.
3. `SUPABASE_SECRET_KEY`, que es distinta en cada proyecto.

**Copias de seguridad**: en el plan free de Supabase no hay copias automáticas. `pnpm datos:copiar`
guarda en `respaldos/` (que no se versiona) todo lo que lee de producción antes de escribir, así que
es también la forma de sacar una copia del día:

```bash
pnpm datos:copiar --sin-escribir
```

**Pendiente**: en Vercel, las variables están puestas a la vez en `production` y en `preview`, así
que un despliegue de vista previa escribiría en la base de producción. Mientras todo vaya por `main`
no llega a pasar; el día que haya ramas, conviene apuntar `preview` a desarrollo.

---

## La base de datos en Supabase

- **La conexión** va en `DATABASE_URL` (en `.env.local` para desarrollo y en `.env.produccion.local`
  para producción). Es la del pooler de Supabase en **modo sesión, puerto 5432**. No sirve el modo transacción (6543): con el driver que usa la aplicación
  las páginas se quedan cargando, y la aplicación se niega a arrancar si lo detecta.
- **La aplicación entra con su propio rol, `app_avisos`**, que solo puede leer y escribir filas de
  sus tablas. No puede crear ni borrar tablas, ni ver nada más del proyecto.
- **La API pública de Supabase no da acceso a nada.** Las tablas tienen el RLS activado y los roles
  `anon` y `authenticated` no tienen permisos, así que ni la clave publicable ni el token de un
  usuario que ha iniciado sesión sirven para leer o escribir datos. Todo pasa por el servidor, que
  comprueba el rol en cada pantalla y en cada acción.
- **Los usuarios** están en Supabase Auth (email y contraseña) y en la tabla `perfiles` (rol, ficha
  de técnico, activo). La sesión va en una cookie que el JavaScript de la página no puede leer.
- **En la configuración de Auth** de Supabase tienen que estar: el registro público desactivado
  (Authentication → Sign In / Providers → «Allow new users to sign up» apagado) y las contraseñas
  con al menos 12 caracteres y los cuatro tipos de carácter.
- **Los cambios de esquema** se hacen con una migración: se toca `src/db/esquema.ts`, se genera el SQL
  con `pnpm db:generar` y se aplica **en los dos proyectos**, primero en desarrollo (con el conector
  de Supabase de Claude, con `supabase db push` o pegándolo en el editor SQL). Los detalles están en
  `AGENTS.md`.

**Poner o cambiar la contraseña de `app_avisos`**: en el editor SQL del proyecto que toque (cada uno
tiene la suya),

```sql
alter role app_avisos with login password 'la-nueva-contraseña';
```

y poner la misma en el `DATABASE_URL` de ese entorno. Si tiene símbolos, en la cadena de conexión
van codificados (`%40` para `@`, etc.). El `login` hace falta porque la migración crea el rol sin
él: mientras no se ejecute esto, el pooler responde «user not found in the database».

---

## Qué falta para ponerla en producción

Ya hay inicio de sesión con roles. Antes de abrir la aplicación fuera de la oficina faltan una
**política de copias de seguridad** según el plan de Supabase y **desplegar** el servidor de Next.js
con HTTPS. Si se quiere que cada usuario recupere su contraseña por email, hace falta configurar un
**servidor de correo propio (SMTP)** en Supabase: el que trae de serie solo envía a los miembros del
equipo del proyecto. Para las cuentas de administrador convendría además un **segundo factor** (TOTP).

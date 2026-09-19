# AGENTS.md

Pautas para los agentes de programación (Claude Code, Codex, etc.) que trabajan en este repositorio.

## Documentación del proyecto

La documentación funcional y técnica del proyecto está en [`spec.md`](spec.md). Ahí se encuentran el
contexto y las decisiones tomadas con el usuario, el modelo de datos, las reglas de negocio, las
pantallas y rutas, el diseño, los datos de ejemplo, las fases y cómo se verifica. Conviene leerlo
antes de hacer cambios de funcionalidad, y actualizarlo cuando cambie algo de lo que describe.

## Idioma

Todo el proyecto está en español: la interfaz, los mensajes de validación, los comentarios y también
los identificadores (`avisos`, `tecnicoId`, `cambiarEstado`, `listarAvisos`…). El código nuevo sigue
esa convención, y las respuestas al usuario van siempre en español.

## Comandos

```bash
pnpm dev                 # http://localhost:3000 (en la app de escritorio: preview_start "avisos")
pnpm typecheck           # tsc --noEmit
pnpm lint
pnpm test                # todas (node:test + tsx, con --experimental-test-module-mocks)
node --import tsx --experimental-test-module-mocks --test tests/acciones-avisos.test.ts   # un archivo
node --import tsx --experimental-test-module-mocks --test --test-name-pattern="retrasados" "tests/**/*.test.ts"  # por nombre
pnpm db:reset            # borra la base de Supabase y carga los datos de ejemplo (alias: db:seed)
pnpm db:generar          # nueva migración en supabase/migrations/ tras tocar src/db/esquema.ts
pnpm usuarios:admin <email> "<nombre>"   # crea un administrador con contraseña temporal
```

- La base de datos es PostgreSQL en Supabase (proyecto «App de Partes», ref
  `qiydpgnryyypnkhuqzyv`, región eu-central-1). La conexión sale de `DATABASE_URL` en `.env.local`
  (plantilla en `.env.example`). Next la carga solo; los scripts la cargan con `scripts/entorno.ts`.
  El inicio de sesión usa además `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`
  (esta última es secreta: no se lee, no se imprime y no se copia a ningún sitio).
  La lectura de mensajes con IA usa `OPENROUTER_API_KEY`, también secreta y con el mismo trato, y
  `OPENROUTER_MODELO` (opcional; por defecto `google/gemini-3-flash-preview`). Sin la clave, el
  recuadro de «Nuevo aviso» responde que falta y el resto funciona igual.
- `db:reset` trabaja sobre esa base, la de verdad: se lleva por delante lo que haya.
- `pnpm test` no toca Supabase ni OpenRouter: `tests/consultas.test.ts` y `tests/acciones-*.test.ts`
  montan un Postgres en memoria (PGlite) con las mismas migraciones de `supabase/migrations/`, y
  Supabase Auth y `fetch` se sustituyen (ver «Pruebas de las acciones» en las trampas).
- Los datos de ejemplo (`src/db/semilla.ts`) ponen las fechas respecto al día en que se cargan:
  unos días después aparecen avisos «retrasados» que antes no lo eran.

### Cambiar el esquema

1. Tocar `src/db/esquema.ts` y generar la migración con `pnpm db:generar --name <nombre>`.
2. Si la migración crea una tabla, añadirle a mano lo de `…_acceso_app.sql` (o `…_acceso_usuarios.sql`):
   `revoke` a `anon` y `authenticated`, RLS activado, `grant` a `app_avisos` (solo lo que necesite)
   y su política. Drizzle no genera permisos (`pnpm db:generar --custom --name <nombre>` crea una
   migración vacía para escribirlos). Con el login, cada usuario tiene un token `authenticated`:
   una tabla que se le abra a ese rol queda al alcance de cualquier usuario por la API de datos.
3. Aplicarla en Supabase con el conector (`apply_migration`, mismo nombre) o `supabase db push`.
   El rol de la app no puede cambiar el esquema, así que nunca se aplica desde la aplicación.
4. Si se aplicó con el conector, Supabase le da su propia versión: renombrar el archivo (y su
   `tag` en `meta/_journal.json` y su instantánea en `meta/`) para que coincida con
   `list_migrations`. Después, `pnpm db:generar` debe responder «No schema changes».
5. Pasar el asesor de seguridad (`get_advisors`) y `pnpm test`.

## Arquitectura

Next.js 16 (App Router, Turbopack) + React 19 + PostgreSQL en Supabase con Drizzle y el driver
`postgres` (postgres.js). No hay API propia ni se usa la API de datos de Supabase: los Server
Components leen con las funciones de `src/db/consultas/` y los formularios escriben con Server
Actions de `src/acciones/` mediante `useActionState`. El layout raíz fija
`dynamic = 'force-dynamic'`, así que nada se cachea.

- **Acceso a la base**: el servidor se conecta con el rol `app_avisos`, que solo lee y escribe
  filas de sus tablas (ni DDL ni otros esquemas). `anon` y `authenticated` no tienen ningún
  permiso sobre ellas y el RLS está activado: ni con la clave publicable ni con el token de un
  usuario se lee nada. Todo eso está en las migraciones `…_acceso_app.sql` y
  `…_acceso_usuarios.sql`. La contraseña del rol no está en ninguna migración: se fija aparte con
  `alter role app_avisos with login password …`.
- **Usuarios y sesión** (detalle en «Usuarios, roles y permisos» de `spec.md`): la cuenta está en
  Supabase Auth y el rol en `perfiles` (mismo `uuid`). Solo el servidor habla con Auth
  (`src/lib/supabase/`: `servidor.ts` con la cookie del usuario, `admin.ts` con la clave secreta y
  `server-only`, `proxy.ts` para renovar la sesión). `src/lib/sesion.ts` da `usuarioActual()`
  (verifica el token con `getClaims()`, nunca con `getSession()`, y lee el perfil en cada petición),
  `exigirUsuario()` / `exigirPermiso()` para las páginas y `usuarioDeLaAccion()` para las acciones.
- **Permisos**: todas las reglas están en `src/lib/permisos.ts`. **Cada página nueva** llama a
  `exigirUsuario` o `exigirPermiso` (el layout de `(app)` no basta: al navegar no se vuelve a
  ejecutar), **cada acción nueva** empieza con `usuarioDeLaAccion()` + `puede(...)` y devuelve
  `SIN_PERMISO`, y **cada consulta de avisos** que vea un técnico recibe `ambitoDe(usuario)`. Lo que
  un rol no puede ver responde con `notFound()`, también en `generateMetadata` (el título no debe
  delatar el registro). Cada cambio de estado guarda `usuarioId` en `movimientos`.

- **Lectura de mensajes con IA** (en «Nuevo aviso»; detalle en «Lectura de mensajes con IA» de
  `spec.md`): el recuadro `LectorMensaje` llama a la acción `leerMensaje` (`src/acciones/lectura.ts`)
  como función, no con `useActionState` (React vaciaría el recuadro al terminar). La acción comprueba
  `gestionarAvisos`, lee el catálogo (`catalogoParaLectura`) y llama a OpenRouter desde
  `src/lib/openrouter.ts` (`server-only`, con `fetch` y sin SDK: salida estructurada estricta,
  `require_parameters` y `data_collection: 'deny'`). El proveedor de IA es OpenRouter por decisión
  del usuario: no se añade el SDK de Anthropic ni el de otro proveedor. Lo que no depende de la API
  (instrucciones, catálogo, esquema de la
  respuesta y `ajustarLectura`, que descarta ids inexistentes o un local de otro cliente) está en
  `src/lib/lecturaMensaje.ts` y se prueba en `tests/lecturaMensaje.test.ts`. **La IA no escribe en
  la base**: `FormularioAviso` rellena sus campos y el aviso se guarda con `crearAviso` como
  siempre. Lo que no tiene claro (cliente, local) llega en blanco, y el formulario lo deja en blanco.
- **Contrato de las acciones** (`src/lib/acciones.ts`): devuelven `ResultadoAccion`
  `{ ok, mensaje, errores, valores }` o redirigen. `valores` devuelve lo enviado para volver a
  pintar el formulario cuando falla la validación (zod, en `src/lib/validaciones.ts`).
- **Reglas de estado**: viven en `src/acciones/avisos.ts` (`cambiarEstado`, que también llaman el
  tablero y la asignación) y en `src/acciones/partes.ts`. Asignar un técnico pasa el aviso de
  pendiente a asignado, y quitarlo lo devuelve. En espera exige motivo y finalizado exige resumen
  (guarda `fechaCierre`). Salvo pendiente y cancelado, todo estado necesita técnico (también al
  asignar: a un aviso en marcha o cerrado se le cambia el técnico, pero no se le quita). Un parte
  marcado «resuelto» finaliza el aviso, y un parte sobre un aviso pendiente o asignado lo pasa a en
  curso. **Cada cambio de estado se anota en `movimientos`**, que es la cronología, y en la misma
  transacción que el cambio (`bd.transaction`): se guardan los dos o ninguno. El aviso se lee con
  `avisoBloqueado(tx, id)` (`SELECT … FOR UPDATE`), para que dos cambios a la vez sobre el mismo
  aviso no decidan sobre un estado caducado. Cualquier ruta nueva que cambie un estado debe hacer
  lo mismo.
- **Vocabulario del dominio** (estados, prioridades, categorías, canales, especialidades, con sus
  etiquetas y colores): solo en `src/lib/dominio.ts`. En la base se protegen con CHECK constraints
  (las especialidades, con `<@` sobre el array), así que añadir un valor exige una migración nueva.
- **Borrado protegido**: clientes, locales y técnicos con historial no se borran (las funciones
  `dependencias*` de las consultas deciden y la acción devuelve el mensaje). Borrar un aviso arrastra
  sus partes y movimientos en cascada (claves ajenas `restrict` y `cascade` en la base).
- **Filtros de avisos en la URL** (`src/lib/filtros.ts`): `leerFiltros` y `aParametros` se usan en
  las dos direcciones. Las vistas (`abiertos`, `hoy`, `retrasados`, `sin_asignar`, `urgentes`,
  `finalizados`, `todos`) son atajos, y un `estado` explícito manda sobre la vista.
- **Fechas**: las de calendario son `date` en Postgres y se leen como texto `YYYY-MM-DD`
  (`mode: 'string'`); los instantes (`fechaAviso`, `fechaCierre`, `movimientos.fecha`) son
  `timestamptz` y se leen como `Date`. Hay que usar las utilidades de `src/lib/fechas.ts`
  (`hoyISO`, `sumarDias`, `inicioDelDia`…) y no `new Date().toISOString()`, que se desplaza por la
  zona horaria. La base está en UTC: para comparar un instante con un día, se pasa
  `inicioDelDia(dia)` como parámetro en lugar de convertir la fecha en SQL.
- **Búsqueda por texto**: se hace en memoria con `normalizar()` (quita acentos y convierte ñ→n), no
  en SQL, para que todos los buscadores se comporten igual sin depender de la extensión `unaccent`.
- **Sistema visual** (detalle en la sección «Diseño» de `spec.md`): los colores salen de los tokens
  de `src/app/globals.css` y cada paleta tiene un papel fijo. `marca` (verde bosque) es para
  acciones, `lima` para lo seleccionado, `coral` para lo que pide atención y `gris` para los
  neutros. El pastel de cada estado está en `ESTADO[...].tarjeta` de `dominio.ts`. No se usan los
  colores sueltos de Tailwind (`red-*`, `amber-*`, `slate-*`…).

## Trampas conocidas

- **`src/proxy.ts` no es la seguridad**: solo renueva la sesión y manda al login a quien no tiene
  token. Las acciones de servidor pueden no pasar por él (dependen del `matcher` y de la ruta) y no
  mira el rol ni si el usuario está activo. Entre `createServerClient` y `getClaims()` no va nada
  de código (lo pide Supabase: si no, se pierden sesiones al azar).
- **Sesiones anuladas**: `sesionesValidasDesde` se compara con el `amr` del token (el momento en que
  se escribió la contraseña, que no cambia al renovar), dando un segundo de margen porque el token
  redondea a segundos. Usar `iat` no sirve: cambia cada hora y una sesión anulada revivía al renovarse.
- **Contraseñas fuera de `valores`**: las acciones con contraseñas no devuelven `valoresDe(formData)`,
  que las mandaría de vuelta al navegador. La temporal va en `secreto`, se enseña una vez y no se
  guarda. El script `crear-admin.ts` no puede importar nada con `server-only` (fallaría fuera de Next).
- **CSP con nonce**: la pone `src/proxy.ts` en cada petición, así que todo tiene que seguir siendo
  dinámico (`force-dynamic`). Un `<script>` en línea sin el nonce no se ejecuta; los atributos
  `style` sí funcionan (`style-src 'unsafe-inline'`).
- **Un solo `next dev` por carpeta**: Next 16 lo bloquea («Another next dev server is already
  running»). Si hay uno abierto desde otra conversación, se usa ese (`http://localhost:3000`, recoge
  los cambios en caliente); `.claude/launch.json` lleva `autoPort` para cuando el 3000 esté libre.
  Ese servidor también bloquea en Windows mover carpetas de `src/app`: se copian y se borran.

- **Pooler de Supabase en modo sesión (puerto 5432), nunca en modo transacción (6543)**: postgres.js
  encadena consultas por la misma conexión y, en modo transacción, el pooler suelta la conexión del
  servidor a mitad de una consulta con parámetros. La página se queda cargando para siempre, sin
  ningún error, y en Postgres las sesiones aparecen `active` esperando `ClientRead`.
  `src/db/cliente.ts` se niega a arrancar con el 6543 para que no vuelva a pasar.
- **Subconsultas correlacionadas en Drizzle**: en esas subconsultas los nombres de tabla y columna
  van escritos a mano (`avisos.tecnico_id = tecnicos.id`) y los valores sí se interpolan. Con
  columnas interpoladas la correlación depende de cómo las cualifique Drizzle, y si se rompe los
  recuentos salen a cero sin ningún error. Tampoco se puede ordenar por un alias de la lista de
  columnas: se repite la expresión. `tests/consultas.test.ts` cuadra cada agregado con un cálculo
  en JS; si tocas una consulta con recuentos, pásalo.
- **`count(*)` es `bigint`** y postgres.js devuelve los `bigint` como texto: `"3" + 1` da `"31"`.
  En las subconsultas escritas a mano va `count(*)::int`; el `count()` de Drizzle ya lo convierte.
  Por lo mismo los ids son `integer` y no `bigint`.
- **Transacciones**: el callback de `bd.transaction` es `async` y cada consulta de dentro lleva su
  `await`; una sin esperar se ejecutaría fuera de la transacción. `redirect()` va siempre después,
  fuera: lanza una excepción y dentro desharía lo escrito. El tipo `Transaccion` para las funciones
  auxiliares está en `src/db/cliente.ts`. La referencia `AV-AAAA-NNNN` se calcula con un cerrojo
  (`pg_advisory_xact_lock`) dentro de la transacción del alta.
- **Orden de los nulos**: Postgres pone los `NULL` al final en `asc` (SQLite, al principio). Donde
  importa se dice explícitamente, como en la agenda (`hora_programada asc nulls first`).
- **Formularios con React 19**: tras una Server Action, React restablece los campos a sus valores
  HTML por defecto y no vuelve a aplicar el `defaultValue` de un `<select>` ya montado. Por eso el
  `Selector` de `src/componentes/ui/Campo.tsx` pone el `defaultValue` como `key`, y los selects
  dependientes de `FormularioAviso` (cliente → local, estado) son no controlados, con listeners y una
  resincronización a partir de `resultado.valores`. Cambiar esto a controlado reintroduce el fallo
  de que el campo vuelve a su valor inicial al guardar.
- **Nada de `setState` dentro de `useEffect`** para sincronizar con props o resultados: la regla
  `react-hooks/set-state-in-effect` falla el lint. Se ajusta el estado durante el render comparando
  con el valor anterior, como hacen `Buscador`, `CambiarEstado` y el `Tablero`.
- **Tablero kanban** (`src/componentes/tablero/Tablero.tsx`, @dnd-kit): la tarjeta que se arrastra
  se pinta en un `DragOverlay` porque las columnas tienen scroll propio y la recortaban. Donde se
  suelta se decide con `pointerWithin` y, si no hay nada bajo el cursor, con `closestCenter`. El
  `DndContext` lleva un `id` fijo: sin él, los `aria-describedby` de dnd-kit no coinciden entre
  servidor y navegador y React avisa de un desajuste al hidratar.
- **Fuente**: la variable de `next/font` va en `<html>`, no en `<body>`. El tema la lee desde la
  raíz (`--font-sans: var(--fuente-app)`) y en `<body>` quedaría fuera de alcance: la página
  saldría con la fuente del sistema sin ningún error.
- **`cn()` y los tokens propios**: `tailwind-merge` solo conoce los radios y sombras de Tailwind,
  así que `src/lib/utils.ts` le declara los del tema (`rounded-panel|tarjeta|control`,
  `shadow-tarjeta|flotante`). Si se añade un radio o una sombra al tema, hay que añadirlo también
  ahí; si no, `cn('rounded-control', 'rounded-full')` deja las dos clases.
- **Rejillas en el móvil**: las rejillas que solo definen columnas a partir de `lg:` llevan
  `grid-cols-1`. Sin columnas explícitas, un texto con `truncate` ensancha la pista y la página
  se sale de la pantalla en el móvil.
- **Pruebas con PGlite**: `usarBaseEnMemoria()` (`tests/ayudas/base.ts`) deja la base en memoria
  en `globalThis.__bdAvisos` *antes* de importar los módulos de `src/db/`, que usan esa conexión en
  lugar de abrir otra. Crea antes los roles `anon` y `authenticated` y una tabla `auth.users` con
  solo el `id`, que en Supabase ya existen y que las migraciones nombran.
- **Pruebas de las acciones** (`tests/acciones-*.test.ts`): ejecutan las Server Actions de verdad
  sobre PGlite. `sustituirServidor()` (`tests/ayudas/servidor.ts`) cambia con `mock.module` solo lo
  que no existe fuera de Next o llama a servicios de fuera: `next/cache`, `next/headers`,
  `server-only`, los clientes de `src/lib/supabase/` (un Supabase Auth de mentira) y
  `filtraciones.ts`. `src/lib/sesion.ts` es el real: `entrarComo(usuario)` solo pone el token, y el
  rol, si sigue activo y si la sesión vale salen de su perfil en la base. Por eso las acciones se
  importan con `await import` *después* de `sustituirServidor()`, y `pnpm test` lleva
  `--experimental-test-module-mocks` (sin él, las ayudas avisan). `redirect()` es el de Next:
  `redireccion(accion)` devuelve la ruta. Para sustituir un método en una sola prueba,
  `t.mock.method(...)` una vez por prueba (si se repite sobre el mismo método, no se restaura bien).
  Una acción nueva lleva aquí sus pruebas: quién puede (`SIN_PERMISO`), qué cambia en la base y, si
  cambia un estado, su línea en `movimientos`.
- **Salida estructurada en OpenRouter**: el JSON Schema de la respuesta (`ESQUEMA_SALIDA`) va escrito
  a mano, en modo estricto (todo `required`, `additionalProperties: false`, los opcionales con
  `anyOf` + `null`). Si se añade un campo, va en `SalidaLectura`, en `ESQUEMA_SALIDA` y en el zod de
  `openrouter.ts` (los `satisfies` avisan si falta en alguno). Sin `require_parameters: true`, un
  proveedor que no admita el esquema lo ignoraría sin avisar; con él, un modelo sin salida
  estructurada (o sin proveedores que cumplan `data_collection: 'deny'`) da un 404, que la acción
  explica. `openrouter.ts` no se puede importar en las pruebas (`server-only`): para probarlo a mano
  se lanza con `node --conditions=react-server --import tsx`.
- **pnpm**: solo ejecuta los scripts de instalación de los paquetes listados en `allowBuilds` de
  `pnpm-workspace.yaml`. No se configura en el campo `pnpm` de `package.json`: pnpm 11 ya no lo lee.

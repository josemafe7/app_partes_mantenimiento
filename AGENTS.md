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

## Git

El repositorio está en GitHub (`origin`: https://github.com/josemafe7/app_partes_mantenimiento).

- **Todo va en la rama `main`.** No se crean otras ramas (ni worktrees) si el usuario no lo pide.
- **Nada se sube sin que el usuario lo diga**: ni `git add`, ni `git commit`, ni `git push`, ni
  ninguna otra forma de llevar cambios al repositorio. Los cambios se quedan en la carpeta hasta
  que el usuario pida expresamente guardarlos o subirlos. Que haya pedido un commit una vez no
  vale para los siguientes.

## Comandos

Sin `.env.local`, `pnpm dev` arranca en **modo local** (base en `.datos/`, login propio, datos de
ejemplo): ver «El modo local», más abajo. Con `.env.local`, todo va contra Supabase como siempre.

```bash
pnpm dev                 # http://localhost:3000 (en la app de escritorio: preview_start "avisos")
pnpm typecheck           # tsc --noEmit
pnpm lint
pnpm test                # todas (node:test + tsx, con --experimental-test-module-mocks)
node --import tsx --experimental-test-module-mocks --test tests/acciones-avisos.test.ts   # un archivo
node --import tsx --experimental-test-module-mocks --test --test-name-pattern="retrasados" "tests/**/*.test.ts"  # por nombre
pnpm db:reset            # borra la base de DESARROLLO y carga los datos de ejemplo (alias: db:seed)
pnpm db:generar          # nueva migración en supabase/migrations/ tras tocar src/db/esquema.ts
pnpm entornos            # a qué proyecto apunta cada entorno y si conecta (solo lectura)
pnpm datos:copiar        # copia los datos de producción a desarrollo (--sin-escribir: solo respaldo)
pnpm usuarios:prueba     # un usuario de cada rol en desarrollo (--renovar: contraseñas nuevas)
pnpm usuarios:admin <email> "<nombre>"   # crea un administrador con contraseña temporal
```

**Todo lo de arriba va contra desarrollo.** Para ir a producción hay que escribirlo:
`--entorno=produccion` (o `ENTORNO=produccion`). Ver «Los dos entornos», más abajo.

- La base de datos es PostgreSQL en Supabase, en dos proyectos de la región eu-central-1: «App de
  Partes» (ref `qiydpgnryyypnkhuqzyv`) para **producción** y «App de Partes - Desarrollo» (ref
  `ujftpokeijrivicdwpnx`) para **desarrollo**. La conexión sale de `DATABASE_URL` en `.env.local`
  (desarrollo) o `.env.produccion.local` (producción); la plantilla es `.env.example`. Next carga
  `.env.local` solo; los scripts eligen archivo con `scripts/entorno.ts`.
  El inicio de sesión usa además `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEY` y `SUPABASE_SECRET_KEY`
  (esta última es secreta: no se lee, no se imprime y no se copia a ningún sitio).
  La lectura de mensajes con IA usa `OPENROUTER_API_KEY`, también secreta y con el mismo trato, y
  `OPENROUTER_MODELO` (opcional; por defecto `google/gemini-3-flash-preview`). Sin la clave, el
  recuadro de «Nuevo aviso» responde que falta y el resto funciona igual.
- `db:reset` se lleva por delante lo que haya en la base de desarrollo, y **se niega a ejecutarse
  contra producción** (hacen falta `--entorno=produccion` *y* `--si-borrar-produccion`).
- `pnpm test` no toca Supabase ni OpenRouter: `tests/consultas.test.ts` y `tests/acciones-*.test.ts`
  montan un Postgres en memoria (PGlite) con las mismas migraciones de `supabase/migrations/`, y
  Supabase Auth y `fetch` se sustituyen (ver «Pruebas de las acciones» en las trampas).
- Los datos de ejemplo (`src/db/semilla.ts`) ponen las fechas respecto al día en que se cargan:
  unos días después aparecen avisos «retrasados» que antes no lo eran.

### Los dos entornos

`scripts/entornos.ts` es quien decide a qué proyecto va cada cosa, y no tiene efectos: se prueba en
`tests/entornos.test.ts`. Lo que hay que saber para no romperlo:

- **Por defecto, desarrollo.** `entornoPedido()` devuelve `desarrollo` salvo que se pase
  `--entorno=produccion` o `ENTORNO=produccion`. `scripts/entorno.ts` carga el archivo que toque y
  exporta `ENTORNO` y `VARIABLES`; se importa el primero, antes que `src/db/cliente`.
- **Un script nuevo que escriba en la base empieza con `exigirDesarrollo(VARIABLES, '<comando>')`**,
  salvo que su razón de ser sea tocar producción. La guardia mira el ref del proyecto en
  `DATABASE_URL` *y* en `SUPABASE_URL`, así que no se esquiva cambiando solo uno.
- **Los argumentos se leen con `argumentosSueltos()`**, no con `process.argv.slice(2)`: si no, un
  `--entorno=produccion` se cuela como si fuera el email o el nombre.
- Los scripts que hablan con dos proyectos a la vez (`copiar-datos.ts`) no usan `bd` de
  `src/db/cliente`, que está atado a un solo `DATABASE_URL`: abren sus conexiones con `postgres()`.
- `.env.produccion.local` no se versiona (`.gitignore` lleva `.env.*`, salvo `.env.example`), y
  `respaldos/` tampoco.

### El modo local

La aplicación entera sin servicios de fuera, para que quien clona el repositorio la vea funcionando
con `pnpm install` y `pnpm dev`. Cambia dos piezas y nada más:

- **La base**: `src/db/baseLocal.ts` levanta PGlite en `.datos/`, le aplica las migraciones de
  `supabase/migrations/` que le falten y la siembra con `src/db/semilla.ts`. Es lo mismo que hace
  `tests/ayudas/base.ts`, pero en disco.
- **El login**: `src/lib/supabase/authLocal.ts` sustituye a Supabase Auth con una cookie firmada y
  las cuentas en `auth.cuentas_locales`. Es el planteamiento de `tests/ayudas/servidor.ts`: solo se
  cambia lo que habla con Supabase, y `src/lib/sesion.ts`, `permisos.ts`, las consultas y las
  acciones son las de siempre.

Lo que hay que saber para no romperlo:

- **Se enciende solo** (`esModoLocal()`, en `src/lib/modoLocal.ts`): sin `DATABASE_URL`, fuera de
  `NODE_ENV=production` y fuera de Vercel y de CI. **No se añade ninguna bandera ni variable para
  encenderlo**: una variable así se copia a Vercel por error y deja la aplicación publicada con una
  base de juguete y un login que no comprueba nada. `tests/modoLocal.test.ts` cubre las condiciones.
- **Los tres usuarios y su contraseña están en `modoLocal.ts` y en el README.** Si se cambian, hay
  que cambiar los dos sitios.
- **Lo que la aplicación le pide a Supabase Auth está en `src/lib/supabase/tipos.ts`**
  (`ClienteAuth`, `ClienteAdmin`), y es lo que devuelven `clienteSupabase()` y `clienteAdmin()`. Si
  hace falta otro método de Auth, se añade ahí y el compilador obliga a implementarlo también en
  local, en vez de dejar el modo local roto sin que nadie se entere.
- **Una migración nueva se aplica sola** en la base local que ya exista
  (`auth.migraciones_locales` lleva la cuenta): no hace falta borrar `.datos/`.
- `.datos/` está en `.gitignore` y borrarla es empezar de cero.

### Cambiar el esquema

Las migraciones son lo que mantiene iguales los dos proyectos, así que **una migración no está
terminada hasta que está aplicada en los dos**, primero en desarrollo.

1. Tocar `src/db/esquema.ts` y generar la migración con `pnpm db:generar --name <nombre>`.
2. Si la migración crea una tabla, añadirle a mano lo de `…_acceso_app.sql` (o `…_acceso_usuarios.sql`):
   `revoke` a `anon` y `authenticated`, RLS activado, `grant` a `app_avisos` (solo lo que necesite)
   y su política. Drizzle no genera permisos (`pnpm db:generar --custom --name <nombre>` crea una
   migración vacía para escribirlos). Con el login, cada usuario tiene un token `authenticated`:
   una tabla que se le abra a ese rol queda al alcance de cualquier usuario por la API de datos.
   Desde `…_privilegios_por_defecto.sql` las tablas y secuencias que crea una migración ya nacen
   sin permisos para `anon` ni `authenticated`, pero el `revoke` se sigue escribiendo (no cuesta
   y no depende de ese valor por defecto). Las **funciones** no: Postgres da `execute` a PUBLIC
   como valor global, así que una función nueva lleva su `revoke execute on function … from
   public` y el `grant` a quien la necesite. Hoy no hay ninguna en `public`.
3. Aplicarla **en desarrollo** (`ujftpokeijrivicdwpnx`) con el conector (`apply_migration`, mismo
   nombre) o `supabase db push`. El rol de la app no puede cambiar el esquema, así que nunca se
   aplica desde la aplicación.
4. Si se aplicó con el conector, Supabase le da su propia versión: renombrar el archivo (y su
   `tag` en `meta/_journal.json` y su instantánea en `meta/`) para que coincida con
   `list_migrations`. Después, `pnpm db:generar` debe responder «No schema changes».
5. Probarla en local (`pnpm dev`, `pnpm test`) y pasar el asesor de seguridad (`get_advisors`).
6. Aplicarla **en producción** (`qiydpgnryyypnkhuqzyv`), con el mismo nombre. Si el conector le da
   otra versión, cuadrarla con la del repo:
   `update supabase_migrations.schema_migrations set version = '<la del archivo>' where name = '<nombre>'`.
7. Comprobar que los dos proyectos han quedado iguales: `list_migrations` en los dos, y la huella
   de la estructura (la consulta está justo debajo).

### Comprobar que los dos proyectos son iguales

Un `md5` de toda la estructura: columnas con su tipo y su valor por defecto, índices, restricciones,
políticas, RLS y permisos. Si sale lo mismo en los dos proyectos, están iguales; si no, hay que
mirar qué línea sobra o falta quitando el `md5`. El 20-09-2026, con las 6 migraciones en los dos
(hasta `…_lecturas_ia`): `0d9a3705f9444ece2198a5aa0cfbab1e`, 205 elementos. (Con las 4 primeras
era `33222d7a63e744eb0d32d63e0024e9c4`, 194: la tabla `lecturas_ia` añade 12 líneas y el `revoke
update` de `movimientos` quita una.)

```sql
select md5(string_agg(linea, chr(10) order by linea)) as huella, count(*) as elementos from (
  select format('columna %s.%s %s %s %s', table_name, column_name, data_type, is_nullable,
                coalesce(column_default, '-')) as linea
    from information_schema.columns where table_schema = 'public'
  union all
  select format('indice %s', indexdef) from pg_indexes where schemaname = 'public'
  union all
  select format('politica %s %s %s %s', tablename, policyname, roles::text, cmd)
    from pg_policies where schemaname = 'public'
  union all
  select format('permiso %s %s %s', table_name, grantee, privilege_type)
    from information_schema.role_table_grants
    where table_schema = 'public' and grantee in ('app_avisos', 'anon', 'authenticated')
  union all
  select format('restriccion %s %s', conname, pg_get_constraintdef(c.oid))
    from pg_constraint c join pg_class t on t.oid = c.conrelid join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
  union all
  select format('rls %s %s', relname, relrowsecurity::text)
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
) t;
```

Lo que esta huella **no** ve, porque no está en las migraciones y hay que repetir a mano en cada
proyecto: la contraseña de `app_avisos` (`alter role app_avisos with login password '…'`), la
configuración de Auth (registro público apagado, contraseñas de 12 caracteres con los cuatro tipos)
y `SUPABASE_SECRET_KEY`, que es distinta en cada uno.

Tampoco ve los **privilegios por defecto** (`…_privilegios_por_defecto.sql`), que sí están en las
migraciones pero viven en otro catálogo. Se comprueban aparte, y en los dos proyectos tiene que
salir lo mismo: para el rol `postgres`, ni rastro de `anon` ni de `authenticated` (los de
`supabase_admin` no se pueden cambiar y siguen abiertos: es lo esperado).

```sql
select defaclrole::regrole as rol, defaclobjtype as tipo, defaclacl::text as permisos
  from pg_default_acl where defaclnamespace = 'public'::regnamespace order by 1, 2;
```

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
  siempre. Lo único que se anota es quién pide cada lectura y cuándo (`lecturas_ia`): antes de
  llamar a OpenRouter, la acción pasa por `lecturaPermitida` (`src/db/consultas/usuarios.ts`: 20
  por minuto y 300 en 24 horas por usuario, contadas bajo un cerrojo por usuario). **Cualquier
  ruta nueva que llame a `leerMensajeConIA`, o a otra API de pago, pasa antes por un tope así.** Lo que no tiene claro (cliente, local) llega en blanco, y el formulario lo deja en blanco.
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

- **Cambiar de entorno pide reiniciar `pnpm dev`**: Next detecta el cambio y escribe «Reload env:
  .env.local», pero `src/db/cliente.ts` guarda el pool en `globalThis.__bdAvisos` para que el
  recargado en caliente no abra uno nuevo en cada cambio, y ese pool sobrevive a la recarga con la
  conexión vieja. O sea, que tras apuntar `.env.local` a otro proyecto el servidor puede seguir
  leyendo del anterior sin decir nada. Se reinicia y ya. `pnpm entornos` dice a qué proyecto apunta
  cada archivo, pero no qué tiene abierto un servidor que ya estaba corriendo.
- **`jsonb` como parámetro con postgres.js**: si Postgres deduce que el parámetro es `jsonb` (por
  un `$1::jsonb`), postgres.js aplica su serializador de JSON y **vuelve a codificar** la cadena que
  se le pasa, así que al servidor le llega un texto JSON en vez del array y salta «cannot call
  jsonb_populate_recordset on a non-array». En `copiar-datos.ts` va `$1::text::jsonb`, que fija el
  tipo del parámetro a texto y deja la cadena pasar tal cual. La otra forma buena es pasar el
  objeto de JavaScript con `sql.json(...)`; la que no funciona es cadena + `::jsonb`.
- **`pnpm typecheck` no es tan estricto como `pnpm build`**: `next build` vuelve a comprobar los
  tipos con los que genera Next, y ahí `process.env.NODE_ENV` es de solo lectura. Una prueba que le
  asigne pasa `tsc --noEmit` y rompe el despliegue (`tests/modoLocal.test.ts` escribe el entorno a
  través de un `Record<string, string | undefined>` por esto). Si se toca algo de entorno, conviene
  pasar `pnpm build` antes de subir.
- **El modo local se apaga solo con `DATABASE_URL`, no con lo demás**: la guardia mira esa variable,
  `NODE_ENV`, `VERCEL` y `CI` (`esModoLocal()`). Un código nuevo que decida según el entorno usa esa
  función y no vuelve a leer `process.env` por su cuenta, para que la decisión siga estando en un
  sitio. Y nada de banderas para encenderlo.
- **La base local se prepara por detrás**: `abrirBaseLocal()` devuelve la conexión enseguida y pone
  una barrera delante, así que la primera consulta espera a las migraciones y a la siembra. Como la
  siembra también pasa por `bd`, va marcada con un `AsyncLocalStorage` para cruzar esa barrera; una
  preparación nueva que use `bd` tiene que ir dentro de esa marca o se esperaría a sí misma para
  siempre.
- **`.env.local` es desarrollo, y tiene que seguir siéndolo**: es el archivo que lee Next con
  `pnpm dev` y el destino por defecto de todos los scripts. Apuntarlo a producción «un momento para
  ver una cosa» deja armado el siguiente `pnpm db:reset`, que borra las tablas antes de sembrarlas.
  Para mirar producción está `--entorno=produccion`, que usa `.env.produccion.local` y no cambia
  nada de sitio. La guardia (`exigirDesarrollo`) cubre `db:reset`, `usuarios:prueba` y el destino de
  `datos:copiar`, pero **no** `pnpm dev`: ahí no hay más red que esta.
- **Pooler de Supabase en modo sesión (puerto 5432), nunca en modo transacción (6543)**: postgres.js
  manda varias consultas seguidas por la misma conexión sin esperar a la anterior, y en modo
  transacción cada una puede acabar en una conexión distinta del servidor. La página se queda
  cargando para siempre, sin ningún error, y en Postgres las sesiones aparecen `active` esperando
  `ClientRead`. `src/db/cliente.ts` se niega a arrancar con el 6543 para que no vuelva a pasar.
  Comprobado otra vez el 20-09-2026 buscando una salida para el serverless: con `prepare: false`
  una consulta suelta va bien, pero en cuanto dos comparten conexión (lo normal: la pantalla de
  inicio lanza catorce a la vez) se cuelga, y subir `max` por encima de la concurrencia solo
  esconde la trampa hasta que entran dos personas a la vez. Con más conexiones que consultas
  simultáneas pasó cinco rondas; con `max: 3`, se colgó en la segunda.
- **Las 15 conexiones del pooler son para todos**: cada proyecto de Supabase admite 15 conexiones a
  la vez. Las de producción se las reparten la web publicada en Vercel (cada instancia abre las
  suyas y se congela entre visitas sin soltarlas) y cualquier proceso que apunte ahí; desde que hay
  proyecto de desarrollo, el `pnpm dev` de local ya no se las quita, porque gasta las suyas. Por eso `postgres()` va con `max: 2` e
  `idle_timeout: 10`, y no conviene subirlos: con `max: 10` se agotaron el 20-09-2026 en cuanto
  hubo web publicada y servidor local a la vez. Al agotarse, las consultas fallan con
  `(EMAXCONNSESSION) max clients reached in session mode` y las páginas enseñan «No se ha podido
  cargar esta pantalla». Para ver quién las tiene:
  `select state, now() - state_change from pg_stat_activity where usename = 'app_avisos'`; se
  sueltan con `pg_terminate_backend` sobre las `idle` o reiniciando el proyecto en Supabase.
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
- **Las pruebas corren como superusuario**, que se salta permisos y RLS: un `UPDATE` nuevo sobre
  `movimientos` (o cualquier cosa que `app_avisos` no tenga concedida) pasaría todas las pruebas y
  fallaría en Supabase con «permission denied». Lo que el rol puede y no puede se comprueba en
  «permisos del rol de la aplicación» de `tests/consultas.test.ts`, con `set role app_avisos`: si
  una migración cambia un `grant`, su caso va ahí.
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
  `minimumReleaseAge` retrasa 7 días la adopción de versiones recién publicadas; para un parche de
  seguridad urgente, `--config.minimumReleaseAge=0` en ese comando. Antes de subir, `pnpm audit --prod`.
- **`.next/` guarda una copia de las claves**: la caché de Turbopack (`.next/cache`, `.next/dev/cache`)
  lleva en claro el valor de las variables de entorno con las que se arrancó (`SUPABASE_SECRET_KEY`,
  `OPENROUTER_API_KEY`, `DATABASE_URL`), también las de producción si alguna vez se arrancó contra
  ella. Git la ignora, pero un zip de la carpeta no: antes de comprimir, copiar o compartir el
  proyecto se borran `.next/`, `respaldos/` y los `.env*.local`, y `.next/` se borra también después
  de rotar una clave. Al navegador no llega (`.next/static` no las contiene).
- **Una rama subida es una web con las claves de producción**: mientras en Vercel las variables
  estén marcadas también para «Preview», cualquier rama que llegue a GitHub despliega una vista
  previa que lee y escribe en la base de producción. Por eso todo va en `main`, y una rama de
  trabajo (como `auditoria-seguridad`) se fusiona en local y no se sube.
- **La conexión con la base va cifrada porque lo pide el código** (`src/db/cifrado.ts`): postgres.js
  no cifra por defecto y el pooler de Supabase acepta conexiones sin cifrar. Un script nuevo que
  abra su propia conexión con `postgres()` lleva `...cifrado(url)` en las opciones.
- **Las rutas con `[id]` aceptan cualquier texto**: `Number(id)` puede ser `NaN`, un decimal o un
  número que no cabe en un `integer`, y Postgres lo rechaza con un error. Las consultas `obtener*`
  devuelven `null` si `!esIdValido(id)` (`src/lib/utils.ts`); una consulta nueva por id hace lo
  mismo, y un id de la URL se filtra con `ES_ID` (`src/lib/filtros.ts`). Por lo mismo, el `matcher`
  de `src/proxy.ts` no excluye rutas por su extensión: `/avisos/1.png` es una ruta de página.

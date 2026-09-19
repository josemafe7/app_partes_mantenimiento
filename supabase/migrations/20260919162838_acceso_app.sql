-- Quién puede tocar los datos de la aplicación.
--
-- La aplicación no usa la API de datos de Supabase (PostgREST): el servidor de
-- Next.js se conecta a Postgres por el pooler con un rol propio, app_avisos.
-- Así que:
--
--   1. anon y authenticated no tienen ningún permiso sobre estas tablas, y el
--      RLS está activado como segunda barrera. Con la clave publicable del
--      proyecto no se puede leer ni escribir nada.
--   2. app_avisos solo lee y escribe filas de estas seis tablas: no puede crear,
--      modificar ni borrar tablas. Los cambios de esquema van por migraciones.
--   3. La contraseña de app_avisos no va aquí, porque quedaría en el historial de
--      migraciones. Se pone aparte con ALTER ROLE (ver README).

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'app_avisos') then
    create role app_avisos nologin;
  end if;
end
$$;
--> statement-breakpoint
comment on role app_avisos is 'Servidor de la app de avisos y partes: solo lee y escribe filas de sus tablas.';
--> statement-breakpoint

-- 1. Nada por la API de datos -------------------------------------------------

revoke all on table clientes, locales, tecnicos, avisos, partes, movimientos from anon, authenticated;
--> statement-breakpoint
revoke all on sequence
  clientes_id_seq, locales_id_seq, tecnicos_id_seq, avisos_id_seq, partes_id_seq, movimientos_id_seq
  from anon, authenticated;
--> statement-breakpoint
alter table clientes enable row level security;
--> statement-breakpoint
alter table locales enable row level security;
--> statement-breakpoint
alter table tecnicos enable row level security;
--> statement-breakpoint
alter table avisos enable row level security;
--> statement-breakpoint
alter table partes enable row level security;
--> statement-breakpoint
alter table movimientos enable row level security;
--> statement-breakpoint

-- 2. La aplicación ------------------------------------------------------------

grant usage on schema public to app_avisos;
--> statement-breakpoint
grant select, insert, update, delete
  on table clientes, locales, tecnicos, avisos, partes, movimientos
  to app_avisos;
--> statement-breakpoint
-- update: los datos de ejemplo reinician la numeración con setval().
grant usage, select, update on sequence
  clientes_id_seq, locales_id_seq, tecnicos_id_seq, avisos_id_seq, partes_id_seq, movimientos_id_seq
  to app_avisos;
--> statement-breakpoint

-- Sin inicio de sesión todavía, la aplicación ve y edita todas las filas. Cuando
-- haya usuarios, estas políticas son las que habrá que afinar.
create policy "la app gestiona los clientes" on clientes
  for all to app_avisos using (true) with check (true);
--> statement-breakpoint
create policy "la app gestiona los locales" on locales
  for all to app_avisos using (true) with check (true);
--> statement-breakpoint
create policy "la app gestiona los tecnicos" on tecnicos
  for all to app_avisos using (true) with check (true);
--> statement-breakpoint
create policy "la app gestiona los avisos" on avisos
  for all to app_avisos using (true) with check (true);
--> statement-breakpoint
create policy "la app gestiona los partes" on partes
  for all to app_avisos using (true) with check (true);
--> statement-breakpoint
create policy "la app gestiona los movimientos" on movimientos
  for all to app_avisos using (true) with check (true);

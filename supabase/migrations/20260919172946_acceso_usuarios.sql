-- Quién puede tocar las tablas de usuarios (perfiles e intentos de acceso).
--
-- Lo mismo que con las seis tablas de datos (ver acceso_app), y aquí importa
-- todavía más: con el inicio de sesión cada usuario lleva un token del rol
-- authenticated, y con él no debe poder leer los perfiles ni cambiarse el rol
-- por la API de datos de Supabase. Solo el servidor (app_avisos) las toca.

-- 1. Nada por la API de datos -------------------------------------------------

revoke all on table perfiles, intentos_acceso from anon, authenticated;
--> statement-breakpoint
revoke all on sequence intentos_acceso_id_seq from anon, authenticated;
--> statement-breakpoint
alter table perfiles enable row level security;
--> statement-breakpoint
alter table intentos_acceso enable row level security;
--> statement-breakpoint

-- 2. La aplicación ------------------------------------------------------------

-- Sin delete en perfiles: un usuario no se borra, se desactiva. Así la
-- cronología de los avisos conserva quién hizo cada cambio.
grant select, insert, update on table perfiles to app_avisos;
--> statement-breakpoint
-- Los intentos de acceso se borran pasadas unas horas.
grant select, insert, delete on table intentos_acceso to app_avisos;
--> statement-breakpoint
grant usage, select on sequence intentos_acceso_id_seq to app_avisos;
--> statement-breakpoint

create policy "la app gestiona los perfiles" on perfiles
  for all to app_avisos using (true) with check (true);
--> statement-breakpoint
create policy "la app gestiona los intentos de acceso" on intentos_acceso
  for all to app_avisos using (true) with check (true);

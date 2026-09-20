-- Dos cierres que salieron de la auditoría de seguridad del 20-09-2026.
--
-- 1. Que una tabla FUTURA no nazca abierta a la API de datos.
--
-- Supabase deja configurado que todo lo que el rol postgres cree en `public`
-- (tablas, secuencias y funciones) se conceda entero a `anon` y `authenticated`,
-- los roles con los que entra cualquiera por la API de datos. Las tablas de hoy
-- están cerradas porque cada migración lo deshace a mano (acceso_app,
-- acceso_usuarios), pero bastaba con que una migración nueva olvidase su
-- `revoke` y su RLS para que esa tabla se pudiera leer y escribir desde internet
-- con la clave publicable. Las migraciones se aplican como postgres, así que se
-- le quita ese valor por defecto: una tabla nueva nace sin permisos para nadie
-- más, y lo que necesite la aplicación se le concede a `app_avisos` a propósito.
--
-- No cambia nada de lo que ya existe: solo lo que se cree a partir de ahora.

alter default privileges for role postgres in schema public
  revoke all on tables from anon, authenticated;
--> statement-breakpoint
alter default privileges for role postgres in schema public
  revoke all on sequences from anon, authenticated;
--> statement-breakpoint
alter default privileges for role postgres in schema public
  revoke all on functions from anon, authenticated;
--> statement-breakpoint

-- 2. La cronología no se corrige.
--
-- `movimientos` es el registro de quién cambió qué en cada aviso. La aplicación
-- solo añade líneas (y se borran con su aviso, en cascada); nunca modifica una.
-- Sin `update`, ni un fallo de la aplicación podría reescribir la historia.

revoke update on table movimientos from app_avisos;

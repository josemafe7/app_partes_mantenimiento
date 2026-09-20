CREATE TABLE "lecturas_ia" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "lecturas_ia_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"usuario_id" uuid NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lecturas_ia" ADD CONSTRAINT "lecturas_ia_usuario_id_perfiles_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."perfiles"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_lecturas_ia_usuario_fecha" ON "lecturas_ia" USING btree ("usuario_id","fecha");--> statement-breakpoint

-- Quién puede tocarla: lo mismo que el resto de tablas (ver acceso_app y
-- acceso_usuarios). Nada por la API de datos de Supabase, RLS activado y la
-- aplicación (app_avisos) solo con lo que necesita: anotar una lectura, contar
-- las de un usuario y borrar las de más de un día. Sin update: no se corrigen.

revoke all on table lecturas_ia from anon, authenticated;
--> statement-breakpoint
revoke all on sequence lecturas_ia_id_seq from anon, authenticated;
--> statement-breakpoint
alter table lecturas_ia enable row level security;
--> statement-breakpoint
grant select, insert, delete on table lecturas_ia to app_avisos;
--> statement-breakpoint
grant usage, select on sequence lecturas_ia_id_seq to app_avisos;
--> statement-breakpoint
create policy "la app gestiona las lecturas con IA" on lecturas_ia
  for all to app_avisos using (true) with check (true);

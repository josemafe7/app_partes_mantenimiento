CREATE TABLE "intentos_acceso" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "intentos_acceso_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"email" text NOT NULL,
	"ip" text,
	"exito" boolean NOT NULL,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "perfiles" (
	"id" uuid PRIMARY KEY NOT NULL,
	"nombre" text NOT NULL,
	"email" text NOT NULL,
	"rol" text NOT NULL,
	"tecnico_id" integer,
	"activo" boolean DEFAULT true NOT NULL,
	"debe_cambiar_contrasena" boolean DEFAULT true NOT NULL,
	"sesiones_validas_desde" timestamp with time zone DEFAULT now() NOT NULL,
	"ultimo_acceso" timestamp with time zone,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_perfiles_rol" CHECK ("perfiles"."rol" in ('administrador', 'oficina', 'tecnico')),
	CONSTRAINT "chk_perfiles_tecnico" CHECK ("perfiles"."tecnico_id" is null or "perfiles"."rol" = 'tecnico')
);
--> statement-breakpoint
ALTER TABLE "movimientos" ADD COLUMN "usuario_id" uuid;--> statement-breakpoint
ALTER TABLE "partes" ADD COLUMN "creado_por" uuid;--> statement-breakpoint
ALTER TABLE "perfiles" ADD CONSTRAINT "perfiles_id_users_id_fk" FOREIGN KEY ("id") REFERENCES "auth"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "perfiles" ADD CONSTRAINT "perfiles_tecnico_id_tecnicos_id_fk" FOREIGN KEY ("tecnico_id") REFERENCES "public"."tecnicos"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_intentos_email_fecha" ON "intentos_acceso" USING btree ("email","fecha");--> statement-breakpoint
CREATE INDEX "idx_intentos_ip_fecha" ON "intentos_acceso" USING btree ("ip","fecha");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_perfiles_email" ON "perfiles" USING btree ("email");--> statement-breakpoint
CREATE UNIQUE INDEX "idx_perfiles_tecnico" ON "perfiles" USING btree ("tecnico_id");--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_usuario_id_perfiles_id_fk" FOREIGN KEY ("usuario_id") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partes" ADD CONSTRAINT "partes_creado_por_perfiles_id_fk" FOREIGN KEY ("creado_por") REFERENCES "public"."perfiles"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_movimientos_usuario" ON "movimientos" USING btree ("usuario_id");--> statement-breakpoint
CREATE INDEX "idx_partes_creado_por" ON "partes" USING btree ("creado_por");
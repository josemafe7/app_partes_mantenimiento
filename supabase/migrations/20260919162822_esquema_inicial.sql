CREATE TABLE "avisos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "avisos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"referencia" text NOT NULL,
	"cliente_id" integer NOT NULL,
	"local_id" integer NOT NULL,
	"tecnico_id" integer,
	"titulo" text NOT NULL,
	"descripcion" text,
	"categoria" text NOT NULL,
	"prioridad" text DEFAULT 'normal' NOT NULL,
	"estado" text DEFAULT 'pendiente' NOT NULL,
	"canal_entrada" text DEFAULT 'telefono' NOT NULL,
	"contacto_aviso" text,
	"fecha_aviso" timestamp with time zone DEFAULT now() NOT NULL,
	"fecha_programada" date,
	"hora_programada" text,
	"fecha_cierre" timestamp with time zone,
	"motivo_espera" text,
	"resumen_cierre" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_avisos_estado" CHECK ("avisos"."estado" in ('pendiente', 'asignado', 'en_curso', 'en_espera', 'finalizado', 'cancelado')),
	CONSTRAINT "chk_avisos_prioridad" CHECK ("avisos"."prioridad" in ('baja', 'normal', 'alta', 'urgente')),
	CONSTRAINT "chk_avisos_categoria" CHECK ("avisos"."categoria" in ('fontaneria', 'electricidad', 'climatizacion', 'cerrajeria', 'carpinteria', 'pintura', 'cristaleria', 'albanileria', 'otros')),
	CONSTRAINT "chk_avisos_canal" CHECK ("avisos"."canal_entrada" in ('telefono', 'whatsapp', 'email', 'presencial', 'otro')),
	CONSTRAINT "chk_avisos_hora" CHECK ("avisos"."hora_programada" ~ '^([01][0-9]|2[0-3]):[0-5][0-9]$')
);
--> statement-breakpoint
CREATE TABLE "clientes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "clientes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"cif" text,
	"persona_contacto" text,
	"telefono" text,
	"email" text,
	"direccion_facturacion" text,
	"notas" text,
	"archivado" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "locales" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "locales_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"cliente_id" integer NOT NULL,
	"nombre" text NOT NULL,
	"direccion" text NOT NULL,
	"ciudad" text NOT NULL,
	"provincia" text,
	"codigo_postal" text,
	"telefono" text,
	"persona_contacto" text,
	"horario" text,
	"notas_acceso" text,
	"archivado" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "movimientos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "movimientos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"aviso_id" integer NOT NULL,
	"estado_anterior" text,
	"estado_nuevo" text NOT NULL,
	"nota" text,
	"fecha" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_movimientos_estado_anterior" CHECK ("movimientos"."estado_anterior" in ('pendiente', 'asignado', 'en_curso', 'en_espera', 'finalizado', 'cancelado')),
	CONSTRAINT "chk_movimientos_estado_nuevo" CHECK ("movimientos"."estado_nuevo" in ('pendiente', 'asignado', 'en_curso', 'en_espera', 'finalizado', 'cancelado'))
);
--> statement-breakpoint
CREATE TABLE "partes" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "partes_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"aviso_id" integer NOT NULL,
	"tecnico_id" integer NOT NULL,
	"fecha" date NOT NULL,
	"horas" double precision DEFAULT 1 NOT NULL,
	"trabajo_realizado" text NOT NULL,
	"materiales" text,
	"resuelto" boolean DEFAULT false NOT NULL,
	"observaciones" text,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_partes_horas" CHECK ("partes"."horas" > 0 and "partes"."horas" <= 24)
);
--> statement-breakpoint
CREATE TABLE "tecnicos" (
	"id" integer PRIMARY KEY GENERATED ALWAYS AS IDENTITY (sequence name "tecnicos_id_seq" INCREMENT BY 1 MINVALUE 1 MAXVALUE 2147483647 START WITH 1 CACHE 1),
	"nombre" text NOT NULL,
	"apellidos" text,
	"telefono" text,
	"email" text,
	"especialidades" text[] DEFAULT '{}'::text[] NOT NULL,
	"zona" text,
	"notas" text,
	"archivado" boolean DEFAULT false NOT NULL,
	"creado_en" timestamp with time zone DEFAULT now() NOT NULL,
	"actualizado_en" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "chk_tecnicos_especialidades" CHECK ("tecnicos"."especialidades" <@ array['fontaneria', 'electricidad', 'climatizacion', 'cerrajeria', 'carpinteria', 'pintura', 'cristaleria', 'albanileria', 'multiservicio']::text[])
);
--> statement-breakpoint
ALTER TABLE "avisos" ADD CONSTRAINT "avisos_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avisos" ADD CONSTRAINT "avisos_local_id_locales_id_fk" FOREIGN KEY ("local_id") REFERENCES "public"."locales"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "avisos" ADD CONSTRAINT "avisos_tecnico_id_tecnicos_id_fk" FOREIGN KEY ("tecnico_id") REFERENCES "public"."tecnicos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "locales" ADD CONSTRAINT "locales_cliente_id_clientes_id_fk" FOREIGN KEY ("cliente_id") REFERENCES "public"."clientes"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "movimientos" ADD CONSTRAINT "movimientos_aviso_id_avisos_id_fk" FOREIGN KEY ("aviso_id") REFERENCES "public"."avisos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partes" ADD CONSTRAINT "partes_aviso_id_avisos_id_fk" FOREIGN KEY ("aviso_id") REFERENCES "public"."avisos"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partes" ADD CONSTRAINT "partes_tecnico_id_tecnicos_id_fk" FOREIGN KEY ("tecnico_id") REFERENCES "public"."tecnicos"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_avisos_referencia" ON "avisos" USING btree ("referencia");--> statement-breakpoint
CREATE INDEX "idx_avisos_estado" ON "avisos" USING btree ("estado");--> statement-breakpoint
CREATE INDEX "idx_avisos_cliente" ON "avisos" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_avisos_tecnico" ON "avisos" USING btree ("tecnico_id");--> statement-breakpoint
CREATE INDEX "idx_avisos_local" ON "avisos" USING btree ("local_id");--> statement-breakpoint
CREATE INDEX "idx_avisos_fecha_programada" ON "avisos" USING btree ("fecha_programada");--> statement-breakpoint
CREATE INDEX "idx_clientes_nombre" ON "clientes" USING btree ("nombre");--> statement-breakpoint
CREATE INDEX "idx_locales_cliente" ON "locales" USING btree ("cliente_id");--> statement-breakpoint
CREATE INDEX "idx_movimientos_aviso" ON "movimientos" USING btree ("aviso_id");--> statement-breakpoint
CREATE INDEX "idx_movimientos_fecha" ON "movimientos" USING btree ("fecha");--> statement-breakpoint
CREATE INDEX "idx_partes_aviso" ON "partes" USING btree ("aviso_id");--> statement-breakpoint
CREATE INDEX "idx_partes_tecnico" ON "partes" USING btree ("tecnico_id");--> statement-breakpoint
CREATE INDEX "idx_partes_fecha" ON "partes" USING btree ("fecha");
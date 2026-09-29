import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
    await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('de', 'en');
  CREATE TYPE "public"."enum_entries_at_precision" AS ENUM('year', 'month', 'day');
  CREATE TYPE "public"."enum_entries_ended_at_precision" AS ENUM('year', 'month', 'day');
  CREATE TYPE "public"."enum_entries_type" AS ENUM('war', 'revolution', 'power', 'event');
  CREATE TYPE "public"."enum_entries_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__entries_v_version_at_precision" AS ENUM('year', 'month', 'day');
  CREATE TYPE "public"."enum__entries_v_version_ended_at_precision" AS ENUM('year', 'month', 'day');
  CREATE TYPE "public"."enum__entries_v_version_type" AS ENUM('war', 'revolution', 'power', 'event');
  CREATE TYPE "public"."enum__entries_v_version_status" AS ENUM('draft', 'published');
  CREATE TYPE "public"."enum__entries_v_published_locale" AS ENUM('de', 'en');
  CREATE TYPE "public"."enum_tags_kind" AS ENUM('actor', 'place');
  CREATE TABLE "entries" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar,
  	"at" timestamp(3) with time zone,
  	"at_precision" "enum_entries_at_precision",
  	"ended_at" timestamp(3) with time zone,
  	"ended_at_precision" "enum_entries_ended_at_precision",
  	"ongoing" boolean,
  	"type" "enum_entries_type",
  	"subject_id" integer,
  	"part_of_id" integer,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"_status" "enum_entries_status" DEFAULT 'draft'
  );
  
  CREATE TABLE "entries_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "entries_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer
  );
  
  CREATE TABLE "_entries_v" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"parent_id" integer,
  	"version_slug" varchar,
  	"version_at" timestamp(3) with time zone,
  	"version_at_precision" "enum__entries_v_version_at_precision",
  	"version_ended_at" timestamp(3) with time zone,
  	"version_ended_at_precision" "enum__entries_v_version_ended_at_precision",
  	"version_ongoing" boolean,
  	"version_type" "enum__entries_v_version_type",
  	"version_subject_id" integer,
  	"version_part_of_id" integer,
  	"version_updated_at" timestamp(3) with time zone,
  	"version_created_at" timestamp(3) with time zone,
  	"version__status" "enum__entries_v_version_status" DEFAULT 'draft',
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"snapshot" boolean,
  	"published_locale" "enum__entries_v_published_locale",
  	"latest" boolean
  );
  
  CREATE TABLE "_entries_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_entries_v_rels" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"order" integer,
  	"parent_id" integer NOT NULL,
  	"path" varchar NOT NULL,
  	"tags_id" integer
  );
  
  CREATE TABLE "subjects" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "subjects_locales" (
  	"name" varchar NOT NULL,
  	"summary" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "tags" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"slug" varchar NOT NULL,
  	"kind" "enum_tags_kind" NOT NULL,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL
  );
  
  CREATE TABLE "tags_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "entries_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "subjects_id" integer;
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "tags_id" integer;
  ALTER TABLE "entries" ADD CONSTRAINT "entries_subject_id_subjects_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "entries" ADD CONSTRAINT "entries_part_of_id_entries_id_fk" FOREIGN KEY ("part_of_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "entries_locales" ADD CONSTRAINT "entries_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "entries_rels" ADD CONSTRAINT "entries_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "entries_rels" ADD CONSTRAINT "entries_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_entries_v" ADD CONSTRAINT "_entries_v_parent_id_entries_id_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_entries_v" ADD CONSTRAINT "_entries_v_version_subject_id_subjects_id_fk" FOREIGN KEY ("version_subject_id") REFERENCES "public"."subjects"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_entries_v" ADD CONSTRAINT "_entries_v_version_part_of_id_entries_id_fk" FOREIGN KEY ("version_part_of_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_entries_v_locales" ADD CONSTRAINT "_entries_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_entries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_entries_v_rels" ADD CONSTRAINT "_entries_v_rels_parent_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."_entries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_entries_v_rels" ADD CONSTRAINT "_entries_v_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "subjects_locales" ADD CONSTRAINT "subjects_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tags_locales" ADD CONSTRAINT "tags_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "entries_slug_idx" ON "entries" USING btree ("slug");
  CREATE INDEX "entries_subject_idx" ON "entries" USING btree ("subject_id");
  CREATE INDEX "entries_part_of_idx" ON "entries" USING btree ("part_of_id");
  CREATE INDEX "entries_updated_at_idx" ON "entries" USING btree ("updated_at");
  CREATE INDEX "entries_created_at_idx" ON "entries" USING btree ("created_at");
  CREATE INDEX "entries__status_idx" ON "entries" USING btree ("_status");
  CREATE UNIQUE INDEX "entries_locales_locale_parent_id_unique" ON "entries_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "entries_rels_order_idx" ON "entries_rels" USING btree ("order");
  CREATE INDEX "entries_rels_parent_idx" ON "entries_rels" USING btree ("parent_id");
  CREATE INDEX "entries_rels_path_idx" ON "entries_rels" USING btree ("path");
  CREATE INDEX "entries_rels_tags_id_idx" ON "entries_rels" USING btree ("tags_id");
  CREATE INDEX "_entries_v_parent_idx" ON "_entries_v" USING btree ("parent_id");
  CREATE INDEX "_entries_v_version_version_slug_idx" ON "_entries_v" USING btree ("version_slug");
  CREATE INDEX "_entries_v_version_version_subject_idx" ON "_entries_v" USING btree ("version_subject_id");
  CREATE INDEX "_entries_v_version_version_part_of_idx" ON "_entries_v" USING btree ("version_part_of_id");
  CREATE INDEX "_entries_v_version_version_updated_at_idx" ON "_entries_v" USING btree ("version_updated_at");
  CREATE INDEX "_entries_v_version_version_created_at_idx" ON "_entries_v" USING btree ("version_created_at");
  CREATE INDEX "_entries_v_version_version__status_idx" ON "_entries_v" USING btree ("version__status");
  CREATE INDEX "_entries_v_created_at_idx" ON "_entries_v" USING btree ("created_at");
  CREATE INDEX "_entries_v_updated_at_idx" ON "_entries_v" USING btree ("updated_at");
  CREATE INDEX "_entries_v_snapshot_idx" ON "_entries_v" USING btree ("snapshot");
  CREATE INDEX "_entries_v_published_locale_idx" ON "_entries_v" USING btree ("published_locale");
  CREATE INDEX "_entries_v_latest_idx" ON "_entries_v" USING btree ("latest");
  CREATE UNIQUE INDEX "_entries_v_locales_locale_parent_id_unique" ON "_entries_v_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_entries_v_rels_order_idx" ON "_entries_v_rels" USING btree ("order");
  CREATE INDEX "_entries_v_rels_parent_idx" ON "_entries_v_rels" USING btree ("parent_id");
  CREATE INDEX "_entries_v_rels_path_idx" ON "_entries_v_rels" USING btree ("path");
  CREATE INDEX "_entries_v_rels_tags_id_idx" ON "_entries_v_rels" USING btree ("tags_id");
  CREATE UNIQUE INDEX "subjects_slug_idx" ON "subjects" USING btree ("slug");
  CREATE INDEX "subjects_updated_at_idx" ON "subjects" USING btree ("updated_at");
  CREATE INDEX "subjects_created_at_idx" ON "subjects" USING btree ("created_at");
  CREATE UNIQUE INDEX "subjects_name_idx" ON "subjects_locales" USING btree ("name","_locale");
  CREATE UNIQUE INDEX "subjects_locales_locale_parent_id_unique" ON "subjects_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");
  CREATE INDEX "tags_updated_at_idx" ON "tags" USING btree ("updated_at");
  CREATE INDEX "tags_created_at_idx" ON "tags" USING btree ("created_at");
  CREATE UNIQUE INDEX "tags_name_idx" ON "tags_locales" USING btree ("name","_locale");
  CREATE UNIQUE INDEX "tags_locales_locale_parent_id_unique" ON "tags_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_entries_fk" FOREIGN KEY ("entries_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_subjects_fk" FOREIGN KEY ("subjects_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_tags_fk" FOREIGN KEY ("tags_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_entries_id_idx" ON "payload_locked_documents_rels" USING btree ("entries_id");
  CREATE INDEX "payload_locked_documents_rels_subjects_id_idx" ON "payload_locked_documents_rels" USING btree ("subjects_id");
  CREATE INDEX "payload_locked_documents_rels_tags_id_idx" ON "payload_locked_documents_rels" USING btree ("tags_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
   ALTER TABLE "entries" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "entries_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "entries_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_entries_v" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_entries_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_entries_v_rels" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subjects" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subjects_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tags" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tags_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "entries" CASCADE;
  DROP TABLE "entries_locales" CASCADE;
  DROP TABLE "entries_rels" CASCADE;
  DROP TABLE "_entries_v" CASCADE;
  DROP TABLE "_entries_v_locales" CASCADE;
  DROP TABLE "_entries_v_rels" CASCADE;
  DROP TABLE "subjects" CASCADE;
  DROP TABLE "subjects_locales" CASCADE;
  DROP TABLE "tags" CASCADE;
  DROP TABLE "tags_locales" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_entries_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_subjects_fk";
  
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_tags_fk";
  
  DROP INDEX "payload_locked_documents_rels_entries_id_idx";
  DROP INDEX "payload_locked_documents_rels_subjects_id_idx";
  DROP INDEX "payload_locked_documents_rels_tags_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "entries_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "subjects_id";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "tags_id";
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum_entries_at_precision";
  DROP TYPE "public"."enum_entries_ended_at_precision";
  DROP TYPE "public"."enum_entries_type";
  DROP TYPE "public"."enum_entries_status";
  DROP TYPE "public"."enum__entries_v_version_at_precision";
  DROP TYPE "public"."enum__entries_v_version_ended_at_precision";
  DROP TYPE "public"."enum__entries_v_version_type";
  DROP TYPE "public"."enum__entries_v_version_status";
  DROP TYPE "public"."enum__entries_v_published_locale";
  DROP TYPE "public"."enum_tags_kind";`)
}

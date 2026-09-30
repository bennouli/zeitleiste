import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
    await db.execute(sql`
   CREATE TABLE "media" (
  	"id" serial PRIMARY KEY NOT NULL,
  	"credit" varchar,
  	"updated_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"created_at" timestamp(3) with time zone DEFAULT now() NOT NULL,
  	"url" varchar,
  	"thumbnail_u_r_l" varchar,
  	"filename" varchar,
  	"mime_type" varchar,
  	"filesize" numeric,
  	"width" numeric,
  	"height" numeric,
  	"focal_x" numeric,
  	"focal_y" numeric,
  	"sizes_w480_url" varchar,
  	"sizes_w480_width" numeric,
  	"sizes_w480_height" numeric,
  	"sizes_w480_mime_type" varchar,
  	"sizes_w480_filesize" numeric,
  	"sizes_w480_filename" varchar,
  	"sizes_w960_url" varchar,
  	"sizes_w960_width" numeric,
  	"sizes_w960_height" numeric,
  	"sizes_w960_mime_type" varchar,
  	"sizes_w960_filesize" numeric,
  	"sizes_w960_filename" varchar,
  	"sizes_w1600_url" varchar,
  	"sizes_w1600_width" numeric,
  	"sizes_w1600_height" numeric,
  	"sizes_w1600_mime_type" varchar,
  	"sizes_w1600_filesize" numeric,
  	"sizes_w1600_filename" varchar
  );
  
  CREATE TABLE "media_locales" (
  	"alt" varchar,
  	"caption" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  ALTER TABLE "payload_locked_documents_rels" ADD COLUMN "media_id" integer;
  ALTER TABLE "media_locales" ADD CONSTRAINT "media_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "media_updated_at_idx" ON "media" USING btree ("updated_at");
  CREATE INDEX "media_created_at_idx" ON "media" USING btree ("created_at");
  CREATE UNIQUE INDEX "media_filename_idx" ON "media" USING btree ("filename");
  CREATE INDEX "media_sizes_w480_sizes_w480_filename_idx" ON "media" USING btree ("sizes_w480_filename");
  CREATE INDEX "media_sizes_w960_sizes_w960_filename_idx" ON "media" USING btree ("sizes_w960_filename");
  CREATE INDEX "media_sizes_w1600_sizes_w1600_filename_idx" ON "media" USING btree ("sizes_w1600_filename");
  CREATE UNIQUE INDEX "media_locales_locale_parent_id_unique" ON "media_locales" USING btree ("_locale","_parent_id");
  ALTER TABLE "payload_locked_documents_rels" ADD CONSTRAINT "payload_locked_documents_rels_media_fk" FOREIGN KEY ("media_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE INDEX "payload_locked_documents_rels_media_id_idx" ON "payload_locked_documents_rels" USING btree ("media_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
   ALTER TABLE "media" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "media_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "media" CASCADE;
  DROP TABLE "media_locales" CASCADE;
  ALTER TABLE "payload_locked_documents_rels" DROP CONSTRAINT "payload_locked_documents_rels_media_fk";
  
  DROP INDEX "payload_locked_documents_rels_media_id_idx";
  ALTER TABLE "payload_locked_documents_rels" DROP COLUMN "media_id";`)
}

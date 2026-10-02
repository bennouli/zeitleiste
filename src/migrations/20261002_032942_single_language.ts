import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
    await db.execute(sql`
  ALTER TABLE "entries" ADD COLUMN "title" varchar;
  ALTER TABLE "entries" ADD COLUMN "summary" varchar;
  ALTER TABLE "_entries_v" ADD COLUMN "version_title" varchar;
  ALTER TABLE "_entries_v" ADD COLUMN "version_summary" varchar;
  ALTER TABLE "posts" ADD COLUMN "body" jsonb;
  ALTER TABLE "subjects" ADD COLUMN "name" varchar;
  ALTER TABLE "subjects" ADD COLUMN "summary" varchar;
  ALTER TABLE "tags" ADD COLUMN "name" varchar;
  ALTER TABLE "media" ADD COLUMN "alt" varchar;
  ALTER TABLE "media" ADD COLUMN "caption" varchar;

  UPDATE "entries" SET "title" = l."title", "summary" = l."summary"
  FROM (SELECT DISTINCT ON ("_parent_id") * FROM "entries_locales" ORDER BY "_parent_id", "_locale" = 'de' DESC) AS l
  WHERE l."_parent_id" = "entries"."id";
  UPDATE "_entries_v" SET "version_title" = l."version_title", "version_summary" = l."version_summary"
  FROM (SELECT DISTINCT ON ("_parent_id") * FROM "_entries_v_locales" ORDER BY "_parent_id", "_locale" = 'de' DESC) AS l
  WHERE l."_parent_id" = "_entries_v"."id";
  UPDATE "posts" SET "body" = l."body"
  FROM (SELECT DISTINCT ON ("_parent_id") * FROM "posts_locales" ORDER BY "_parent_id", "_locale" = 'de' DESC) AS l
  WHERE l."_parent_id" = "posts"."id";
  UPDATE "subjects" SET "name" = l."name", "summary" = l."summary"
  FROM (SELECT DISTINCT ON ("_parent_id") * FROM "subjects_locales" ORDER BY "_parent_id", "_locale" = 'de' DESC) AS l
  WHERE l."_parent_id" = "subjects"."id";
  UPDATE "tags" SET "name" = l."name"
  FROM (SELECT DISTINCT ON ("_parent_id") * FROM "tags_locales" ORDER BY "_parent_id", "_locale" = 'de' DESC) AS l
  WHERE l."_parent_id" = "tags"."id";
  UPDATE "media" SET "alt" = l."alt", "caption" = l."caption"
  FROM (SELECT DISTINCT ON ("_parent_id") * FROM "media_locales" ORDER BY "_parent_id", "_locale" = 'de' DESC) AS l
  WHERE l."_parent_id" = "media"."id";

  ALTER TABLE "posts" ALTER COLUMN "body" SET NOT NULL;
  ALTER TABLE "subjects" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "tags" ALTER COLUMN "name" SET NOT NULL;
  ALTER TABLE "media" ALTER COLUMN "alt" SET NOT NULL;

  ALTER TABLE "entries_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "_entries_v_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "posts_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "subjects_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "tags_locales" DISABLE ROW LEVEL SECURITY;
  ALTER TABLE "media_locales" DISABLE ROW LEVEL SECURITY;
  DROP TABLE "entries_locales" CASCADE;
  DROP TABLE "_entries_v_locales" CASCADE;
  DROP TABLE "posts_locales" CASCADE;
  DROP TABLE "subjects_locales" CASCADE;
  DROP TABLE "tags_locales" CASCADE;
  DROP TABLE "media_locales" CASCADE;
  DROP INDEX "_entries_v_snapshot_idx";
  DROP INDEX "_entries_v_published_locale_idx";
  CREATE UNIQUE INDEX "subjects_name_idx" ON "subjects" USING btree ("name");
  CREATE UNIQUE INDEX "tags_name_idx" ON "tags" USING btree ("name");
  ALTER TABLE "_entries_v" DROP COLUMN "snapshot";
  ALTER TABLE "_entries_v" DROP COLUMN "published_locale";
  DROP TYPE "public"."_locales";
  DROP TYPE "public"."enum__entries_v_published_locale";`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
   CREATE TYPE "public"."_locales" AS ENUM('de', 'en');
  CREATE TYPE "public"."enum__entries_v_published_locale" AS ENUM('de', 'en');
  CREATE TABLE "entries_locales" (
  	"title" varchar,
  	"summary" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "_entries_v_locales" (
  	"version_title" varchar,
  	"version_summary" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "posts_locales" (
  	"body" jsonb,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "subjects_locales" (
  	"name" varchar NOT NULL,
  	"summary" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "tags_locales" (
  	"name" varchar NOT NULL,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  CREATE TABLE "media_locales" (
  	"alt" varchar,
  	"caption" varchar,
  	"id" serial PRIMARY KEY NOT NULL,
  	"_locale" "_locales" NOT NULL,
  	"_parent_id" integer NOT NULL
  );
  
  DROP INDEX "subjects_name_idx";
  DROP INDEX "tags_name_idx";
  ALTER TABLE "_entries_v" ADD COLUMN "snapshot" boolean;
  ALTER TABLE "_entries_v" ADD COLUMN "published_locale" "enum__entries_v_published_locale";
  ALTER TABLE "entries_locales" ADD CONSTRAINT "entries_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."entries"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "_entries_v_locales" ADD CONSTRAINT "_entries_v_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."_entries_v"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "posts_locales" ADD CONSTRAINT "posts_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."posts"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "subjects_locales" ADD CONSTRAINT "subjects_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."subjects"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "tags_locales" ADD CONSTRAINT "tags_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."tags"("id") ON DELETE cascade ON UPDATE no action;
  ALTER TABLE "media_locales" ADD CONSTRAINT "media_locales_parent_id_fk" FOREIGN KEY ("_parent_id") REFERENCES "public"."media"("id") ON DELETE cascade ON UPDATE no action;
  CREATE UNIQUE INDEX "entries_locales_locale_parent_id_unique" ON "entries_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "_entries_v_locales_locale_parent_id_unique" ON "_entries_v_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "posts_locales_locale_parent_id_unique" ON "posts_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "subjects_name_idx" ON "subjects_locales" USING btree ("name","_locale");
  CREATE UNIQUE INDEX "subjects_locales_locale_parent_id_unique" ON "subjects_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "tags_name_idx" ON "tags_locales" USING btree ("name","_locale");
  CREATE UNIQUE INDEX "tags_locales_locale_parent_id_unique" ON "tags_locales" USING btree ("_locale","_parent_id");
  CREATE UNIQUE INDEX "media_locales_locale_parent_id_unique" ON "media_locales" USING btree ("_locale","_parent_id");
  CREATE INDEX "_entries_v_snapshot_idx" ON "_entries_v" USING btree ("snapshot");
  CREATE INDEX "_entries_v_published_locale_idx" ON "_entries_v" USING btree ("published_locale");

  INSERT INTO "entries_locales" ("title", "summary", "_locale", "_parent_id") SELECT "title", "summary", 'de', "id" FROM "entries";
  INSERT INTO "_entries_v_locales" ("version_title", "version_summary", "_locale", "_parent_id") SELECT "version_title", "version_summary", 'de', "id" FROM "_entries_v";
  INSERT INTO "posts_locales" ("body", "_locale", "_parent_id") SELECT "body", 'de', "id" FROM "posts";
  INSERT INTO "subjects_locales" ("name", "summary", "_locale", "_parent_id") SELECT "name", "summary", 'de', "id" FROM "subjects";
  INSERT INTO "tags_locales" ("name", "_locale", "_parent_id") SELECT "name", 'de', "id" FROM "tags";
  INSERT INTO "media_locales" ("alt", "caption", "_locale", "_parent_id") SELECT "alt", "caption", 'de', "id" FROM "media";

  ALTER TABLE "entries" DROP COLUMN "title";
  ALTER TABLE "entries" DROP COLUMN "summary";
  ALTER TABLE "_entries_v" DROP COLUMN "version_title";
  ALTER TABLE "_entries_v" DROP COLUMN "version_summary";
  ALTER TABLE "posts" DROP COLUMN "body";
  ALTER TABLE "subjects" DROP COLUMN "name";
  ALTER TABLE "subjects" DROP COLUMN "summary";
  ALTER TABLE "tags" DROP COLUMN "name";
  ALTER TABLE "media" DROP COLUMN "alt";
  ALTER TABLE "media" DROP COLUMN "caption";`)
}

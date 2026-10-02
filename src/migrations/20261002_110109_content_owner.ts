import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'
import { Schema } from 'effect'

const OWNER_COLUMNS = [
    ['entries', 'owner_id'],
    ['_entries_v', 'version_owner_id'],
    ['posts', 'owner_id'],
    ['subjects', 'owner_id'],
    ['tags', 'owner_id'],
    ['media', 'owner_id'],
] as const

const IdRows = Schema.Array(Schema.Struct({ id: Schema.Number }))
const CountRows = Schema.Tuple([Schema.Struct({ n: Schema.Number })])

async function oldestAdminId(
    db: MigrateUpArgs['db']
): Promise<number | undefined> {
    const { rows } = await db.execute(sql`
    SELECT "id" FROM "users" WHERE "role" = 'admin' ORDER BY "created_at", "id" LIMIT 1`)
    return Schema.decodeUnknownSync(IdRows)(rows)[0]?.id
}

async function contentCount(db: MigrateUpArgs['db']): Promise<number> {
    const counts = await Promise.all(
        OWNER_COLUMNS.map(async ([table]) => {
            const { rows } = await db.execute(
                sql`SELECT count(*)::int AS "n" FROM ${sql.identifier(table)}`
            )
            return Schema.decodeUnknownSync(CountRows)(rows)[0].n
        })
    )
    return counts.reduce((sum, n) => sum + n, 0)
}

async function fillOwners(db: MigrateUpArgs['db'], owner: number) {
    for (const [table, column] of OWNER_COLUMNS)
        await db.execute(
            sql`UPDATE ${sql.identifier(table)} SET ${sql.identifier(column)} = ${owner}`
        )
}

export async function up({ db }: MigrateUpArgs): Promise<void> {
    const owner = await oldestAdminId(db)
    if (owner === undefined && (await contentCount(db)) > 0)
        throw new Error(
            'content_owner: content exists but no admin account to own it; create an admin first'
        )
    await db.execute(sql`
   DROP INDEX "subjects_name_idx";
  DROP INDEX "tags_name_idx";
  DROP INDEX "entries_slug_idx";
  DROP INDEX "subjects_slug_idx";
  DROP INDEX "tags_slug_idx";
  ALTER TABLE "entries" ADD COLUMN "owner_id" integer;
  ALTER TABLE "_entries_v" ADD COLUMN "version_owner_id" integer;
  ALTER TABLE "posts" ADD COLUMN "owner_id" integer;
  ALTER TABLE "subjects" ADD COLUMN "owner_id" integer;
  ALTER TABLE "tags" ADD COLUMN "owner_id" integer;
  ALTER TABLE "media" ADD COLUMN "owner_id" integer;`)
    if (owner !== undefined) await fillOwners(db, owner)
    await db.execute(sql`
  ALTER TABLE "posts" ALTER COLUMN "owner_id" SET NOT NULL;
  ALTER TABLE "subjects" ALTER COLUMN "owner_id" SET NOT NULL;
  ALTER TABLE "tags" ALTER COLUMN "owner_id" SET NOT NULL;
  ALTER TABLE "media" ALTER COLUMN "owner_id" SET NOT NULL;
  ALTER TABLE "entries" ADD CONSTRAINT "entries_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "_entries_v" ADD CONSTRAINT "_entries_v_version_owner_id_users_id_fk" FOREIGN KEY ("version_owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "posts" ADD CONSTRAINT "posts_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "subjects" ADD CONSTRAINT "subjects_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "tags" ADD CONSTRAINT "tags_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  ALTER TABLE "media" ADD CONSTRAINT "media_owner_id_users_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "entries_owner_idx" ON "entries" USING btree ("owner_id");
  CREATE UNIQUE INDEX "owner_slug_idx" ON "entries" USING btree ("owner_id","slug");
  CREATE INDEX "_entries_v_version_version_owner_idx" ON "_entries_v" USING btree ("version_owner_id");
  CREATE INDEX "version_owner_version_slug_idx" ON "_entries_v" USING btree ("version_owner_id","version_slug");
  CREATE INDEX "posts_owner_idx" ON "posts" USING btree ("owner_id");
  CREATE INDEX "subjects_owner_idx" ON "subjects" USING btree ("owner_id");
  CREATE UNIQUE INDEX "owner_name_idx" ON "subjects" USING btree ("owner_id","name");
  CREATE UNIQUE INDEX "owner_slug_1_idx" ON "subjects" USING btree ("owner_id","slug");
  CREATE INDEX "tags_owner_idx" ON "tags" USING btree ("owner_id");
  CREATE UNIQUE INDEX "owner_name_1_idx" ON "tags" USING btree ("owner_id","name");
  CREATE UNIQUE INDEX "owner_slug_2_idx" ON "tags" USING btree ("owner_id","slug");
  CREATE INDEX "media_owner_idx" ON "media" USING btree ("owner_id");
  CREATE INDEX "entries_slug_idx" ON "entries" USING btree ("slug");
  CREATE INDEX "subjects_slug_idx" ON "subjects" USING btree ("slug");
  CREATE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
   ALTER TABLE "entries" DROP CONSTRAINT "entries_owner_id_users_id_fk";
  
  ALTER TABLE "_entries_v" DROP CONSTRAINT "_entries_v_version_owner_id_users_id_fk";
  
  ALTER TABLE "posts" DROP CONSTRAINT "posts_owner_id_users_id_fk";
  
  ALTER TABLE "subjects" DROP CONSTRAINT "subjects_owner_id_users_id_fk";
  
  ALTER TABLE "tags" DROP CONSTRAINT "tags_owner_id_users_id_fk";
  
  ALTER TABLE "media" DROP CONSTRAINT "media_owner_id_users_id_fk";
  
  DROP INDEX "entries_owner_idx";
  DROP INDEX "owner_slug_idx";
  DROP INDEX "_entries_v_version_version_owner_idx";
  DROP INDEX "version_owner_version_slug_idx";
  DROP INDEX "posts_owner_idx";
  DROP INDEX "subjects_owner_idx";
  DROP INDEX "owner_name_idx";
  DROP INDEX "owner_slug_1_idx";
  DROP INDEX "tags_owner_idx";
  DROP INDEX "owner_name_1_idx";
  DROP INDEX "owner_slug_2_idx";
  DROP INDEX "media_owner_idx";
  DROP INDEX "entries_slug_idx";
  DROP INDEX "subjects_slug_idx";
  DROP INDEX "tags_slug_idx";
  CREATE UNIQUE INDEX "subjects_name_idx" ON "subjects" USING btree ("name");
  CREATE UNIQUE INDEX "tags_name_idx" ON "tags" USING btree ("name");
  CREATE UNIQUE INDEX "entries_slug_idx" ON "entries" USING btree ("slug");
  CREATE UNIQUE INDEX "subjects_slug_idx" ON "subjects" USING btree ("slug");
  CREATE UNIQUE INDEX "tags_slug_idx" ON "tags" USING btree ("slug");
  ALTER TABLE "entries" DROP COLUMN "owner_id";
  ALTER TABLE "_entries_v" DROP COLUMN "version_owner_id";
  ALTER TABLE "posts" DROP COLUMN "owner_id";
  ALTER TABLE "subjects" DROP COLUMN "owner_id";
  ALTER TABLE "tags" DROP COLUMN "owner_id";
  ALTER TABLE "media" DROP COLUMN "owner_id";`)
}

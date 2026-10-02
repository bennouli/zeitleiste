import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db, payload, req }: MigrateUpArgs): Promise<void> {
    await db.execute(sql`
   ALTER TABLE "entries" ADD CONSTRAINT "entries_owner_required" CHECK ("entries"."owner_id" IS NOT NULL);
  ALTER TABLE "_entries_v" ADD CONSTRAINT "_entries_v_version_owner_required" CHECK ("_entries_v"."version_owner_id" IS NOT NULL);`)
}

export async function down({
    db,
    payload,
    req,
}: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
   ALTER TABLE "entries" DROP CONSTRAINT "entries_owner_required";
  ALTER TABLE "_entries_v" DROP CONSTRAINT "_entries_v_version_owner_required";`)
}

import { MigrateDownArgs, MigrateUpArgs, sql } from '@payloadcms/db-postgres'

export async function up({ db }: MigrateUpArgs): Promise<void> {
    await db.execute(sql`
   ALTER TABLE "notes" ADD COLUMN "entry_id" integer;
  ALTER TABLE "notes" ADD CONSTRAINT "notes_entry_id_entries_id_fk" FOREIGN KEY ("entry_id") REFERENCES "public"."entries"("id") ON DELETE set null ON UPDATE no action;
  CREATE INDEX "notes_entry_idx" ON "notes" USING btree ("entry_id");`)
}

export async function down({ db }: MigrateDownArgs): Promise<void> {
    await db.execute(sql`
   ALTER TABLE "notes" DROP CONSTRAINT "notes_entry_id_entries_id_fk";
  
  DROP INDEX "notes_entry_idx";
  ALTER TABLE "notes" DROP COLUMN "entry_id";`)
}

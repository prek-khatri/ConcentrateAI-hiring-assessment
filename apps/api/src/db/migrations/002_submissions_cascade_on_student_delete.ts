import { Kysely, sql } from "kysely";

// Let deleting a student remove their submissions (grades cascade from submissions
// already), so an admin can delete a student who has turned in work — instead of
// the delete being blocked by a foreign-key restriction.
export async function up(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE submissions DROP CONSTRAINT submissions_student_id_fkey`.execute(db);
  await sql`
    ALTER TABLE submissions
    ADD CONSTRAINT submissions_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES users(id) ON DELETE CASCADE
  `.execute(db);
}

export async function down(db: Kysely<unknown>): Promise<void> {
  await sql`ALTER TABLE submissions DROP CONSTRAINT submissions_student_id_fkey`.execute(db);
  await sql`
    ALTER TABLE submissions
    ADD CONSTRAINT submissions_student_id_fkey
    FOREIGN KEY (student_id) REFERENCES users(id)
  `.execute(db);
}

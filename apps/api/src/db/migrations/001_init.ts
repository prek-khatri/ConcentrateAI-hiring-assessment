import { Kysely, sql } from "kysely";

export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .createTable("users")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("email", "varchar", (c) => c.notNull().unique())
    .addColumn("password_hash", "varchar")
    .addColumn("name", "varchar", (c) => c.notNull())
    .addColumn("role", "varchar", (c) => c.notNull())
    .addColumn("is_suspended", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("created_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex("users_email_idx").on("users").column("email").execute();
  await db.schema.createIndex("users_role_idx").on("users").column("role").execute();
  await sql`ALTER TABLE users ADD CONSTRAINT users_role_check CHECK (role IN ('admin','teacher','student'))`.execute(
    db
  );

  await db.schema
    .createTable("oauth_accounts")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("user_id", "uuid", (c) => c.notNull().references("users.id").onDelete("cascade"))
    .addColumn("provider", "varchar", (c) => c.notNull())
    .addColumn("provider_account_id", "varchar", (c) => c.notNull())
    .addColumn("created_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema
    .createIndex("oauth_accounts_provider_idx")
    .on("oauth_accounts")
    .columns(["provider", "provider_account_id"])
    .unique()
    .execute();

  await db.schema
    .createTable("teacher_groups")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("name", "varchar", (c) => c.notNull())
    .addColumn("created_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();

  await db.schema
    .createTable("teacher_group_members")
    .addColumn("teacher_group_id", "uuid", (c) => c.notNull().references("teacher_groups.id").onDelete("cascade"))
    .addColumn("teacher_id", "uuid", (c) => c.notNull().references("users.id").onDelete("cascade"))
    .addPrimaryKeyConstraint("teacher_group_members_pk", ["teacher_group_id", "teacher_id"])
    .execute();

  await db.schema
    .createTable("classes")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("name", "varchar", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("teacher_id", "uuid", (c) => c.notNull().references("users.id"))
    .addColumn("created_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex("classes_teacher_id_idx").on("classes").column("teacher_id").execute();

  await db.schema
    .createTable("class_students")
    .addColumn("class_id", "uuid", (c) => c.notNull().references("classes.id").onDelete("cascade"))
    .addColumn("student_id", "uuid", (c) => c.notNull().references("users.id").onDelete("cascade"))
    .addColumn("created_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .addPrimaryKeyConstraint("class_students_pk", ["class_id", "student_id"])
    .execute();
  await db.schema.createIndex("class_students_class_id_idx").on("class_students").column("class_id").execute();
  await db.schema.createIndex("class_students_student_id_idx").on("class_students").column("student_id").execute();

  await db.schema
    .createTable("assignments")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("class_id", "uuid", (c) => c.notNull().references("classes.id").onDelete("cascade"))
    .addColumn("title", "varchar", (c) => c.notNull())
    .addColumn("description", "text")
    .addColumn("published", "boolean", (c) => c.notNull().defaultTo(false))
    .addColumn("due_at", "timestamp")
    .addColumn("created_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema.createIndex("assignments_class_id_idx").on("assignments").column("class_id").execute();
  await db.schema.createIndex("assignments_published_idx").on("assignments").column("published").execute();

  await db.schema
    .createTable("submissions")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("assignment_id", "uuid", (c) => c.notNull().references("assignments.id").onDelete("cascade"))
    .addColumn("student_id", "uuid", (c) => c.notNull().references("users.id"))
    .addColumn("content", "text", (c) => c.notNull())
    .addColumn("submitted_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("updated_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .execute();
  await db.schema
    .createIndex("submissions_assignment_student_idx")
    .on("submissions")
    .columns(["assignment_id", "student_id"])
    .unique()
    .execute();
  await db.schema.createIndex("submissions_student_id_idx").on("submissions").column("student_id").execute();

  await db.schema
    .createTable("grades")
    .addColumn("id", "uuid", (c) => c.primaryKey().defaultTo(sql`gen_random_uuid()`))
    .addColumn("submission_id", "uuid", (c) =>
      c.notNull().unique().references("submissions.id").onDelete("cascade")
    )
    .addColumn("score", "numeric", (c) => c.notNull())
    .addColumn("feedback", "text")
    .addColumn("graded_at", "timestamp", (c) => c.notNull().defaultTo(sql`now()`))
    .addColumn("graded_by", "uuid", (c) => c.notNull().references("users.id"))
    .execute();
  await sql`ALTER TABLE grades ADD CONSTRAINT grades_score_range CHECK (score >= 0 AND score <= 100)`.execute(db);
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.dropTable("grades").execute();
  await db.schema.dropTable("submissions").execute();
  await db.schema.dropTable("assignments").execute();
  await db.schema.dropTable("class_students").execute();
  await db.schema.dropTable("classes").execute();
  await db.schema.dropTable("teacher_group_members").execute();
  await db.schema.dropTable("teacher_groups").execute();
  await db.schema.dropTable("oauth_accounts").execute();
  await db.schema.dropTable("users").execute();
}

import { sql, type Kysely } from "kysely";
import type { Redis } from "ioredis";
import type { DB } from "../db/schema.js";
import { ApiError } from "../errors.js";

// ponytail: read-through cache, staleness bounded by TTL. Add explicit
// invalidation on writes if 30s of staleness ever matters for these stats.
const TTL_SECONDS = 30;

export function createStatsService(db: Kysely<DB>, redis: Redis) {
  async function cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
    const hit = await redis.get(key);
    if (hit !== null) {
      return JSON.parse(hit) as T;
    }
    const value = await compute();
    await redis.set(key, JSON.stringify(value), "EX", TTL_SECONDS);
    return value;
  }

  async function assertClassExists(classId: string): Promise<void> {
    const cls = await db.selectFrom("classes").select("id").where("id", "=", classId).executeTakeFirst();
    if (!cls) {
      throw new ApiError("NOT_FOUND", "Class not found");
    }
  }

  // score is a Postgres numeric — avg/count come back as strings, so cast to float8/Number.
  const avg = sql<number | null>`avg(grades.score)::float8`;
  const count = sql<string>`count(*)`;

  return {
    averageGrades() {
      return cached("stats:avg-grades", async () => {
        const row = await db
          .selectFrom("grades")
          .select([avg.as("average"), count.as("count")])
          .executeTakeFirstOrThrow();
        return { average: row.average, count: Number(row.count) };
      });
    },

    async averageGradesForClass(classId: string) {
      await assertClassExists(classId);
      return cached(`stats:avg-grades:${classId}`, async () => {
        const row = await db
          .selectFrom("grades")
          .innerJoin("submissions", "submissions.id", "grades.submission_id")
          .innerJoin("assignments", "assignments.id", "submissions.assignment_id")
          .where("assignments.class_id", "=", classId)
          .select([avg.as("average"), count.as("count")])
          .executeTakeFirstOrThrow();
        return { classId, average: row.average, count: Number(row.count) };
      });
    },

    teacherNames() {
      return cached("stats:teacher-names", () =>
        db.selectFrom("users").select(["id", "name"]).where("role", "=", "teacher").orderBy("name").execute()
      );
    },

    studentNames() {
      return cached("stats:student-names", () =>
        db.selectFrom("users").select(["id", "name"]).where("role", "=", "student").orderBy("name").execute()
      );
    },

    classes() {
      return cached("stats:classes", () =>
        db
          .selectFrom("classes")
          .innerJoin("users", "users.id", "classes.teacher_id")
          .select(["classes.id", "classes.name", "classes.description", "users.name as teacherName"])
          .orderBy("classes.name")
          .execute()
      );
    },

    async studentsForClass(classId: string) {
      await assertClassExists(classId);
      return cached(`stats:classes:${classId}:students`, () =>
        db
          .selectFrom("class_students")
          .innerJoin("users", "users.id", "class_students.student_id")
          .select(["users.id", "users.name", "users.email"])
          .where("class_students.class_id", "=", classId)
          .orderBy("users.name")
          .execute()
      );
    },
  };
}

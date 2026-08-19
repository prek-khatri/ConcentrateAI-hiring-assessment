import type { Kysely } from "kysely";
import type { DB } from "../db/schema.js";
import { ApiError } from "../errors.js";

async function assertOwnsClass(db: Kysely<DB>, teacherId: string, classId: string) {
  const cls = await db
    .selectFrom("classes")
    .selectAll()
    .where("id", "=", classId)
    .where("teacher_id", "=", teacherId)
    .executeTakeFirst();
  if (!cls) {
    throw new ApiError("NOT_FOUND", "Class not found");
  }
  return cls;
}

async function assertOwnsAssignment(db: Kysely<DB>, teacherId: string, assignmentId: string) {
  const assignment = await db
    .selectFrom("assignments")
    .selectAll()
    .where("id", "=", assignmentId)
    .executeTakeFirst();
  if (!assignment) {
    throw new ApiError("NOT_FOUND", "Assignment not found");
  }
  await assertOwnsClass(db, teacherId, assignment.class_id);
  return assignment;
}

export function createTeacherService(db: Kysely<DB>) {
  return {
    async listMyClasses(teacherId: string) {
      return db
        .selectFrom("classes")
        .selectAll()
        .where("teacher_id", "=", teacherId)
        .orderBy("created_at", "desc")
        .execute();
    },

    async createClass(teacherId: string, name: string, description: string | null) {
      return db
        .insertInto("classes")
        .values({ teacher_id: teacherId, name, description })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async getClass(teacherId: string, classId: string) {
      const cls = await assertOwnsClass(db, teacherId, classId);

      const roster = await db
        .selectFrom("class_students")
        .innerJoin("users", "users.id", "class_students.student_id")
        .select(["users.id", "users.name", "users.email"])
        .where("class_students.class_id", "=", classId)
        .orderBy("users.name", "asc")
        .execute();

      const assignments = await db
        .selectFrom("assignments")
        .selectAll()
        .where("class_id", "=", classId)
        .orderBy("created_at", "desc")
        .execute();

      return { class: cls, roster, assignments };
    },

    async updateClass(teacherId: string, classId: string, name: string, description: string | null) {
      await assertOwnsClass(db, teacherId, classId);
      return db
        .updateTable("classes")
        .set({ name, description, updated_at: new Date() })
        .where("id", "=", classId)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async deleteClass(teacherId: string, classId: string) {
      await assertOwnsClass(db, teacherId, classId);
      await db.deleteFrom("classes").where("id", "=", classId).execute();
    },

    async listAvailableStudents() {
      return db
        .selectFrom("users")
        .select(["id", "name", "email"])
        .where("role", "=", "student")
        .orderBy("name", "asc")
        .execute();
    },

    async addStudent(teacherId: string, classId: string, studentId: string) {
      await assertOwnsClass(db, teacherId, classId);

      const student = await db
        .selectFrom("users")
        .select("id")
        .where("id", "=", studentId)
        .where("role", "=", "student")
        .executeTakeFirst();
      if (!student) {
        throw new ApiError("NOT_FOUND", "Student not found");
      }

      await db
        .insertInto("class_students")
        .values({ class_id: classId, student_id: studentId })
        .onConflict((oc) => oc.columns(["class_id", "student_id"]).doNothing())
        .execute();
    },

    async removeStudent(teacherId: string, classId: string, studentId: string) {
      await assertOwnsClass(db, teacherId, classId);
      await db
        .deleteFrom("class_students")
        .where("class_id", "=", classId)
        .where("student_id", "=", studentId)
        .execute();
    },

    async createAssignment(
      teacherId: string,
      classId: string,
      data: { title: string; description: string | null; due_at: Date | null; published: boolean }
    ) {
      await assertOwnsClass(db, teacherId, classId);
      return db
        .insertInto("assignments")
        .values({ class_id: classId, ...data })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async getAssignment(teacherId: string, assignmentId: string) {
      const assignment = await assertOwnsAssignment(db, teacherId, assignmentId);

      const submissions = await db
        .selectFrom("submissions")
        .innerJoin("users", "users.id", "submissions.student_id")
        .leftJoin("grades", "grades.submission_id", "submissions.id")
        .select([
          "submissions.id",
          "submissions.content",
          "submissions.submitted_at",
          "users.id as studentId",
          "users.name as studentName",
          "grades.score",
          "grades.feedback",
        ])
        .where("submissions.assignment_id", "=", assignmentId)
        .orderBy("submissions.submitted_at", "asc")
        .execute();

      return { assignment, submissions };
    },

    async updateAssignment(
      teacherId: string,
      assignmentId: string,
      data: { title: string; description: string | null; due_at: Date | null; published: boolean }
    ) {
      await assertOwnsAssignment(db, teacherId, assignmentId);
      return db
        .updateTable("assignments")
        .set({ ...data, updated_at: new Date() })
        .where("id", "=", assignmentId)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async deleteAssignment(teacherId: string, assignmentId: string) {
      await assertOwnsAssignment(db, teacherId, assignmentId);
      await db.deleteFrom("assignments").where("id", "=", assignmentId).execute();
    },

    async gradeSubmission(teacherId: string, submissionId: string, score: number, feedback: string | null) {
      const submission = await db
        .selectFrom("submissions")
        .innerJoin("assignments", "assignments.id", "submissions.assignment_id")
        .select(["submissions.id", "assignments.class_id"])
        .where("submissions.id", "=", submissionId)
        .executeTakeFirst();
      if (!submission) {
        throw new ApiError("NOT_FOUND", "Submission not found");
      }
      await assertOwnsClass(db, teacherId, submission.class_id);

      const existing = await db
        .selectFrom("grades")
        .select("id")
        .where("submission_id", "=", submissionId)
        .executeTakeFirst();

      if (existing) {
        return db
          .updateTable("grades")
          .set({ score, feedback, graded_by: teacherId, graded_at: new Date() })
          .where("id", "=", existing.id)
          .returningAll()
          .executeTakeFirstOrThrow();
      }

      return db
        .insertInto("grades")
        .values({ submission_id: submissionId, score, feedback, graded_by: teacherId })
        .returningAll()
        .executeTakeFirstOrThrow();
    },
  };
}

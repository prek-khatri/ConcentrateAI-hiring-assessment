import type { Kysely } from "kysely";
import type { DB } from "../db/schema.js";
import { ApiError } from "../errors.js";

export function createStudentService(db: Kysely<DB>) {
  return {
    async listMyClasses(studentId: string) {
      return db
        .selectFrom("class_students")
        .innerJoin("classes", "classes.id", "class_students.class_id")
        .innerJoin("users", "users.id", "classes.teacher_id")
        .select([
          "classes.id",
          "classes.name",
          "classes.description",
          "users.name as teacherName",
        ])
        .where("class_students.student_id", "=", studentId)
        .execute();
    },

    async listAssignmentsForClass(studentId: string, classId: string) {
      const enrolled = await db
        .selectFrom("class_students")
        .select("class_id")
        .where("class_id", "=", classId)
        .where("student_id", "=", studentId)
        .executeTakeFirst();
      if (!enrolled) {
        throw new ApiError("FORBIDDEN", "Not enrolled in this class");
      }

      return db
        .selectFrom("assignments")
        .selectAll()
        .where("class_id", "=", classId)
        .where("published", "=", true)
        .orderBy("due_at", "asc")
        .execute();
    },

    async getAssignmentForStudent(studentId: string, assignmentId: string) {
      const assignment = await db
        .selectFrom("assignments")
        .selectAll()
        .where("id", "=", assignmentId)
        .where("published", "=", true)
        .executeTakeFirst();
      if (!assignment) {
        throw new ApiError("NOT_FOUND", "Assignment not found");
      }

      const enrolled = await db
        .selectFrom("class_students")
        .select("class_id")
        .where("class_id", "=", assignment.class_id)
        .where("student_id", "=", studentId)
        .executeTakeFirst();
      if (!enrolled) {
        throw new ApiError("NOT_FOUND", "Assignment not found");
      }

      const submission = await db
        .selectFrom("submissions")
        .leftJoin("grades", "grades.submission_id", "submissions.id")
        .select([
          "submissions.id",
          "submissions.content",
          "submissions.submitted_at",
          "grades.score",
          "grades.feedback",
        ])
        .where("submissions.assignment_id", "=", assignmentId)
        .where("submissions.student_id", "=", studentId)
        .executeTakeFirst();

      return { assignment, submission: submission ?? null };
    },

    async submitAssignment(studentId: string, assignmentId: string, content: string) {
      const assignment = await db
        .selectFrom("assignments")
        .selectAll()
        .where("id", "=", assignmentId)
        .where("published", "=", true)
        .executeTakeFirst();
      if (!assignment) {
        throw new ApiError("NOT_FOUND", "Assignment not found");
      }

      const enrolled = await db
        .selectFrom("class_students")
        .select("class_id")
        .where("class_id", "=", assignment.class_id)
        .where("student_id", "=", studentId)
        .executeTakeFirst();
      if (!enrolled) {
        throw new ApiError("FORBIDDEN", "Not enrolled in this class");
      }

      const existing = await db
        .selectFrom("submissions")
        .select("id")
        .where("assignment_id", "=", assignmentId)
        .where("student_id", "=", studentId)
        .executeTakeFirst();
      if (existing) {
        throw new ApiError("CONFLICT", "Already submitted — use update instead");
      }

      return db
        .insertInto("submissions")
        .values({ assignment_id: assignmentId, student_id: studentId, content })
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async updateSubmission(studentId: string, assignmentId: string, content: string) {
      const existing = await db
        .selectFrom("submissions")
        .select("id")
        .where("assignment_id", "=", assignmentId)
        .where("student_id", "=", studentId)
        .executeTakeFirst();
      if (!existing) {
        throw new ApiError("NOT_FOUND", "No submission to update");
      }

      return db
        .updateTable("submissions")
        .set({ content, updated_at: new Date() })
        .where("id", "=", existing.id)
        .returningAll()
        .executeTakeFirstOrThrow();
    },

    async listMySubmissions(studentId: string) {
      return db
        .selectFrom("submissions")
        .innerJoin("assignments", "assignments.id", "submissions.assignment_id")
        .innerJoin("classes", "classes.id", "assignments.class_id")
        .leftJoin("grades", "grades.submission_id", "submissions.id")
        .select([
          "submissions.id",
          "assignments.title as assignmentTitle",
          "classes.name as className",
          "grades.score",
          "grades.feedback",
        ])
        .where("submissions.student_id", "=", studentId)
        .execute();
    },
  };
}

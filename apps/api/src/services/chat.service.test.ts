import { describe, it, expect, vi, afterEach } from "vitest";
import { db } from "../db/index.js";
import { buildContextForUser, askChatbot } from "./chat.service.js";

afterEach(() => vi.unstubAllGlobals());

describe("buildContextForUser", () => {
  it("builds a student context from their classes and submissions", async () => {
    const student = await db.selectFrom("users").selectAll().where("email", "=", "student@example.com").executeTakeFirstOrThrow();
    const context = await buildContextForUser(db, {
      id: student.id,
      email: student.email,
      name: student.name,
      role: "student",
    });
    expect(context).toContain("Biology 101");
    expect(context).toContain("Cell Structure");
  });

  it("includes assignments the student hasn't submitted yet", async () => {
    const student = await db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", "student2@example.com")
      .executeTakeFirstOrThrow();
    const context = await buildContextForUser(db, {
      id: student.id,
      email: student.email,
      name: student.name,
      role: "student",
    });
    expect(context).toMatch(/not yet submitted:.*cell structure/i);
  });

  it("omits the due-date suffix for a not-yet-submitted assignment with no due date", async () => {
    const teacher2 = await db.selectFrom("users").selectAll().where("email", "=", "teacher2@example.com").executeTakeFirstOrThrow();
    const student3 = await db.selectFrom("users").selectAll().where("email", "=", "student3@example.com").executeTakeFirstOrThrow();

    const tempClass = await db
      .insertInto("classes")
      .values({ name: "Temp No Due Date Class", teacher_id: teacher2.id })
      .returningAll()
      .executeTakeFirstOrThrow();
    await db.insertInto("class_students").values({ class_id: tempClass.id, student_id: student3.id }).execute();
    const tempAssignment = await db
      .insertInto("assignments")
      .values({ class_id: tempClass.id, title: "No Due Date Not Submitted", published: true, due_at: null })
      .returningAll()
      .executeTakeFirstOrThrow();

    const context = await buildContextForUser(db, {
      id: student3.id,
      email: student3.email,
      name: student3.name,
      role: "student",
    });
    expect(context).toContain("No Due Date Not Submitted (Temp No Due Date Class)");
    expect(context).not.toContain("No Due Date Not Submitted (Temp No Due Date Class), due");

    await db.deleteFrom("assignments").where("id", "=", tempAssignment.id).execute();
    await db.deleteFrom("class_students").where("class_id", "=", tempClass.id).execute();
    await db.deleteFrom("classes").where("id", "=", tempClass.id).execute();
  });

  it("shows a due date for a not-yet-submitted assignment that has one", async () => {
    const teacher2 = await db.selectFrom("users").selectAll().where("email", "=", "teacher2@example.com").executeTakeFirstOrThrow();
    const student3 = await db.selectFrom("users").selectAll().where("email", "=", "student3@example.com").executeTakeFirstOrThrow();

    const tempClass = await db
      .insertInto("classes")
      .values({ name: "Temp Due Date Class", teacher_id: teacher2.id })
      .returningAll()
      .executeTakeFirstOrThrow();
    await db.insertInto("class_students").values({ class_id: tempClass.id, student_id: student3.id }).execute();
    const tempAssignment = await db
      .insertInto("assignments")
      .values({ class_id: tempClass.id, title: "Due Date Assignment", published: true, due_at: new Date("2026-09-01") })
      .returningAll()
      .executeTakeFirstOrThrow();

    const context = await buildContextForUser(db, {
      id: student3.id,
      email: student3.email,
      name: student3.name,
      role: "student",
    });
    expect(context).toMatch(/not yet submitted:.*due date assignment.*due 2026-09-01/i);

    await db.deleteFrom("assignments").where("id", "=", tempAssignment.id).execute();
    await db.deleteFrom("class_students").where("class_id", "=", tempClass.id).execute();
    await db.deleteFrom("classes").where("id", "=", tempClass.id).execute();
  });

  it("says 'none' for classes when the student isn't enrolled in anything", async () => {
    const orphan = await db
      .insertInto("users")
      .values({ email: "no-classes@example.com", name: "No Classes", role: "student", password_hash: null })
      .returningAll()
      .executeTakeFirstOrThrow();

    const context = await buildContextForUser(db, {
      id: orphan.id,
      email: orphan.email,
      name: orphan.name,
      role: "student",
    });
    expect(context).toMatch(/enrolled classes: none/i);

    await db.deleteFrom("users").where("id", "=", orphan.id).execute();
  });

  it("omits the due-date suffix for an assignment with no due date, and reports awaiting-grade work", async () => {
    const teacher2 = await db.selectFrom("users").selectAll().where("email", "=", "teacher2@example.com").executeTakeFirstOrThrow();
    const student3 = await db.selectFrom("users").selectAll().where("email", "=", "student3@example.com").executeTakeFirstOrThrow();

    const tempClass = await db
      .insertInto("classes")
      .values({ name: "Temp Chat Context Class", teacher_id: teacher2.id })
      .returningAll()
      .executeTakeFirstOrThrow();
    await db.insertInto("class_students").values({ class_id: tempClass.id, student_id: student3.id }).execute();
    const tempAssignment = await db
      .insertInto("assignments")
      .values({ class_id: tempClass.id, title: "No Due Date Assignment", published: true, due_at: null })
      .returningAll()
      .executeTakeFirstOrThrow();
    await db
      .insertInto("submissions")
      .values({ assignment_id: tempAssignment.id, student_id: student3.id, content: "my answer" })
      .execute();

    const context = await buildContextForUser(db, {
      id: student3.id,
      email: student3.email,
      name: student3.name,
      role: "student",
    });
    expect(context).toMatch(/awaiting grade:.*no due date assignment.*submitted, awaiting grade/i);

    await db.deleteFrom("submissions").where("assignment_id", "=", tempAssignment.id).execute();
    await db.deleteFrom("assignments").where("id", "=", tempAssignment.id).execute();
    await db.deleteFrom("class_students").where("class_id", "=", tempClass.id).execute();
    await db.deleteFrom("classes").where("id", "=", tempClass.id).execute();
  });

  it("returns a minimal honest context for roles without wired-up data yet", async () => {
    const context = await buildContextForUser(db, {
      id: "admin-id",
      email: "admin@example.com",
      name: "Ada Admin",
      role: "admin",
    });
    expect(context).toContain("No further context is available yet");
  });

  it("says a teacher with no classes has none yet", async () => {
    const teacher2 = await db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", "teacher2@example.com")
      .executeTakeFirstOrThrow();

    const context = await buildContextForUser(db, {
      id: teacher2.id,
      email: teacher2.email,
      name: teacher2.name,
      role: "teacher",
    });
    expect(context).toMatch(/no classes yet/i);
  });

  it("builds a teacher context with roster, submission counts, and average score", async () => {
    const teacher2 = await db.selectFrom("users").selectAll().where("email", "=", "teacher2@example.com").executeTakeFirstOrThrow();
    const student = await db.selectFrom("users").selectAll().where("email", "=", "student@example.com").executeTakeFirstOrThrow();
    const student2 = await db.selectFrom("users").selectAll().where("email", "=", "student2@example.com").executeTakeFirstOrThrow();

    const tempClass = await db
      .insertInto("classes")
      .values({ name: "Chat Context Chemistry", teacher_id: teacher2.id })
      .returningAll()
      .executeTakeFirstOrThrow();
    await db
      .insertInto("class_students")
      .values([
        { class_id: tempClass.id, student_id: student.id },
        { class_id: tempClass.id, student_id: student2.id },
      ])
      .execute();
    const gradedAssignment = await db
      .insertInto("assignments")
      .values({ class_id: tempClass.id, title: "Titration Lab", published: true, due_at: null })
      .returningAll()
      .executeTakeFirstOrThrow();
    const draftAssignment = await db
      .insertInto("assignments")
      .values({ class_id: tempClass.id, title: "Unpublished Draft", published: false, due_at: null })
      .returningAll()
      .executeTakeFirstOrThrow();
    const submission = await db
      .insertInto("submissions")
      .values({ assignment_id: gradedAssignment.id, student_id: student.id, content: "answer" })
      .returningAll()
      .executeTakeFirstOrThrow();
    await db
      .insertInto("grades")
      .values({ submission_id: submission.id, score: 88, graded_by: teacher2.id })
      .execute();

    const context = await buildContextForUser(db, {
      id: teacher2.id,
      email: teacher2.email,
      name: teacher2.name,
      role: "teacher",
    });

    expect(context).toContain("Chat Context Chemistry");
    expect(context).toMatch(/2 students enrolled/i);
    expect(context).toMatch(/"Titration Lab".*1\/2 submitted.*average score 88\/100/i);
    expect(context).toMatch(/not yet submitted:.*sasha student/i);
    expect(context).toMatch(/"Unpublished Draft" \(draft\).*0\/2 submitted.*no grades yet/i);

    await db.deleteFrom("grades").where("submission_id", "=", submission.id).execute();
    await db.deleteFrom("submissions").where("id", "=", submission.id).execute();
    await db.deleteFrom("assignments").where("id", "in", [gradedAssignment.id, draftAssignment.id]).execute();
    await db.deleteFrom("class_students").where("class_id", "=", tempClass.id).execute();
    await db.deleteFrom("classes").where("id", "=", tempClass.id).execute();
  });

  it("reports an empty class as having no students and no assignments yet", async () => {
    const teacher2 = await db.selectFrom("users").selectAll().where("email", "=", "teacher2@example.com").executeTakeFirstOrThrow();

    const tempClass = await db
      .insertInto("classes")
      .values({ name: "Chat Context Empty Class", teacher_id: teacher2.id })
      .returningAll()
      .executeTakeFirstOrThrow();

    const context = await buildContextForUser(db, {
      id: teacher2.id,
      email: teacher2.email,
      name: teacher2.name,
      role: "teacher",
    });
    expect(context).toMatch(/chat context empty class: no students enrolled/i);
    expect(context).toMatch(/no assignments yet/i);

    await db.deleteFrom("classes").where("id", "=", tempClass.id).execute();
  });

  it("reports an assignment with a submission still awaiting grading", async () => {
    const teacher2 = await db.selectFrom("users").selectAll().where("email", "=", "teacher2@example.com").executeTakeFirstOrThrow();
    const student3 = await db.selectFrom("users").selectAll().where("email", "=", "student3@example.com").executeTakeFirstOrThrow();

    const tempClass = await db
      .insertInto("classes")
      .values({ name: "Chat Context Physics", teacher_id: teacher2.id })
      .returningAll()
      .executeTakeFirstOrThrow();
    await db.insertInto("class_students").values({ class_id: tempClass.id, student_id: student3.id }).execute();
    const assignment = await db
      .insertInto("assignments")
      .values({ class_id: tempClass.id, title: "Ungraded Quiz", published: true, due_at: null })
      .returningAll()
      .executeTakeFirstOrThrow();
    const submission = await db
      .insertInto("submissions")
      .values({ assignment_id: assignment.id, student_id: student3.id, content: "answer" })
      .returningAll()
      .executeTakeFirstOrThrow();

    const context = await buildContextForUser(db, {
      id: teacher2.id,
      email: teacher2.email,
      name: teacher2.name,
      role: "teacher",
    });
    expect(context).toMatch(/"Ungraded Quiz".*1\/1 submitted.*no grades yet.*1 awaiting grading/i);

    await db.deleteFrom("submissions").where("id", "=", submission.id).execute();
    await db.deleteFrom("assignments").where("id", "=", assignment.id).execute();
    await db.deleteFrom("class_students").where("class_id", "=", tempClass.id).execute();
    await db.deleteFrom("classes").where("id", "=", tempClass.id).execute();
  });
});

describe("askChatbot", () => {
  it("throws when GROQ_API_KEY isn't configured", async () => {
    vi.resetModules();
    vi.doMock("../env.js", () => ({ env: { GROQ_API_KEY: undefined } }));
    const { askChatbot: askChatbotWithoutKey } = await import("./chat.service.js");
    await expect(askChatbotWithoutKey("context", "hi")).rejects.toThrow(/not configured/i);
    vi.doUnmock("../env.js");
    vi.resetModules();
  });

  it("throws when Groq responds with a non-2xx status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    await expect(askChatbot("some context", "hi")).rejects.toThrow(/groq request failed/i);
  });

  it("falls back to a generic message if Groq returns no choices", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }));
    const reply = await askChatbot("some context", "hi");
    expect(reply).toMatch(/couldn't generate a response/i);
  });
});

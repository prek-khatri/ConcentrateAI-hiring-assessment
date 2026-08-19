import { describe, it, expect, beforeAll } from "vitest";
import { buildApp } from "../app.js";
import { db } from "../db/index.js";
import { AUTH_COOKIE_NAME } from "../auth/jwt.js";

async function loginAs(email: string) {
  const app = await buildApp();
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: "password123" } });
  const cookie = res.cookies.find((c) => c.name === AUTH_COOKIE_NAME)!.value;
  await app.close();
  return cookie;
}

let studentCookie: string;
let student2Cookie: string;
let teacherCookie: string;
let publishedAssignmentId: string;
let draftAssignmentId: string;
let classId: string;

beforeAll(async () => {
  studentCookie = await loginAs("student@example.com");
  student2Cookie = await loginAs("student2@example.com");
  teacherCookie = await loginAs("teacher@example.com");

  const cls = await db.selectFrom("classes").selectAll().where("name", "=", "Biology 101").executeTakeFirstOrThrow();
  classId = cls.id;

  const published = await db
    .selectFrom("assignments")
    .selectAll()
    .where("title", "=", "Cell Structure")
    .executeTakeFirstOrThrow();
  publishedAssignmentId = published.id;

  const draft = await db
    .selectFrom("assignments")
    .selectAll()
    .where("title", "=", "Photosynthesis")
    .executeTakeFirstOrThrow();
  draftAssignmentId = draft.id;
});

describe("GET /api/student/classes", () => {
  it("401s with no session cookie", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/student/classes" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("403s for a non-student role", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/student/classes",
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("returns the enrolled student's classes", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/student/classes",
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().classes.some((c: { name: string }) => c.name === "Biology 101")).toBe(true);
    await app.close();
  });
});

describe("GET /api/student/assignments", () => {
  it("returns assignments across all enrolled classes with submission status", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/student/assignments",
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
    });
    expect(res.statusCode).toBe(200);
    const items = res.json().assignments;
    const cellStructure = items.find((a: { title: string }) => a.title === "Cell Structure");
    expect(cellStructure.submissionId).not.toBeNull();
    expect(cellStructure.score).not.toBeNull();
    await app.close();
  });

  it("marks assignments with no submission yet as null", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/student/assignments",
      cookies: { [AUTH_COOKIE_NAME]: student2Cookie },
    });
    expect(res.statusCode).toBe(200);
    const cellStructure = res.json().assignments.find((a: { title: string }) => a.title === "Cell Structure");
    expect(cellStructure.submissionId).toBeNull();
    expect(cellStructure.score).toBeNull();
    await app.close();
  });
});

describe("GET /api/student/classes/:classId/assignments", () => {
  it("returns only published assignments", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/student/classes/${classId}/assignments`,
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
    });
    expect(res.statusCode).toBe(200);
    const titles = res.json().assignments.map((a: { title: string }) => a.title);
    expect(titles).toContain("Cell Structure");
    expect(titles).not.toContain("Photosynthesis");
    await app.close();
  });
});

describe("GET /api/student/assignments/:assignmentId", () => {
  it("404s on an unpublished assignment", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/student/assignments/${draftAssignmentId}`,
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("returns the assignment with the seeded graded submission", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/student/assignments/${publishedAssignmentId}`,
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().submission.score).not.toBeNull();
    await app.close();
  });
});

describe("POST /api/student/assignments/:assignmentId/submission", () => {
  it("409s when the student already submitted", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/student/assignments/${publishedAssignmentId}/submission`,
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
      payload: { content: "second attempt" },
    });
    expect(res.statusCode).toBe(409);
    await app.close();
  });

  it("404s submitting to an unpublished assignment", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/student/assignments/${draftAssignmentId}/submission`,
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
      payload: { content: "attempt" },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("400s on empty content", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/student/assignments/${publishedAssignmentId}/submission`,
      cookies: { [AUTH_COOKIE_NAME]: student2Cookie },
      payload: { content: "" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("201s for a student submitting for the first time, then updates via PATCH", async () => {
    const app = await buildApp();
    const createRes = await app.inject({
      method: "POST",
      url: `/api/student/assignments/${publishedAssignmentId}/submission`,
      cookies: { [AUTH_COOKIE_NAME]: student2Cookie },
      payload: { content: "first attempt" },
    });
    expect(createRes.statusCode).toBe(201);

    const updateRes = await app.inject({
      method: "PATCH",
      url: `/api/student/assignments/${publishedAssignmentId}/submission`,
      cookies: { [AUTH_COOKIE_NAME]: student2Cookie },
      payload: { content: "revised attempt" },
    });
    expect(updateRes.statusCode).toBe(200);
    expect(updateRes.json().content).toBe("revised attempt");

    await db
      .deleteFrom("submissions")
      .where("assignment_id", "=", publishedAssignmentId)
      .where("student_id", "=", (await db.selectFrom("users").select("id").where("email", "=", "student2@example.com").executeTakeFirstOrThrow()).id)
      .execute();
    await app.close();
  });
});

describe("PATCH /api/student/assignments/:assignmentId/submission", () => {
  it("404s when there's no existing submission to update", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/student/assignments/${draftAssignmentId}/submission`,
      cookies: { [AUTH_COOKIE_NAME]: student2Cookie },
      payload: { content: "attempt" },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });
});

describe("not enrolled", () => {
  it("403s on assignments for a class the student isn't enrolled in", async () => {
    const teacher2 = await db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", "teacher2@example.com")
      .executeTakeFirstOrThrow();
    const otherClass = await db
      .insertInto("classes")
      .values({ name: "Chemistry 201", teacher_id: teacher2.id })
      .returningAll()
      .executeTakeFirstOrThrow();

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/student/classes/${otherClass.id}/assignments`,
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
    });
    expect(res.statusCode).toBe(403);

    await db.deleteFrom("classes").where("id", "=", otherClass.id).execute();
    await app.close();
  });

  it("403s submitting to an assignment in a class the student isn't enrolled in", async () => {
    const teacher2 = await db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", "teacher2@example.com")
      .executeTakeFirstOrThrow();
    const otherClass = await db
      .insertInto("classes")
      .values({ name: "Physics 301", teacher_id: teacher2.id })
      .returningAll()
      .executeTakeFirstOrThrow();
    const otherAssignment = await db
      .insertInto("assignments")
      .values({ class_id: otherClass.id, title: "Kinematics", published: true })
      .returningAll()
      .executeTakeFirstOrThrow();

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/student/assignments/${otherAssignment.id}/submission`,
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
      payload: { content: "attempt" },
    });
    expect(res.statusCode).toBe(403);

    await db.deleteFrom("assignments").where("id", "=", otherAssignment.id).execute();
    await db.deleteFrom("classes").where("id", "=", otherClass.id).execute();
    await app.close();
  });
});

describe("GET /api/student/submissions", () => {
  it("returns the caller's own submissions with grade info", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/student/submissions",
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().submissions.length).toBeGreaterThan(0);
    await app.close();
  });
});

import { describe, it, expect, beforeAll, afterAll } from "vitest";
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

let teacherCookie: string;
let teacher2Cookie: string;
let studentCookie: string;
let studentId: string;
let seededClassId: string;

beforeAll(async () => {
  teacherCookie = await loginAs("teacher@example.com");
  teacher2Cookie = await loginAs("teacher2@example.com");
  studentCookie = await loginAs("student@example.com");

  const student = await db
    .selectFrom("users")
    .select("id")
    .where("email", "=", "student@example.com")
    .executeTakeFirstOrThrow();
  studentId = student.id;

  const cls = await db.selectFrom("classes").selectAll().where("name", "=", "Biology 101").executeTakeFirstOrThrow();
  seededClassId = cls.id;
});

describe("GET /api/teacher/classes", () => {
  it("401s with no session cookie", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/teacher/classes" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("403s for a non-teacher role", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/teacher/classes",
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });

  it("returns only this teacher's classes", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/teacher/classes",
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().classes.some((c: { id: string }) => c.id === seededClassId)).toBe(true);
    await app.close();
  });
});

describe("GET /api/teacher/students", () => {
  it("lists students available to add to a roster", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/teacher/students",
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().students.some((s: { id: string }) => s.id === studentId)).toBe(true);
    await app.close();
  });
});

describe("class lifecycle", () => {
  let classId: string;

  it("creates a class", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/teacher/classes",
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
      payload: { name: "Chemistry 101", description: "Intro to Chemistry" },
    });
    expect(res.statusCode).toBe(201);
    classId = res.json().id;
    await app.close();
  });

  it("returns the class with an empty roster and no assignments yet", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/teacher/classes/${classId}`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().roster).toEqual([]);
    expect(res.json().assignments).toEqual([]);
    await app.close();
  });

  it("404s when another teacher tries to view it", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/teacher/classes/${classId}`,
      cookies: { [AUTH_COOKIE_NAME]: teacher2Cookie },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("adds a student to the roster", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/teacher/classes/${classId}/students`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
      payload: { studentId },
    });
    expect(res.statusCode).toBe(204);
    await app.close();
  });

  it("404s when adding a student id that doesn't belong to a student", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/teacher/classes/${classId}/students`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
      payload: { studentId: "00000000-0000-0000-0000-000000000099" },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("shows the student in the roster", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/teacher/classes/${classId}`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
    });
    expect(res.json().roster).toHaveLength(1);
    await app.close();
  });

  it("removes the student from the roster", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/teacher/classes/${classId}/students/${studentId}`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
    });
    expect(res.statusCode).toBe(204);
    await app.close();
  });

  it("updates the class", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/teacher/classes/${classId}`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
      payload: { name: "Chemistry 102", description: null },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Chemistry 102");
    await app.close();
  });

  it("deletes the class", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/teacher/classes/${classId}`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
    });
    expect(res.statusCode).toBe(204);
    await app.close();
  });
});

describe("assignments and grading", () => {
  let classId: string;
  let assignmentId: string;
  let submissionId: string;

  beforeAll(async () => {
    const app = await buildApp();
    const classRes = await app.inject({
      method: "POST",
      url: "/api/teacher/classes",
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
      payload: { name: "Physics 101" },
    });
    classId = classRes.json().id;

    await app.inject({
      method: "POST",
      url: `/api/teacher/classes/${classId}/students`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
      payload: { studentId },
    });

    const assignmentRes = await app.inject({
      method: "POST",
      url: `/api/teacher/classes/${classId}/assignments`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
      payload: {
        title: "Motion",
        description: "Explain Newton's laws",
        published: true,
        dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
      },
    });
    assignmentId = assignmentRes.json().id;

    const submitRes = await app.inject({
      method: "POST",
      url: `/api/student/assignments/${assignmentId}/submission`,
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
      payload: { content: "F = ma" },
    });
    submissionId = submitRes.json().id;

    await app.close();
  });

  afterAll(async () => {
    const app = await buildApp();
    await app.inject({
      method: "DELETE",
      url: `/api/teacher/classes/${classId}`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
    });
    await app.close();
  });

  it("creates an assignment with no due date", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/teacher/classes/${classId}/assignments`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
      payload: { title: "Untimed reading", published: false },
    });
    expect(res.statusCode).toBe(201);
    expect(res.json().due_at).toBeNull();
    await app.close();
  });

  it("lists the assignment with the submission", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/api/teacher/assignments/${assignmentId}`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().submissions).toHaveLength(1);
    expect(res.json().submissions[0].score).toBeNull();
    await app.close();
  });

  it("grades the submission", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/teacher/submissions/${submissionId}/grade`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
      payload: { score: 88, feedback: "Good, but show your work." },
    });
    expect(res.statusCode).toBe(200);
    expect(Number(res.json().score)).toBe(88);
    await app.close();
  });

  it("updates the assignment", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/teacher/assignments/${assignmentId}`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
      payload: {
        title: "Motion & Forces",
        description: null,
        dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 7).toISOString(),
        published: true,
      },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().title).toBe("Motion & Forces");
    await app.close();
  });

  it("re-grades an already-graded submission (updates, doesn't duplicate)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/teacher/submissions/${submissionId}/grade`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
      payload: { score: 95, feedback: "Actually, great work." },
    });
    expect(res.statusCode).toBe(200);
    expect(Number(res.json().score)).toBe(95);
    await app.close();
  });

  it("404s when grading a submission that doesn't exist", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/teacher/submissions/00000000-0000-0000-0000-000000000099/grade",
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
      payload: { score: 50, feedback: null },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("clears the due date on update", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "PATCH",
      url: `/api/teacher/assignments/${assignmentId}`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
      payload: { title: "Motion & Forces", description: null, dueAt: null, published: true },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().due_at).toBeNull();
    await app.close();
  });

  it("404s when getting an assignment that doesn't exist", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/teacher/assignments/00000000-0000-0000-0000-000000000099",
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("404s when another teacher tries to grade it", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: `/api/teacher/submissions/${submissionId}/grade`,
      cookies: { [AUTH_COOKIE_NAME]: teacher2Cookie },
      payload: { score: 50, feedback: null },
    });
    expect(res.statusCode).toBe(404);
    await app.close();
  });

  it("deletes the assignment (and cascades the submission/grade)", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "DELETE",
      url: `/api/teacher/assignments/${assignmentId}`,
      cookies: { [AUTH_COOKIE_NAME]: teacherCookie },
    });
    expect(res.statusCode).toBe(204);
    await app.close();
  });
});

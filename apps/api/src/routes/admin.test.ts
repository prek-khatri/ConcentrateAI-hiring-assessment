import { describe, it, expect, beforeAll, afterAll } from "vitest";
import type { InjectOptions } from "fastify";
import { buildApp } from "../app.js";
import { db } from "../db/index.js";
import { AUTH_COOKIE_NAME } from "../auth/jwt.js";
import type { Role } from "../auth/jwt.js";
import { createAdminService } from "../services/admin.service.js";

// Runs against the migrated + seeded test database (same convention as auth/student tests).

const PW = "password123";
const TEACHER_ID = "00000000-0000-0000-0000-000000000002";
const STUDENT_ID = "00000000-0000-0000-0000-000000000004";
const MISSING_ID = "00000000-0000-0000-0000-0000000000ff"; // valid uuid, no such row

const EMAIL_PREFIX = "admintest_";
const GROUP_PREFIX = "ztestgroup_";
let seq = 0;
const uniqueEmail = () => `${EMAIL_PREFIX}${Date.now()}_${seq++}@example.com`;

let adminCookie: string;
let studentCookie: string;

async function loginAs(email: string): Promise<string> {
  const app = await buildApp();
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: PW } });
  const cookie = res.cookies.find((c) => c.name === AUTH_COOKIE_NAME)!.value;
  await app.close();
  return cookie;
}

// Injects with the admin session cookie by default.
async function asAdmin(method: InjectOptions["method"], url: string, payload?: InjectOptions["payload"]) {
  const app = await buildApp();
  const res = await app.inject({ method, url, cookies: { [AUTH_COOKIE_NAME]: adminCookie }, payload });
  await app.close();
  return res;
}

async function createTempUser(role: Role = "student"): Promise<string> {
  const res = await asAdmin("POST", "/api/admin/users", {
    email: uniqueEmail(),
    name: "Temp User",
    role,
    password: PW,
  });
  expect(res.statusCode).toBe(201);
  return res.json().id;
}

beforeAll(async () => {
  adminCookie = await loginAs("admin@example.com");
  studentCookie = await loginAs("student@example.com");
});

afterAll(async () => {
  await db.deleteFrom("teacher_groups").where("name", "like", `${GROUP_PREFIX}%`).execute();
  await db.deleteFrom("users").where("email", "like", `${EMAIL_PREFIX}%`).execute();
});

describe("admin auth guards", () => {
  it("401s with no session cookie", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/admin/users" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("403s for a non-admin role", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/admin/users",
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

describe("GET /api/admin/users", () => {
  it("lists all seeded users without leaking password_hash", async () => {
    const res = await asAdmin("GET", "/api/admin/users");
    expect(res.statusCode).toBe(200);
    const users = res.json().users;
    expect(users.length).toBeGreaterThanOrEqual(6);
    expect(users.every((u: Record<string, unknown>) => !("password_hash" in u))).toBe(true);
  });

  it("filters by role", async () => {
    const res = await asAdmin("GET", "/api/admin/users?role=teacher");
    expect(res.statusCode).toBe(200);
    expect(res.json().users.every((u: { role: string }) => u.role === "teacher")).toBe(true);
  });
});

describe("POST /api/admin/users", () => {
  it("creates a user and returns 201", async () => {
    const id = await createTempUser("teacher");
    expect(id).toBeTruthy();
  });

  it("409s on a duplicate email", async () => {
    const res = await asAdmin("POST", "/api/admin/users", {
      email: "admin@example.com",
      name: "Dupe",
      role: "student",
      password: PW,
    });
    expect(res.statusCode).toBe(409);
  });

  it("400s on an invalid payload (short password)", async () => {
    const res = await asAdmin("POST", "/api/admin/users", {
      email: uniqueEmail(),
      name: "Bad",
      role: "student",
      password: "short",
    });
    expect(res.statusCode).toBe(400);
  });
});

describe("PATCH /api/admin/users/:id", () => {
  it("updates a user's name", async () => {
    const id = await createTempUser();
    const res = await asAdmin("PATCH", `/api/admin/users/${id}`, { name: "Renamed" });
    expect(res.statusCode).toBe(200);
    expect(res.json().name).toBe("Renamed");
  });

  it("409s when updating to an email already in use", async () => {
    const a = await createTempUser();
    const bEmail = uniqueEmail();
    await asAdmin("POST", "/api/admin/users", { email: bEmail, name: "B", role: "student", password: PW });
    const res = await asAdmin("PATCH", `/api/admin/users/${a}`, { email: bEmail });
    expect(res.statusCode).toBe(409);
  });

  it("404s on an unknown user", async () => {
    const res = await asAdmin("PATCH", `/api/admin/users/${MISSING_ID}`, { name: "Nope" });
    expect(res.statusCode).toBe(404);
  });

  it("400s on an empty patch", async () => {
    const id = await createTempUser();
    const res = await asAdmin("PATCH", `/api/admin/users/${id}`, {});
    expect(res.statusCode).toBe(400);
  });
});

describe("suspend / unsuspend", () => {
  it("toggles is_suspended", async () => {
    const id = await createTempUser();
    const s = await asAdmin("POST", `/api/admin/users/${id}/suspend`);
    expect(s.statusCode).toBe(200);
    expect(s.json().is_suspended).toBe(true);
    const u = await asAdmin("POST", `/api/admin/users/${id}/unsuspend`);
    expect(u.json().is_suspended).toBe(false);
  });

  it("404s suspending an unknown user", async () => {
    const res = await asAdmin("POST", `/api/admin/users/${MISSING_ID}/suspend`);
    expect(res.statusCode).toBe(404);
  });
});

describe("DELETE /api/admin/users/:id", () => {
  it("deletes a user with no dependencies (204)", async () => {
    const id = await createTempUser();
    const res = await asAdmin("DELETE", `/api/admin/users/${id}`);
    expect(res.statusCode).toBe(204);
  });

  it("409s deleting a teacher who still owns a class", async () => {
    const res = await asAdmin("DELETE", `/api/admin/users/${TEACHER_ID}`);
    expect(res.statusCode).toBe(409);
  });

  it("404s deleting an unknown user", async () => {
    const res = await asAdmin("DELETE", `/api/admin/users/${MISSING_ID}`);
    expect(res.statusCode).toBe(404);
  });
});

describe("teacher groups", () => {
  it("creates, lists, reads, renames, and deletes a group", async () => {
    const create = await asAdmin("POST", "/api/admin/groups", { name: `${GROUP_PREFIX}A` });
    expect(create.statusCode).toBe(201);
    const groupId = create.json().id;

    const list = await asAdmin("GET", "/api/admin/groups");
    expect(list.json().groups.some((g: { id: string }) => g.id === groupId)).toBe(true);

    const read = await asAdmin("GET", `/api/admin/groups/${groupId}`);
    expect(read.statusCode).toBe(200);
    expect(read.json().members).toEqual([]);

    const rename = await asAdmin("PATCH", `/api/admin/groups/${groupId}`, { name: `${GROUP_PREFIX}B` });
    expect(rename.json().name).toBe(`${GROUP_PREFIX}B`);

    const del = await asAdmin("DELETE", `/api/admin/groups/${groupId}`);
    expect(del.statusCode).toBe(204);
  });

  it("adds and removes a teacher member (idempotent add)", async () => {
    const groupId = (await asAdmin("POST", "/api/admin/groups", { name: `${GROUP_PREFIX}M` })).json().id;

    const add = await asAdmin("POST", `/api/admin/groups/${groupId}/members`, { teacherId: TEACHER_ID });
    expect(add.statusCode).toBe(201);
    expect(add.json().members.length).toBe(1);

    const addAgain = await asAdmin("POST", `/api/admin/groups/${groupId}/members`, { teacherId: TEACHER_ID });
    expect(addAgain.json().members.length).toBe(1); // idempotent

    const remove = await asAdmin("DELETE", `/api/admin/groups/${groupId}/members/${TEACHER_ID}`);
    expect(remove.statusCode).toBe(204);

    await asAdmin("DELETE", `/api/admin/groups/${groupId}`);
  });

  it("400s adding a non-teacher user", async () => {
    const groupId = (await asAdmin("POST", "/api/admin/groups", { name: `${GROUP_PREFIX}N` })).json().id;
    const res = await asAdmin("POST", `/api/admin/groups/${groupId}/members`, { teacherId: STUDENT_ID });
    expect(res.statusCode).toBe(400);
    await asAdmin("DELETE", `/api/admin/groups/${groupId}`);
  });

  it("404s adding a member to a missing group", async () => {
    const res = await asAdmin("POST", `/api/admin/groups/${MISSING_ID}/members`, { teacherId: TEACHER_ID });
    expect(res.statusCode).toBe(404);
  });

  it("400s when the teacher id does not exist", async () => {
    const groupId = (await asAdmin("POST", "/api/admin/groups", { name: `${GROUP_PREFIX}X` })).json().id;
    const res = await asAdmin("POST", `/api/admin/groups/${groupId}/members`, { teacherId: MISSING_ID });
    expect(res.statusCode).toBe(400);
    await asAdmin("DELETE", `/api/admin/groups/${groupId}`);
  });

  it("404s reading, renaming, deleting, or unassigning on a missing group", async () => {
    expect((await asAdmin("GET", `/api/admin/groups/${MISSING_ID}`)).statusCode).toBe(404);
    expect((await asAdmin("PATCH", `/api/admin/groups/${MISSING_ID}`, { name: "x" })).statusCode).toBe(404);
    expect((await asAdmin("DELETE", `/api/admin/groups/${MISSING_ID}`)).statusCode).toBe(404);
    expect((await asAdmin("DELETE", `/api/admin/groups/${MISSING_ID}/members/${TEACHER_ID}`)).statusCode).toBe(404);
  });
});

describe("admin.service (direct)", () => {
  it("rethrows non-unique DB errors on create", async () => {
    const service = createAdminService(db);
    await expect(
      service.createUser({ email: uniqueEmail(), name: "Bad Role", role: "wizard" as unknown as Role, password: PW })
    ).rejects.toMatchObject({ code: "23514" }); // check-constraint violation, not our CONFLICT
  });
});

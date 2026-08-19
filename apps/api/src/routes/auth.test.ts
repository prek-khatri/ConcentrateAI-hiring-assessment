import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";
import { db } from "../db/index.js";
import { AUTH_COOKIE_NAME } from "../auth/jwt.js";

// Run against a migrated + seeded test database (see PLANNING.md / README —
// `DATABASE_URL` pointed at a disposable Postgres, `npm run migrate && npm run seed`).

describe("POST /auth/login", () => {
  it("401s on unknown email", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "nope@example.com", password: "whatever" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("400s on invalid payload", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email: "not-an-email" } });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("logs in a seeded user with the correct password and sets a session cookie", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "student@example.com", password: "password123" },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("student");
    expect(res.cookies.some((c) => c.name === AUTH_COOKIE_NAME)).toBe(true);
    await app.close();
  });

  it("401s on wrong password", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "student@example.com", password: "wrong-password" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("403s for a suspended user", async () => {
    const app = await buildApp();
    const suspended = await db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", "student2@example.com")
      .executeTakeFirstOrThrow();
    await db.updateTable("users").set({ is_suspended: true }).where("id", "=", suspended.id).execute();

    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "student2@example.com", password: "password123" },
    });
    expect(res.statusCode).toBe(403);

    await db.updateTable("users").set({ is_suspended: false }).where("id", "=", suspended.id).execute();
    await app.close();
  });
});

describe("GET /api/auth/me", () => {
  it("401s with no session cookie", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/api/auth/me" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("returns the current user with a valid session cookie", async () => {
    const app = await buildApp();
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "teacher@example.com", password: "password123" },
    });
    const cookie = login.cookies.find((c) => c.name === AUTH_COOKIE_NAME)!;

    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { [AUTH_COOKIE_NAME]: cookie.value },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json().role).toBe("teacher");
    await app.close();
  });
});

describe("POST /auth/logout", () => {
  it("401s with no session cookie", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/auth/logout" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("clears the session cookie when authenticated", async () => {
    const app = await buildApp();
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "admin@example.com", password: "password123" },
    });
    const cookie = login.cookies.find((c) => c.name === AUTH_COOKIE_NAME)!;

    const res = await app.inject({
      method: "POST",
      url: "/auth/logout",
      cookies: { [AUTH_COOKIE_NAME]: cookie.value },
    });
    expect(res.statusCode).toBe(204);
    await app.close();
  });
});

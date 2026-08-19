import { describe, it, expect } from "vitest";
import { buildApp } from "../app.js";
import { db } from "../db/index.js";
import { AUTH_COOKIE_NAME, signSessionToken } from "./jwt.js";
import { env } from "../env.js";

describe("requireAuth", () => {
  it("401s on a malformed/tampered token", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { [AUTH_COOKIE_NAME]: "not-a-real-token" },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("401s when the token's user no longer exists", async () => {
    const app = await buildApp();
    const token = signSessionToken({ sub: "00000000-0000-0000-0000-00000000dead", role: "student" }, env.JWT_SECRET);
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { [AUTH_COOKIE_NAME]: token },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("403s when the user was suspended after the session token was issued", async () => {
    const user = await db.selectFrom("users").selectAll().where("email", "=", "student3@example.com").executeTakeFirstOrThrow();
    const token = signSessionToken({ sub: user.id, role: user.role }, env.JWT_SECRET);
    await db.updateTable("users").set({ is_suspended: true }).where("id", "=", user.id).execute();

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: "/api/auth/me",
      cookies: { [AUTH_COOKIE_NAME]: token },
    });
    expect(res.statusCode).toBe(403);

    await db.updateTable("users").set({ is_suspended: false }).where("id", "=", user.id).execute();
    await app.close();
  });
});

describe("requireRole", () => {
  it("403s when the caller's role is not in the allowed list", async () => {
    const app = await buildApp();
    app.get(
      "/__test/admin-only",
      { preHandler: [(await import("./middleware.js")).requireAuth, (await import("./middleware.js")).requireRole("admin")] },
      async () => ({ ok: true })
    );

    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "student@example.com", password: "password123" },
    });
    const cookie = login.cookies.find((c) => c.name === AUTH_COOKIE_NAME)!;

    const res = await app.inject({
      method: "GET",
      url: "/__test/admin-only",
      cookies: { [AUTH_COOKIE_NAME]: cookie.value },
    });
    expect(res.statusCode).toBe(403);
    await app.close();
  });
});

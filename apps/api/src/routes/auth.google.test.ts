import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("../auth/google.js", () => ({
  createGoogleAuthRequest: vi.fn(),
  exchangeGoogleCode: vi.fn(),
}));

import { buildApp } from "../app.js";
import { db } from "../db/index.js";
import { AUTH_COOKIE_NAME } from "../auth/jwt.js";
import * as google from "../auth/google.js";

const STATE = "test-state";
const CODE_VERIFIER = "test-code-verifier";

function fakeProfile(overrides: Partial<google.GoogleProfile> = {}): google.GoogleProfile {
  return { sub: "google-sub-1", email: "new-oauth-user@example.com", name: "New OAuth User", emailVerified: true, ...overrides };
}

beforeEach(() => {
  vi.mocked(google.createGoogleAuthRequest).mockResolvedValue({
    url: new URL("https://accounts.google.com/o/oauth2/v2/auth?mock=1"),
    state: STATE,
    codeVerifier: CODE_VERIFIER,
  });
});

afterEach(async () => {
  vi.clearAllMocks();
  await db.deleteFrom("oauth_accounts").where("provider_account_id", "like", "google-sub-%").execute();
  await db.deleteFrom("users").where("email", "like", "%oauth-user@example.com").execute();
});

describe("GET /auth/google", () => {
  it("sets state/verifier cookies and redirects to the Google authorization URL", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/auth/google" });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("accounts.google.com");
    expect(res.cookies.some((c) => c.name === "oauth_state")).toBe(true);
    expect(res.cookies.some((c) => c.name === "oauth_verifier")).toBe(true);
    await app.close();
  });
});

describe("GET /auth/google/callback", () => {
  it("401s when code/state query params are missing", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/auth/google/callback" });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("401s when state doesn't match the cookie", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/auth/google/callback?code=abc&state=wrong-state`,
      cookies: { oauth_state: STATE, oauth_verifier: CODE_VERIFIER },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("401s when Google's email isn't verified", async () => {
    vi.mocked(google.exchangeGoogleCode).mockResolvedValue(fakeProfile({ emailVerified: false }));
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/auth/google/callback?code=abc&state=${STATE}`,
      cookies: { oauth_state: STATE, oauth_verifier: CODE_VERIFIER },
    });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("creates a new user on first sign-in with no existing account", async () => {
    vi.mocked(google.exchangeGoogleCode).mockResolvedValue(fakeProfile());
    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/auth/google/callback?code=abc&state=${STATE}`,
      cookies: { oauth_state: STATE, oauth_verifier: CODE_VERIFIER },
    });
    expect(res.statusCode).toBe(302);
    expect(res.headers.location).toContain("/student");
    expect(res.cookies.some((c) => c.name === AUTH_COOKIE_NAME)).toBe(true);

    const created = await db.selectFrom("users").selectAll().where("email", "=", "new-oauth-user@example.com").executeTakeFirst();
    expect(created).toBeDefined();
    await app.close();
  });

  it("links to an existing user by email when no oauth_accounts row exists yet", async () => {
    const existing = await db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", "teacher@example.com")
      .executeTakeFirstOrThrow();
    vi.mocked(google.exchangeGoogleCode).mockResolvedValue(
      fakeProfile({ sub: "google-sub-link", email: "teacher@example.com" })
    );

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/auth/google/callback?code=abc&state=${STATE}`,
      cookies: { oauth_state: STATE, oauth_verifier: CODE_VERIFIER },
    });
    expect(res.statusCode).toBe(302);

    const link = await db
      .selectFrom("oauth_accounts")
      .selectAll()
      .where("user_id", "=", existing.id)
      .where("provider_account_id", "=", "google-sub-link")
      .executeTakeFirst();
    expect(link).toBeDefined();

    await db.deleteFrom("oauth_accounts").where("provider_account_id", "=", "google-sub-link").execute();
    await app.close();
  });

  it("reuses the linked user on a repeat sign-in via the same google account", async () => {
    vi.mocked(google.exchangeGoogleCode).mockResolvedValue(fakeProfile({ sub: "google-sub-repeat" }));
    const app = await buildApp();

    const first = await app.inject({
      method: "GET",
      url: `/auth/google/callback?code=abc&state=${STATE}`,
      cookies: { oauth_state: STATE, oauth_verifier: CODE_VERIFIER },
    });
    expect(first.statusCode).toBe(302);

    const second = await app.inject({
      method: "GET",
      url: `/auth/google/callback?code=abc&state=${STATE}`,
      cookies: { oauth_state: STATE, oauth_verifier: CODE_VERIFIER },
    });
    expect(second.statusCode).toBe(302);

    const users = await db.selectFrom("users").selectAll().where("email", "=", "new-oauth-user@example.com").execute();
    expect(users).toHaveLength(1);
    await app.close();
  });

  it("403s when the linked/found user is suspended", async () => {
    const suspended = await db
      .selectFrom("users")
      .selectAll()
      .where("email", "=", "student2@example.com")
      .executeTakeFirstOrThrow();
    await db.updateTable("users").set({ is_suspended: true }).where("id", "=", suspended.id).execute();
    vi.mocked(google.exchangeGoogleCode).mockResolvedValue(
      fakeProfile({ sub: "google-sub-suspended", email: "student2@example.com" })
    );

    const app = await buildApp();
    const res = await app.inject({
      method: "GET",
      url: `/auth/google/callback?code=abc&state=${STATE}`,
      cookies: { oauth_state: STATE, oauth_verifier: CODE_VERIFIER },
    });
    expect(res.statusCode).toBe(403);

    await db.updateTable("users").set({ is_suspended: false }).where("id", "=", suspended.id).execute();
    await db.deleteFrom("oauth_accounts").where("provider_account_id", "=", "google-sub-suspended").execute();
    await app.close();
  });
});

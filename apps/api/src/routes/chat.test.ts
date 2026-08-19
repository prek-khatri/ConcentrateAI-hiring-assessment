import { describe, it, expect, vi, afterEach, beforeAll } from "vitest";
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

beforeAll(async () => {
  studentCookie = await loginAs("student@example.com");
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("POST /api/chat", () => {
  it("401s with no session cookie", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "POST", url: "/api/chat", payload: { message: "hi" } });
    expect(res.statusCode).toBe(401);
    await app.close();
  });

  it("400s on an empty message", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
      payload: { message: "" },
    });
    expect(res.statusCode).toBe(400);
    await app.close();
  });

  it("returns Groq's reply for an authenticated student, scoped to their own context", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ choices: [{ message: { content: "You have 1 graded assignment: 92/100." } }] }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
      payload: { message: "What's my grade in Biology?" },
    });

    expect(res.statusCode).toBe(200);
    expect(res.json().reply).toContain("92/100");

    const [, requestInit] = fetchMock.mock.calls[0];
    const sentBody = JSON.parse(requestInit.body as string);
    expect(sentBody.messages[0].content).toContain("Cell Structure");
    await app.close();
  });

  it("surfaces a 500 if Groq isn't configured or the request fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));

    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/api/chat",
      cookies: { [AUTH_COOKIE_NAME]: studentCookie },
      payload: { message: "hi" },
    });
    expect(res.statusCode).toBe(500);
    await app.close();
  });
});

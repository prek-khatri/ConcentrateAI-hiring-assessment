import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { buildApp } from "../app.js";
import { db } from "../db/index.js";
import { redis } from "../db/redis.js";
import { AUTH_COOKIE_NAME } from "../auth/jwt.js";

const PW = "password123";
const MISSING_ID = "00000000-0000-0000-0000-0000000000ff";

let studentCookie: string;
let classId: string;

async function loginAs(email: string): Promise<string> {
  const app = await buildApp();
  const res = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password: PW } });
  const cookie = res.cookies.find((c) => c.name === AUTH_COOKIE_NAME)!.value;
  await app.close();
  return cookie;
}

async function get(url: string, cookie?: string) {
  const app = await buildApp();
  const res = await app.inject({
    method: "GET",
    url,
    cookies: cookie ? { [AUTH_COOKIE_NAME]: cookie } : undefined,
  });
  await app.close();
  return res;
}

beforeAll(async () => {
  await redis.flushdb(); // start from a cold cache
  studentCookie = await loginAs("student@example.com");
  const cls = await db.selectFrom("classes").selectAll().where("name", "=", "Biology 101").executeTakeFirstOrThrow();
  classId = cls.id;
});

afterAll(async () => {
  await redis.quit();
});

describe("stats auth guard", () => {
  it("401s without a session cookie", async () => {
    const res = await get("/api/v0/stats/average-grades");
    expect(res.statusCode).toBe(401);
  });

  it("allows any authenticated role (student) to read stats", async () => {
    const res = await get("/api/v0/stats/teacher-names", studentCookie);
    expect(res.statusCode).toBe(200);
  });
});

describe("GET /api/v0/stats/average-grades", () => {
  it("returns the overall average and serves the second call from cache", async () => {
    const first = await get("/api/v0/stats/average-grades", studentCookie);
    expect(first.statusCode).toBe(200);
    expect(typeof first.json().average).toBe("number");
    expect(first.json().count).toBeGreaterThanOrEqual(1);

    const second = await get("/api/v0/stats/average-grades", studentCookie); // cache hit
    expect(second.json()).toEqual(first.json());
  });

  it("returns the average for a specific class", async () => {
    const res = await get(`/api/v0/stats/average-grades/${classId}`, studentCookie);
    expect(res.statusCode).toBe(200);
    expect(res.json().classId).toBe(classId);
    expect(typeof res.json().average).toBe("number");
  });

  it("404s for an unknown class", async () => {
    const res = await get(`/api/v0/stats/average-grades/${MISSING_ID}`, studentCookie);
    expect(res.statusCode).toBe(404);
  });

  it("400s for a malformed class id instead of crashing on a raw DB error", async () => {
    const res = await get("/api/v0/stats/average-grades/not-a-uuid", studentCookie);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });
});

describe("name and class listings", () => {
  it("lists teacher names", async () => {
    const res = await get("/api/v0/stats/teacher-names", studentCookie);
    expect(res.json().map((t: { name: string }) => t.name)).toContain("Terry Teacher");
  });

  it("lists student names", async () => {
    const res = await get("/api/v0/stats/student-names", studentCookie);
    expect(res.json().map((s: { name: string }) => s.name)).toContain("Sam Student");
  });

  it("lists all classes with their teacher", async () => {
    const res = await get("/api/v0/stats/classes", studentCookie);
    const bio = res.json().find((c: { name: string }) => c.name === "Biology 101");
    expect(bio.teacherName).toBe("Terry Teacher");
  });

  it("lists the students in a class", async () => {
    const res = await get(`/api/v0/stats/classes/${classId}`, studentCookie);
    expect(res.statusCode).toBe(200);
    expect(res.json().length).toBeGreaterThanOrEqual(1);
  });

  it("404s listing students for an unknown class", async () => {
    const res = await get(`/api/v0/stats/classes/${MISSING_ID}`, studentCookie);
    expect(res.statusCode).toBe(404);
  });

  it("400s listing students for a malformed class id", async () => {
    const res = await get("/api/v0/stats/classes/not-a-uuid", studentCookie);
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
  });
});

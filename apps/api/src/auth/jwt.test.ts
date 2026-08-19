import { describe, it, expect } from "vitest";
import { signSessionToken, verifySessionToken, authCookieOptions } from "./jwt.js";

const SECRET = "a".repeat(32);

describe("session tokens", () => {
  it("round-trips sub and role through sign/verify", () => {
    const token = signSessionToken({ sub: "user-1", role: "student" }, SECRET);
    const payload = verifySessionToken(token, SECRET);
    expect(payload.sub).toBe("user-1");
    expect(payload.role).toBe("student");
  });

  it("throws when verifying with the wrong secret", () => {
    const token = signSessionToken({ sub: "user-1", role: "student" }, SECRET);
    expect(() => verifySessionToken(token, "b".repeat(32))).toThrow();
  });
});

describe("authCookieOptions", () => {
  it("sets secure only in production", () => {
    expect(authCookieOptions(true).secure).toBe(true);
    expect(authCookieOptions(false).secure).toBe(false);
  });

  it("is always httpOnly with sameSite lax", () => {
    const opts = authCookieOptions(false);
    expect(opts.httpOnly).toBe(true);
    expect(opts.sameSite).toBe("lax");
  });
});

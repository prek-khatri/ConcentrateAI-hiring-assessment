import { describe, it, expect } from "vitest";
import { NextRequest } from "next/server";
import { middleware } from "./middleware";

function makeRequest(path: string, cookie?: string) {
  const req = new NextRequest(new URL(path, "http://localhost:3000"));
  if (cookie) {
    req.cookies.set("school_session", cookie);
  }
  return req;
}

describe("middleware", () => {
  it("redirects to / when a protected path has no session cookie", () => {
    const res = middleware(makeRequest("/student"));
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("passes through a protected path when the session cookie is present", () => {
    const res = middleware(makeRequest("/student", "some-token"));
    expect(res.status).toBe(200);
  });

  it("passes through an unprotected path with no cookie", () => {
    const res = middleware(makeRequest("/"));
    expect(res.status).toBe(200);
  });
});

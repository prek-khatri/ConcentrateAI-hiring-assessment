import { describe, it, expect } from "vitest";
import { buildApp } from "./app.js";

describe("GET /health", () => {
  it("returns 200 ok", async () => {
    const app = await buildApp();
    const res = await app.inject({ method: "GET", url: "/health" });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toEqual({ status: "ok" });
    await app.close();
  });
});

describe("request-parsing errors", () => {
  it("maps a bad JSON content-type/empty-body request to 400 VALIDATION_ERROR, not a 500", async () => {
    const app = await buildApp();
    const res = await app.inject({
      method: "POST",
      url: "/auth/login",
      headers: { "content-type": "application/json" },
    });
    expect(res.statusCode).toBe(400);
    expect(res.json().error.code).toBe("VALIDATION_ERROR");
    await app.close();
  });
});

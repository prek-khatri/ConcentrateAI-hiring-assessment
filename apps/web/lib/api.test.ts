import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetch, ApiClientError } from "./api";

const originalLocation = window.location;

function setPathname(pathname: string) {
  Object.defineProperty(window, "location", {
    value: { pathname, href: `http://localhost:3000${pathname}` },
    writable: true,
    configurable: true,
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  Object.defineProperty(window, "location", { value: originalLocation, writable: true, configurable: true });
});

describe("apiFetch", () => {
  it("returns parsed JSON on success", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ a: 1 }) }));
    const result = await apiFetch<{ a: number }>("/api/classes");
    expect(result).toEqual({ a: 1 });
  });

  it("returns undefined on 204 No Content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) }));
    const result = await apiFetch("/auth/logout", { method: "POST" });
    expect(result).toBeUndefined();
  });

  it("throws ApiClientError with code/message on non-2xx", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: { code: "FORBIDDEN", message: "nope" } }),
      })
    );
    await expect(apiFetch("/api/classes")).rejects.toMatchObject({ code: "FORBIDDEN", message: "nope" });
  });

  it("falls back to a generic error when the body has no error shape", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    const err = await apiFetch("/api/classes").catch((e) => e);
    expect(err).toBeInstanceOf(ApiClientError);
    expect((err as ApiClientError).code).toBe("INTERNAL_ERROR");
  });

  it("sends credentials always, and JSON content-type only when there's a body", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/api/classes", { method: "POST", body: JSON.stringify({ a: 1 }) });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.credentials).toBe("include");
    expect(options.headers["Content-Type"]).toBe("application/json");
  });

  it("omits Content-Type on a bodyless request (Fastify 400s on empty JSON body + that header)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 204, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/auth/logout", { method: "POST" });
    const [, options] = fetchMock.mock.calls[0];
    expect(options.headers["Content-Type"]).toBeUndefined();
  });

  it("sends an expired/invalid session back to login on a 401", async () => {
    setPathname("/teacher");
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: "UNAUTHORIZED", message: "Invalid or expired session" } }),
      })
    );
    await apiFetch("/api/teacher/classes").catch(() => {});
    expect(window.location.href).toBe("/");
  });

  it("does not bounce-redirect a 401 that happens on the login page itself", async () => {
    setPathname("/");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: {} }) }));
    await apiFetch("/api/auth/me").catch(() => {});
    expect(window.location.href).toBe("http://localhost:3000/");
  });
});

import { describe, it, expect, vi, afterEach } from "vitest";
import { apiFetch, ApiClientError } from "./api";

afterEach(() => vi.restoreAllMocks());

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

  it("sends credentials and JSON content-type by default", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);
    await apiFetch("/api/classes");
    const [, options] = fetchMock.mock.calls[0];
    expect(options.credentials).toBe("include");
    expect(options.headers["Content-Type"]).toBe("application/json");
  });
});

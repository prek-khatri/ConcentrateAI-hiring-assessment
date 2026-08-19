import { describe, it, expect, vi, afterEach } from "vitest";

const createAuthorizationURL = vi.fn();
const validateAuthorizationCode = vi.fn();

vi.mock("arctic", () => ({
  Google: vi.fn().mockImplementation(() => ({
    createAuthorizationURL,
    validateAuthorizationCode,
  })),
  generateCodeVerifier: () => "mock-code-verifier",
  generateState: () => "mock-state",
}));

afterEach(() => {
  vi.clearAllMocks();
  vi.resetModules();
  vi.unstubAllGlobals();
});

describe("createGoogleAuthRequest", () => {
  it("throws when Google OAuth env vars aren't configured", async () => {
    vi.doMock("../env.js", () => ({
      env: { GOOGLE_CLIENT_ID: undefined, GOOGLE_CLIENT_SECRET: undefined, GOOGLE_CALLBACK_URL: undefined },
    }));
    const { createGoogleAuthRequest } = await import("./google.js");
    await expect(createGoogleAuthRequest()).rejects.toThrow(/not configured/i);
  });

  it("returns the authorization URL, state, and code verifier when configured", async () => {
    vi.doMock("../env.js", () => ({
      env: {
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
        GOOGLE_CALLBACK_URL: "http://localhost:4000/auth/google/callback",
      },
    }));
    createAuthorizationURL.mockResolvedValue(new URL("https://accounts.google.com/o/oauth2/v2/auth"));

    const { createGoogleAuthRequest } = await import("./google.js");
    const result = await createGoogleAuthRequest();

    expect(result.state).toBe("mock-state");
    expect(result.codeVerifier).toBe("mock-code-verifier");
    expect(result.url.toString()).toContain("accounts.google.com");
  });
});

describe("exchangeGoogleCode", () => {
  it("throws when the userinfo request fails", async () => {
    vi.doMock("../env.js", () => ({
      env: {
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
        GOOGLE_CALLBACK_URL: "http://localhost:4000/auth/google/callback",
      },
    }));
    validateAuthorizationCode.mockResolvedValue({ accessToken: "mock-access-token" });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401 }));

    const { exchangeGoogleCode } = await import("./google.js");
    await expect(exchangeGoogleCode("code", "verifier")).rejects.toThrow(/failed to fetch google profile/i);
  });

  it("returns the mapped profile on success", async () => {
    vi.doMock("../env.js", () => ({
      env: {
        GOOGLE_CLIENT_ID: "client-id",
        GOOGLE_CLIENT_SECRET: "client-secret",
        GOOGLE_CALLBACK_URL: "http://localhost:4000/auth/google/callback",
      },
    }));
    validateAuthorizationCode.mockResolvedValue({ accessToken: "mock-access-token" });
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ sub: "google-123", email: "a@example.com", name: "A B", email_verified: true }),
      })
    );

    const { exchangeGoogleCode } = await import("./google.js");
    const profile = await exchangeGoogleCode("code", "verifier");

    expect(profile).toEqual({ sub: "google-123", email: "a@example.com", name: "A B", emailVerified: true });
  });
});

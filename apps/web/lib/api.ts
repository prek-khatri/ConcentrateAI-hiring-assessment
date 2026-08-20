export class ApiClientError extends Error {
  code: string;
  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export async function apiFetch<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...options.headers },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json();
  if (!res.ok) {
    // An expired/invalid session cookie still passes the middleware's presence check (it
    // only looks for the cookie, not whether it verifies), so a stale session otherwise
    // just sits on the protected page showing an inline error forever. Send the user back
    // to login instead — guarded so an anonymous visitor's own auth check on the login
    // page itself (e.g. the chat widget) doesn't bounce-reload that page.
    if (res.status === 401 && typeof window !== "undefined" && window.location.pathname !== "/") {
      window.location.href = "/";
    }
    throw new ApiClientError(body.error?.code ?? "INTERNAL_ERROR", body.error?.message ?? "Request failed");
  }
  return body as T;
}

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
    headers: { "Content-Type": "application/json", ...options.headers },
  });

  if (res.status === 204) {
    return undefined as T;
  }

  const body = await res.json();
  if (!res.ok) {
    throw new ApiClientError(body.error?.code ?? "INTERNAL_ERROR", body.error?.message ?? "Request failed");
  }
  return body as T;
}

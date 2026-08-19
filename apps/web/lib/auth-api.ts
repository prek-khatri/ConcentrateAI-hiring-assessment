import { apiFetch } from "./api";

export type CurrentUser = { id: string; name: string; email: string; role: "admin" | "teacher" | "student" };

export const authApi = {
  me: () => apiFetch<CurrentUser>("/api/auth/me"),
  logout: () => apiFetch<void>("/auth/logout", { method: "POST" }),
};

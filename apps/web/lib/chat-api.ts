import { apiFetch } from "./api";

export const chatApi = {
  ask: (message: string) => apiFetch<{ reply: string }>("/api/chat", { method: "POST", body: JSON.stringify({ message }) }),
};

import { describe, it, expect, vi, afterEach } from "vitest";
import { db } from "../db/index.js";
import { buildContextForUser, askChatbot } from "./chat.service.js";

afterEach(() => vi.unstubAllGlobals());

describe("buildContextForUser", () => {
  it("builds a student context from their classes and submissions", async () => {
    const student = await db.selectFrom("users").selectAll().where("email", "=", "student@example.com").executeTakeFirstOrThrow();
    const context = await buildContextForUser(db, {
      id: student.id,
      email: student.email,
      name: student.name,
      role: "student",
    });
    expect(context).toContain("Biology 101");
    expect(context).toContain("Cell Structure");
  });

  it("returns a minimal honest context for roles without wired-up data yet", async () => {
    const context = await buildContextForUser(db, {
      id: "teacher-id",
      email: "teacher@example.com",
      name: "Terry Teacher",
      role: "teacher",
    });
    expect(context).toContain("No further context is available yet");
  });
});

describe("askChatbot", () => {
  it("throws when Groq responds with a non-2xx status", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({}) }));
    await expect(askChatbot("some context", "hi")).rejects.toThrow(/groq request failed/i);
  });

  it("falls back to a generic message if Groq returns no choices", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, json: async () => ({ choices: [] }) }));
    const reply = await askChatbot("some context", "hi");
    expect(reply).toMatch(/couldn't generate a response/i);
  });
});

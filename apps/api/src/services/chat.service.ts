import type { Kysely } from "kysely";
import type { DB } from "../db/schema.js";
import { env } from "../env.js";
import { ApiError } from "../errors.js";
import { createStudentService } from "./student.service.js";
import type { AuthedUser } from "../auth/middleware.js";

const GROQ_CHAT_URL = "https://api.groq.com/openai/v1/chat/completions";

const SYSTEM_PROMPT = [
  "You are a helpful assistant embedded in a school portal.",
  "Answer ONLY using the context about the current user provided below.",
  "If the answer isn't in the context, say you don't have that information.",
  "Never invent data and never discuss anyone else's information.",
].join(" ");

export async function buildContextForUser(db: Kysely<DB>, user: AuthedUser): Promise<string> {
  if (user.role === "student") {
    const service = createStudentService(db);
    const classes = await service.listMyClasses(user.id);
    const assignments = await service.listAllAssignments(user.id);

    const classLines =
      classes.length > 0 ? classes.map((c) => `${c.name} (taught by ${c.teacherName})`).join("; ") : "none";

    const notSubmittedLines = assignments
      .filter((a) => a.submissionId === null)
      .map((a) => `${a.title} (${a.className})${a.due_at ? `, due ${a.due_at.toISOString().slice(0, 10)}` : ""}`);
    const gradedLines = assignments
      .filter((a) => a.score !== null)
      .map((a) => `${a.title} (${a.className}): ${a.score}/100`);
    const awaitingGradeLines = assignments
      .filter((a) => a.submissionId !== null && a.score === null)
      .map((a) => `${a.title} (${a.className}): submitted, awaiting grade`);

    return [
      `The current user is a student named ${user.name}.`,
      `Enrolled classes: ${classLines}`,
      `Not yet submitted: ${notSubmittedLines.length > 0 ? notSubmittedLines.join("; ") : "none"}`,
      `Awaiting grade: ${awaitingGradeLines.length > 0 ? awaitingGradeLines.join("; ") : "none"}`,
      `Graded work: ${gradedLines.length > 0 ? gradedLines.join("; ") : "none yet"}`,
    ].join("\n");
  }

  // Teacher/admin context isn't wired up yet (owned by other verticals) — keep the bot
  // honest about what it actually knows rather than fabricating class/grade data for them.
  return `The current user is a ${user.role} named ${user.name}. No further context is available yet for this role.`;
}

export async function askChatbot(context: string, message: string): Promise<string> {
  if (!env.GROQ_API_KEY) {
    throw new ApiError("NOT_CONFIGURED", "The chatbot is not configured for this environment.");
  }

  const res = await fetch(GROQ_CHAT_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.GROQ_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "openai/gpt-oss-20b",
      max_tokens: 300,
      messages: [
        { role: "system", content: `${SYSTEM_PROMPT}\n\nContext:\n${context}` },
        { role: "user", content: message },
      ],
    }),
  });

  if (!res.ok) {
    throw new Error(`Groq request failed: ${res.status}`);
  }

  const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return data.choices?.[0]?.message?.content ?? "Sorry, I couldn't generate a response.";
}

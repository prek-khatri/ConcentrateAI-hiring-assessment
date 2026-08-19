import type { Kysely } from "kysely";
import type { DB } from "../db/schema.js";
import { env } from "../env.js";
import { ApiError } from "../errors.js";
import { createStudentService } from "./student.service.js";
import { createTeacherService } from "./teacher.service.js";
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

  if (user.role === "teacher") {
    const service = createTeacherService(db);
    const classes = await service.listMyClasses(user.id);

    if (classes.length === 0) {
      return `The current user is a teacher named ${user.name}. They have no classes yet.`;
    }

    const classLines = await Promise.all(
      classes.map(async (cls) => {
        const { roster, assignments } = await service.getClass(user.id, cls.id);
        const rosterLine =
          roster.length > 0 ? `${roster.length} students enrolled (${roster.map((s) => s.name).join(", ")})` : "no students enrolled";

        const assignmentLines = await Promise.all(
          assignments.map(async (a) => {
            const { submissions } = await service.getAssignment(user.id, a.id);
            const graded = submissions.filter((s) => s.score !== null);
            const avgScore = graded.length
              ? Math.round(graded.reduce((sum, s) => sum + Number(s.score), 0) / graded.length)
              : null;
            const notSubmitted = roster
              .filter((s) => !submissions.some((sub) => sub.studentId === s.id))
              .map((s) => s.name);

            return [
              `"${a.title}" (${a.published ? "published" : "draft"})`,
              `${submissions.length}/${roster.length} submitted`,
              avgScore !== null ? `average score ${avgScore}/100` : "no grades yet",
              graded.length < submissions.length ? `${submissions.length - graded.length} awaiting grading` : null,
              notSubmitted.length > 0 ? `not yet submitted: ${notSubmitted.join(", ")}` : null,
            ]
              .filter(Boolean)
              .join(", ");
          })
        );

        return [
          `${cls.name}: ${rosterLine}`,
          assignmentLines.length > 0 ? assignmentLines.map((l) => `  - ${l}`).join("\n") : "  No assignments yet",
        ].join("\n");
      })
    );

    return [`The current user is a teacher named ${user.name}.`, `Classes taught:`, classLines.join("\n")].join(
      "\n"
    );
  }

  // Admin context isn't wired up yet — the chatbot isn't shown to admins in the UI, but
  // keep this honest rather than fabricating data if it's ever called for one directly.
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

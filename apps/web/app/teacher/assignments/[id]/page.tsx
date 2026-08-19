"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/lib/api";

type Assignment = {
  id: string;
  class_id: string;
  title: string;
  description: string | null;
  published: boolean;
  due_at: string | null;
};

type Submission = {
  id: string;
  content: string;
  submitted_at: string;
  studentId: string;
  studentName: string;
  score: number | string | null;
  feedback: string | null;
};

type AssignmentDetail = { assignment: Assignment; submissions: Submission[] };

function SubmissionRow({ submission, onGraded }: { submission: Submission; onGraded: () => void }) {
  const [score, setScore] = useState(submission.score !== null ? String(submission.score) : "");
  const [feedback, setFeedback] = useState(submission.feedback ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleGrade(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await apiFetch(`/api/teacher/submissions/${submission.id}/grade`, {
        method: "POST",
        body: JSON.stringify({ score: Number(score), feedback: feedback || null }),
      });
      onGraded();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not save the grade.");
    } finally {
      setPending(false);
    }
  }

  const initials = submission.studentName
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <li className="flex flex-col gap-3 rounded-lg border border-line bg-white p-5">
      <div className="flex items-center gap-2.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">
          {initials}
        </div>
        <div>
          <p className="text-sm font-semibold">{submission.studentName}</p>
          <p className="font-mono text-xs text-muted">{new Date(submission.submitted_at).toLocaleString()}</p>
        </div>
      </div>

      <p className="whitespace-pre-wrap rounded-md border border-line bg-paper px-4 py-3 text-sm leading-relaxed text-ink">
        {submission.content}
      </p>

      <form onSubmit={handleGrade} className="flex flex-col gap-2.5 border-t border-line pt-3.5">
        <div className="flex items-center gap-2.5">
          <label className="flex items-center gap-2 text-xs font-medium text-muted">
            Score
            <span className="flex items-baseline gap-1">
              <input
                type="number"
                min={0}
                max={100}
                required
                placeholder="Score"
                value={score}
                onChange={(e) => setScore(e.target.value)}
                className="w-16 rounded-md border border-line px-2 py-1.5 text-center font-mono text-sm font-semibold text-ink outline-none focus:border-accent"
              />
              <span className="font-mono text-xs">/ 100</span>
            </span>
          </label>
          <input
            placeholder="Feedback (optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="flex-1 rounded-md border border-line px-3 py-1.5 text-sm outline-none focus:border-accent"
          />
        </div>
        {error ? (
          <p role="alert" className="text-danger">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {submission.score !== null ? "Update grade" : "Save grade"}
        </button>
      </form>
    </li>
  );
}

export default function AssignmentDetailPage() {
  const { id: assignmentId } = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [editPublished, setEditPublished] = useState(true);

  async function loadDetail() {
    const data = await apiFetch<AssignmentDetail>(`/api/teacher/assignments/${assignmentId}`);
    setDetail(data);
  }

  useEffect(() => {
    loadDetail().catch((err) =>
      setError(err instanceof ApiClientError ? err.message : "Failed to load assignment.")
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId]);

  function startEditing() {
    setEditTitle(detail!.assignment.title);
    setEditDescription(detail!.assignment.description ?? "");
    setEditDueAt(detail!.assignment.due_at ? detail!.assignment.due_at.slice(0, 10) : "");
    setEditPublished(detail!.assignment.published);
    setEditing(true);
  }

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/teacher/assignments/${assignmentId}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: editTitle,
          description: editDescription || null,
          dueAt: editDueAt ? new Date(editDueAt).toISOString() : null,
          published: editPublished,
        }),
      });
      setEditing(false);
      await loadDetail();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not update assignment.");
    }
  }

  async function handleDelete() {
    if (!confirm("Delete this assignment? This also removes any submissions and grades.")) return;
    setError(null);
    try {
      await apiFetch(`/api/teacher/assignments/${assignmentId}`, { method: "DELETE" });
      router.push(`/teacher/classes/${detail!.assignment.class_id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not delete assignment.");
    }
  }

  if (!detail) {
    return <main className="mx-auto max-w-2xl p-8 text-sm text-muted">{error ?? "Loading..."}</main>;
  }

  const graded = detail.submissions.filter((s) => s.score !== null);
  const avgScore = graded.length
    ? Math.round(graded.reduce((sum, s) => sum + Number(s.score), 0) / graded.length)
    : null;
  const needsGrading = detail.submissions.length - graded.length;

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-6 p-8">
      <div>
        <Link href={`/teacher/classes/${detail.assignment.class_id}`} className="text-sm text-muted hover:text-ink">
          &larr; Back to class
        </Link>

        {editing ? (
          <form onSubmit={handleSave} className="mt-2 flex flex-col gap-2.5">
            <input
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="rounded-md border border-line px-3 py-2 text-xl font-semibold outline-none focus:border-accent"
            />
            <input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <input
              type="date"
              value={editDueAt}
              onChange={(e) => setEditDueAt(e.target.value)}
              className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editPublished}
                onChange={(e) => setEditPublished(e.target.checked)}
                className="accent-accent"
              />
              Published (visible to students)
            </label>
            <div className="flex gap-2">
              <button type="submit" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditing(false)}
                className="rounded-md border border-line px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-2 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold">{detail.assignment.title}</h1>
              {detail.assignment.description ? (
                <p className="text-sm text-muted">{detail.assignment.description}</p>
              ) : null}
              <p className="mt-1 text-sm text-muted">
                {detail.assignment.published ? "Published" : "Draft"}
                {detail.assignment.due_at
                  ? ` · Due ${new Date(detail.assignment.due_at).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <button onClick={startEditing} className="font-medium text-muted hover:text-ink">
                Edit
              </button>
              <button onClick={handleDelete} className="font-medium text-danger hover:opacity-80">
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {detail.submissions.length > 0 ? (
        <div className="flex gap-8 rounded-lg border border-line bg-white px-6 py-4">
          <div>
            <p className="font-mono text-xl font-semibold">{avgScore ?? "—"}</p>
            <p className="text-xs text-muted">Average score</p>
          </div>
          <div>
            <p className="font-mono text-xl font-semibold">
              {detail.submissions.length}
              <span className="text-sm font-normal text-muted"> submitted</span>
            </p>
            <p className="text-xs text-muted">Submissions</p>
          </div>
          <div>
            <p className="font-mono text-xl font-semibold text-warn">{needsGrading}</p>
            <p className="text-xs text-muted">Needs grading</p>
          </div>
        </div>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-base font-semibold">Submissions</h2>
        {detail.submissions.length === 0 ? (
          <p className="text-sm text-muted">No submissions yet.</p>
        ) : (
          <ul className="flex flex-col gap-3">
            {detail.submissions.map((s) => (
              <SubmissionRow key={s.id} submission={s} onGraded={loadDetail} />
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

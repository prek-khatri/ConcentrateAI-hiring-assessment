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

function initialsFor(name: string): string {
  return name
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function SubmissionListItem({
  submission,
  selected,
  onSelect,
}: {
  submission: Submission;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <li>
      <button
        onClick={onSelect}
        className={`flex w-full items-center gap-2.5 border-l-2 px-3.5 py-3 text-left text-sm transition-colors ${
          selected ? "border-accent bg-accent-soft/40" : "border-transparent hover:bg-paper"
        }`}
      >
        <div className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-text">
          {initialsFor(submission.studentName)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate font-medium">{submission.studentName}</p>
          <p className="font-mono text-xs text-muted">
            submitted {new Date(submission.submitted_at).toLocaleDateString()}
          </p>
        </div>
        {submission.score !== null ? (
          <span className="font-mono text-sm font-semibold text-success-text">{submission.score}</span>
        ) : (
          <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[10px] font-semibold text-warn-text">
            To grade
          </span>
        )}
      </button>
    </li>
  );
}

function SubmissionDetail({
  submission,
  onGraded,
  onPrev,
  onNext,
  hasPrev,
  hasNext,
}: {
  submission: Submission;
  onGraded: () => void;
  onPrev: () => void;
  onNext: () => void;
  hasPrev: boolean;
  hasNext: boolean;
}) {
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

  return (
    <div className="flex flex-1 flex-col gap-3.5 overflow-y-auto p-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-accent-text">
            {initialsFor(submission.studentName)}
          </div>
          <div>
            <p className="text-sm font-semibold">{submission.studentName}</p>
            <p className="font-mono text-xs text-muted">submitted {new Date(submission.submitted_at).toLocaleString()}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          <button
            onClick={onPrev}
            disabled={!hasPrev}
            aria-label="Previous submission"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-muted disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M15 6l-6 6 6 6" />
            </svg>
          </button>
          <button
            onClick={onNext}
            disabled={!hasNext}
            aria-label="Next submission"
            className="flex h-7 w-7 items-center justify-center rounded-md border border-line text-muted disabled:opacity-40"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <path d="M9 6l6 6-6 6" />
            </svg>
          </button>
        </div>
      </div>

      <p className="whitespace-pre-wrap rounded-md border border-line bg-paper px-4 py-3 text-sm leading-relaxed text-ink">
        {submission.content}
      </p>

      <form onSubmit={handleGrade} className="flex flex-col gap-2.5 rounded-lg border border-line bg-white p-5">
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
    </div>
  );
}

export default function AssignmentDetailPage() {
  const { id: assignmentId } = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<AssignmentDetail | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editDueAt, setEditDueAt] = useState("");
  const [editPublished, setEditPublished] = useState(true);

  async function loadDetail() {
    const data = await apiFetch<AssignmentDetail>(`/api/teacher/assignments/${assignmentId}`);
    setDetail(data);
    setSelectedId((current) =>
      current && data.submissions.some((s) => s.id === current) ? current : (data.submissions[0]?.id ?? null)
    );
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
  const selectedIndex = detail.submissions.findIndex((s) => s.id === selectedId);
  const selectedSubmission = selectedIndex >= 0 ? detail.submissions[selectedIndex] : null;

  return (
    <main className="flex flex-col">
      <div className="px-8 pt-8">
        <Link href={`/teacher/classes/${detail.assignment.class_id}`} className="text-sm text-muted hover:text-ink">
          &larr; Back to class
        </Link>

        {editing ? (
          <form onSubmit={handleSave} className="mt-2 flex max-w-2xl flex-col gap-2.5">
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
        <p role="alert" className="mx-8 mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      {detail.submissions.length > 0 ? (
        <div className="mx-8 mt-6 flex gap-8 rounded-lg border border-line bg-white px-6 py-4">
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

      <section className="mt-6 flex flex-col gap-3 px-8 pb-8">
        <h2 className="text-base font-semibold">Submissions</h2>
        {detail.submissions.length === 0 ? (
          <p className="text-sm text-muted">No submissions yet.</p>
        ) : (
          <div className="flex overflow-hidden rounded-lg border border-line bg-white" style={{ minHeight: 360 }}>
            <ul className="w-[280px] flex-shrink-0 divide-y divide-line overflow-y-auto border-r border-line">
              {detail.submissions.map((s) => (
                <SubmissionListItem
                  key={s.id}
                  submission={s}
                  selected={s.id === selectedId}
                  onSelect={() => setSelectedId(s.id)}
                />
              ))}
            </ul>
            <SubmissionDetail
              key={selectedSubmission!.id}
              submission={selectedSubmission!}
              onGraded={loadDetail}
              onPrev={() => setSelectedId(detail.submissions[selectedIndex - 1].id)}
              onNext={() => setSelectedId(detail.submissions[selectedIndex + 1].id)}
              hasPrev={selectedIndex > 0}
              hasNext={selectedIndex < detail.submissions.length - 1}
            />
          </div>
        )}
      </section>
    </main>
  );
}

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

  return (
    <li className="flex flex-col gap-2 rounded border p-3 text-sm">
      <div className="flex items-center justify-between">
        <span className="font-medium">{submission.studentName}</span>
        <span className="text-gray-500">{new Date(submission.submitted_at).toLocaleString()}</span>
      </div>
      <p className="whitespace-pre-wrap text-gray-700">{submission.content}</p>

      <form onSubmit={handleGrade} className="flex flex-col gap-2 border-t pt-2">
        <div className="flex gap-2">
          <input
            type="number"
            min={0}
            max={100}
            required
            placeholder="Score"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            className="w-24 rounded border px-2 py-1"
          />
          <input
            placeholder="Feedback (optional)"
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            className="flex-1 rounded border px-2 py-1"
          />
        </div>
        {error ? (
          <p role="alert" className="text-red-600">
            {error}
          </p>
        ) : null}
        <button
          type="submit"
          disabled={pending}
          className="self-start rounded bg-black px-3 py-1 text-white disabled:opacity-50"
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
    if (!detail) return;
    setEditTitle(detail.assignment.title);
    setEditDescription(detail.assignment.description ?? "");
    setEditDueAt(detail.assignment.due_at ? detail.assignment.due_at.slice(0, 10) : "");
    setEditPublished(detail.assignment.published);
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
    if (!detail) return;
    if (!confirm("Delete this assignment? This also removes any submissions and grades.")) return;
    setError(null);
    try {
      await apiFetch(`/api/teacher/assignments/${assignmentId}`, { method: "DELETE" });
      router.push(`/teacher/classes/${detail.assignment.class_id}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not delete assignment.");
    }
  }

  if (!detail) {
    return <main className="mx-auto max-w-2xl p-6 text-sm text-gray-500">{error ?? "Loading..."}</main>;
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <Link href={`/teacher/classes/${detail.assignment.class_id}`} className="text-sm underline">
          &larr; Back to class
        </Link>

        {editing ? (
          <form onSubmit={handleSave} className="mt-2 flex flex-col gap-2">
            <input
              required
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
              className="rounded border px-3 py-2 text-xl font-semibold"
            />
            <input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              className="rounded border px-3 py-2 text-sm"
            />
            <input
              type="date"
              value={editDueAt}
              onChange={(e) => setEditDueAt(e.target.value)}
              className="rounded border px-3 py-2 text-sm"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={editPublished}
                onChange={(e) => setEditPublished(e.target.checked)}
              />
              Published (visible to students)
            </label>
            <div className="flex gap-2">
              <button type="submit" className="rounded bg-black px-3 py-2 text-sm text-white">
                Save
              </button>
              <button type="button" onClick={() => setEditing(false)} className="rounded border px-3 py-2 text-sm">
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-2 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold">{detail.assignment.title}</h1>
              {detail.assignment.description ? (
                <p className="text-sm text-gray-500">{detail.assignment.description}</p>
              ) : null}
              <p className="text-sm text-gray-500">
                {detail.assignment.published ? "Published" : "Draft"}
                {detail.assignment.due_at
                  ? ` · Due ${new Date(detail.assignment.due_at).toLocaleDateString()}`
                  : ""}
              </p>
            </div>
            <div className="flex gap-3 text-sm">
              <button onClick={startEditing} className="underline">
                Edit
              </button>
              <button onClick={handleDelete} className="text-red-600 underline">
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="font-medium">Submissions</h2>
        {detail.submissions.length === 0 ? (
          <p className="text-sm text-gray-500">No submissions yet.</p>
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

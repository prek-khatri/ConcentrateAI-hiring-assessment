"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams } from "next/navigation";
import { studentApi, type AssignmentDetail } from "@/lib/student-api";
import { ApiClientError } from "@/lib/api";

export default function AssignmentDetailPage() {
  const params = useParams<{ id: string }>();
  const [data, setData] = useState<AssignmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [pending, setPending] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // keepData=true refreshes in place (e.g. after a submit) without flashing "Loading…".
  function load(keepData = false) {
    setError(null);
    if (!keepData) {
      setData(null);
    }
    studentApi
      .getAssignment(params.id)
      .then((res) => {
        setData(res);
        setContent(res.submission?.content ?? "");
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load assignment."));
  }

  useEffect(() => {
    load();
  }, [params.id]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    if (!content.trim()) {
      setFormError("Content is required.");
      return;
    }
    setPending(true);
    try {
      if (data?.submission) {
        await studentApi.updateSubmission(params.id, content);
      } else {
        await studentApi.submit(params.id, content);
      }
      load(true);
    } catch (err) {
      setFormError(err instanceof ApiClientError ? err.message : "Failed to submit.");
    } finally {
      setPending(false);
    }
  }

  if (error) {
    return (
      <main className="p-8">
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}{" "}
          <button onClick={() => load()} className="font-semibold underline">
            Retry
          </button>
        </p>
      </main>
    );
  }

  if (data === null) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted">Loading assignment...</p>
      </main>
    );
  }

  const { assignment, submission } = data;
  const isGraded = submission?.score !== null && submission?.score !== undefined;

  return (
    <main className="mx-auto max-w-lg p-8">
      <h1 className="text-xl font-semibold">{assignment.title}</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink/80">{assignment.description}</p>
      {assignment.due_at ? (
        <p className="mt-1 text-sm text-muted">Due {new Date(assignment.due_at).toLocaleDateString()}</p>
      ) : null}

      {isGraded ? (
        <section className="mt-6 rounded-lg border border-line bg-white p-5">
          <p className="font-mono text-lg font-semibold text-success-text">Score: {submission!.score}/100</p>
          <p className="mt-3 text-xs font-semibold uppercase tracking-wide text-muted">Teacher Feedback:</p>
          <p className="mt-1 text-sm leading-relaxed">{submission!.feedback}</p>
        </section>
      ) : (
        <>
          {submission ? (
            <p
              role="status"
              className="mt-6 flex items-center gap-2 rounded-md border border-success/30 bg-success-soft px-3 py-2 text-sm text-success-text"
            >
              ✓ Submitted on {new Date(submission.submitted_at).toLocaleString()} — you can still update it below.
            </p>
          ) : null}
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium text-muted">Submission</span>
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="rounded-md border border-line px-3 py-2 outline-none focus:border-accent"
              />
            </label>
            {formError ? (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {formError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Submitting..." : submission ? "Update Submission" : "Submit Assignment"}
            </button>
          </form>
        </>
      )}
    </main>
  );
}

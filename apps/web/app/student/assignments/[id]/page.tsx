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
      <main className="p-6">
        <p role="alert">
          {error} <button onClick={() => load()}>Retry</button>
        </p>
      </main>
    );
  }

  if (data === null) {
    return (
      <main className="p-6">
        <p>Loading assignment...</p>
      </main>
    );
  }

  const { assignment, submission } = data;
  const isGraded = submission?.score !== null && submission?.score !== undefined;

  return (
    <main className="mx-auto max-w-lg p-6">
      <h1 className="text-xl font-semibold">{assignment.title}</h1>
      <p className="mt-2 text-gray-700">{assignment.description}</p>
      {assignment.due_at ? (
        <p className="mt-1 text-sm text-gray-500">Due {new Date(assignment.due_at).toLocaleDateString()}</p>
      ) : null}

      {isGraded ? (
        <section className="mt-6 rounded border p-4">
          <p className="font-medium">Score: {submission!.score}/100</p>
          <p className="mt-2 text-sm text-gray-700">Teacher Feedback:</p>
          <p className="text-sm">{submission!.feedback}</p>
        </section>
      ) : (
        <>
          {submission ? (
            <p
              role="status"
              className="mt-6 rounded border border-green-600 bg-green-50 px-3 py-2 text-sm text-green-700"
            >
              ✓ Submitted on {new Date(submission.submitted_at).toLocaleString()} — you can still update it below.
            </p>
          ) : null}
          <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-3">
            <label className="flex flex-col gap-1 text-sm">
              Submission
              <textarea
                value={content}
                onChange={(e) => setContent(e.target.value)}
                rows={6}
                className="rounded border px-3 py-2"
              />
            </label>
            {formError ? (
              <p role="alert" className="text-sm text-red-600">
                {formError}
              </p>
            ) : null}
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
            >
              {pending ? "Submitting..." : submission ? "Update Submission" : "Submit Assignment"}
            </button>
          </form>
        </>
      )}
    </main>
  );
}

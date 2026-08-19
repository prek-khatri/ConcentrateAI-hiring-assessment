"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { studentApi, type SubmissionSummary } from "@/lib/student-api";
import { ApiClientError } from "@/lib/api";

export default function SubmissionsPage() {
  const [submissions, setSubmissions] = useState<SubmissionSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    setSubmissions(null);
    studentApi
      .listSubmissions()
      .then((res) => setSubmissions(res.submissions))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load submissions."));
  }

  useEffect(load, []);

  if (error) {
    return (
      <main className="p-8">
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}{" "}
          <button onClick={load} className="font-semibold underline">
            Retry
          </button>
        </p>
      </main>
    );
  }

  if (submissions === null) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted">Loading submissions...</p>
      </main>
    );
  }

  if (submissions.length === 0) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted">No submissions yet.</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="mb-4 text-xl font-semibold">My Submissions</h1>
      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <table role="table" className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-semibold">Assignment</th>
              <th className="px-4 py-2.5 font-semibold">Class</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {submissions.map((s, i) => (
              <tr key={s.id} className={i > 0 ? "border-t border-line" : ""}>
                <td className="px-4 py-3">
                  <Link
                    href={`/student/assignments/${s.assignment_id}`}
                    className="font-medium text-accent-text hover:underline"
                  >
                    {s.assignmentTitle}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{s.className}</td>
                <td className="px-4 py-3">
                  {s.score !== null ? (
                    <span className="rounded-full bg-success-soft px-2.5 py-0.5 text-xs font-semibold text-success-text">
                      Graded — {s.score}/100
                    </span>
                  ) : (
                    <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold text-accent-text">
                      Submitted
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { studentApi, type AssignmentWithStatus } from "@/lib/student-api";
import { ApiClientError } from "@/lib/api";

function statusFor(a: AssignmentWithStatus): string {
  if (a.submissionId === null) return "Not submitted";
  return a.score !== null ? `Graded — ${a.score}/100` : "Submitted";
}

export default function AssignmentsPage() {
  const [assignments, setAssignments] = useState<AssignmentWithStatus[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    setAssignments(null);
    studentApi
      .listAllAssignments()
      .then((res) => setAssignments(res.assignments))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load assignments."));
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

  if (assignments === null) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted">Loading assignments...</p>
      </main>
    );
  }

  if (assignments.length === 0) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted">No assignments yet.</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="mb-4 text-xl font-semibold">Assignments</h1>
      <div className="overflow-hidden rounded-lg border border-line bg-white">
        <table role="table" className="w-full text-left text-sm">
          <thead>
            <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-muted">
              <th className="px-4 py-2.5 font-semibold">Title</th>
              <th className="px-4 py-2.5 font-semibold">Class</th>
              <th className="px-4 py-2.5 font-semibold">Due</th>
              <th className="px-4 py-2.5 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {assignments.map((a, i) => (
              <tr key={a.id} className={i > 0 ? "border-t border-line" : ""}>
                <td className="px-4 py-3">
                  <Link href={`/student/assignments/${a.id}`} className="font-medium text-accent-text hover:underline">
                    {a.title}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{a.className}</td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {a.due_at ? new Date(a.due_at).toLocaleDateString() : "—"}
                </td>
                <td className="px-4 py-3">{statusFor(a)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}

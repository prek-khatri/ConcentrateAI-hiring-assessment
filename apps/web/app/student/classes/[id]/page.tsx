"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { studentApi, type Assignment, type SubmissionSummary } from "@/lib/student-api";
import { ApiClientError } from "@/lib/api";

type Status = "Not submitted" | "Submitted" | "Graded";

function statusFor(assignmentId: string, submissions: SubmissionSummary[]): Status {
  const sub = submissions.find((s) => s.assignment_id === assignmentId);
  if (!sub) return "Not submitted";
  return sub.score !== null ? "Graded" : "Submitted";
}

export default function ClassAssignmentsPage() {
  const params = useParams<{ id: string }>();
  const [assignments, setAssignments] = useState<Assignment[] | null>(null);
  const [submissions, setSubmissions] = useState<SubmissionSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    setAssignments(null);
    Promise.all([studentApi.listAssignments(params.id), studentApi.listSubmissions()])
      .then(([assignmentsRes, submissionsRes]) => {
        setAssignments(assignmentsRes.assignments);
        setSubmissions(submissionsRes.submissions);
      })
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load assignments."));
  }

  useEffect(load, [params.id]);

  if (error) {
    return (
      <main className="p-6">
        <p role="alert">
          {error} <button onClick={load}>Retry</button>
        </p>
      </main>
    );
  }

  if (assignments === null) {
    return (
      <main className="p-6">
        <p>Loading assignments...</p>
      </main>
    );
  }

  if (assignments.length === 0) {
    return (
      <main className="p-6">
        <p>No assignments yet.</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">Assignments</h1>
      <ul className="flex flex-col gap-3">
        {assignments.map((a) => (
          <li key={a.id} className="flex items-center justify-between rounded border p-4">
            <div>
              <Link href={`/student/assignments/${a.id}`} className="font-medium underline">
                {a.title}
              </Link>
              {a.due_at ? <p className="text-sm text-gray-500">Due {new Date(a.due_at).toLocaleDateString()}</p> : null}
            </div>
            <span className="text-sm">{statusFor(a.id, submissions)}</span>
          </li>
        ))}
      </ul>
    </main>
  );
}

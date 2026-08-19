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

  const statusClass: Record<Status, string> = {
    "Not submitted": "bg-warn-soft text-warn-text",
    Submitted: "bg-accent-soft text-accent-text",
    Graded: "bg-success-soft text-success-text",
  };

  return (
    <main className="p-8">
      <h1 className="mb-4 text-xl font-semibold">Assignments</h1>
      <div className="overflow-hidden rounded-lg border border-line bg-white">
        {assignments.map((a, i) => {
          const status = statusFor(a.id, submissions);
          return (
            <div
              key={a.id}
              className={`flex items-center justify-between px-4 py-3.5 ${i > 0 ? "border-t border-line" : ""}`}
            >
              <div>
                <Link href={`/student/assignments/${a.id}`} className="font-medium text-accent-text hover:underline">
                  {a.title}
                </Link>
                {a.due_at ? (
                  <p className="text-sm text-muted">Due {new Date(a.due_at).toLocaleDateString()}</p>
                ) : null}
              </div>
              <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${statusClass[status]}`}>
                {status}
              </span>
            </div>
          );
        })}
      </div>
    </main>
  );
}

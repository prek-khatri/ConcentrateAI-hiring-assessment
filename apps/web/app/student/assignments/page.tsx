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
      <table role="table" className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Title</th>
            <th className="py-2">Class</th>
            <th className="py-2">Due</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {assignments.map((a) => (
            <tr key={a.id} className="border-b">
              <td className="py-2">
                <Link href={`/student/assignments/${a.id}`} className="underline">
                  {a.title}
                </Link>
              </td>
              <td className="py-2">{a.className}</td>
              <td className="py-2">{a.due_at ? new Date(a.due_at).toLocaleDateString() : "—"}</td>
              <td className="py-2">{statusFor(a)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

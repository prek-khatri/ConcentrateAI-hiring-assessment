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
      <main className="p-6">
        <p role="alert">
          {error} <button onClick={load}>Retry</button>
        </p>
      </main>
    );
  }

  if (submissions === null) {
    return (
      <main className="p-6">
        <p>Loading submissions...</p>
      </main>
    );
  }

  if (submissions.length === 0) {
    return (
      <main className="p-6">
        <p>No submissions yet.</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">My Submissions</h1>
      <table role="table" className="w-full text-left text-sm">
        <thead>
          <tr className="border-b">
            <th className="py-2">Assignment</th>
            <th className="py-2">Class</th>
            <th className="py-2">Status</th>
          </tr>
        </thead>
        <tbody>
          {submissions.map((s) => (
            <tr key={s.id} className="border-b">
              <td className="py-2">
                <Link href={`/student/assignments/${s.assignment_id}`} className="underline">
                  {s.assignmentTitle}
                </Link>
              </td>
              <td className="py-2">{s.className}</td>
              <td className="py-2">{s.score !== null ? `Graded — ${s.score}/100` : "Submitted"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}

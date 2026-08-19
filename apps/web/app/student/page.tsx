"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { studentApi, type ClassSummary } from "@/lib/student-api";
import { ApiClientError } from "@/lib/api";

export default function StudentClassesPage() {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  function load() {
    setError(null);
    setClasses(null);
    studentApi
      .listClasses()
      .then((res) => setClasses(res.classes))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load classes."));
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

  if (classes === null) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted">Loading classes...</p>
      </main>
    );
  }

  if (classes.length === 0) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted">No classes yet.</p>
      </main>
    );
  }

  return (
    <main className="p-8">
      <h1 className="mb-4 text-xl font-semibold">My Classes</h1>
      <div className="flex flex-col gap-2.5">
        {classes.map((c) => (
          <Link
            key={c.id}
            href={`/student/classes/${c.id}`}
            className="flex items-center gap-3 rounded-lg border border-line bg-white px-4 py-3.5 transition-colors hover:bg-paper"
          >
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-accent-soft">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="oklch(0.5 0.14 255)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 8l10-5 10 5-10 5-10-5z" />
                <path d="M6 10.5v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5" />
              </svg>
            </div>
            <div>
              <p className="font-medium">{c.name}</p>
              <p className="text-sm text-muted">{c.description}</p>
              <p className="text-xs text-muted">Taught by {c.teacherName}</p>
            </div>
          </Link>
        ))}
      </div>
    </main>
  );
}

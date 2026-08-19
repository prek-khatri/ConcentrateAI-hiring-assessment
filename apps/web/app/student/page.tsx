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
      <main className="p-6">
        <p role="alert">
          {error} <button onClick={load}>Retry</button>
        </p>
      </main>
    );
  }

  if (classes === null) {
    return (
      <main className="p-6">
        <p>Loading classes...</p>
      </main>
    );
  }

  if (classes.length === 0) {
    return (
      <main className="p-6">
        <p>No classes yet.</p>
      </main>
    );
  }

  return (
    <main className="p-6">
      <h1 className="mb-4 text-xl font-semibold">My Classes</h1>
      <ul className="flex flex-col gap-3">
        {classes.map((c) => (
          <li key={c.id} className="rounded border p-4">
            <Link href={`/student/classes/${c.id}`} className="font-medium underline">
              {c.name}
            </Link>
            <p className="text-sm text-gray-600">{c.description}</p>
            <p className="text-sm text-gray-500">Taught by {c.teacherName}</p>
          </li>
        ))}
      </ul>
    </main>
  );
}

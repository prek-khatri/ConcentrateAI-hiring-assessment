"use client";

import { useEffect, useState, type FormEvent } from "react";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/lib/api";

type ClassSummary = {
  id: string;
  name: string;
  description: string | null;
};

export default function TeacherDashboard() {
  const [classes, setClasses] = useState<ClassSummary[] | null>(null);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    apiFetch<{ classes: ClassSummary[] }>("/api/teacher/classes")
      .then((data) => setClasses(data.classes))
      .catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load classes."));
  }, []);

  async function handleCreate(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const created = await apiFetch<ClassSummary>("/api/teacher/classes", {
        method: "POST",
        body: JSON.stringify({ name, description: description || null }),
      });
      setClasses((prev) => [created, ...(prev ?? [])]);
      setName("");
      setDescription("");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create the class.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-8">
      <div className="flex items-baseline justify-between">
        <h1 className="text-xl font-semibold">My classes</h1>
        {classes ? <p className="text-xs text-muted">{classes.length} total</p> : null}
      </div>

      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-2.5">
        {classes === null ? (
          <p className="text-sm text-muted">Loading...</p>
        ) : classes.length === 0 ? (
          <p className="text-sm text-muted">No classes yet — create your first one below.</p>
        ) : (
          classes.map((c) => (
            <Link
              key={c.id}
              href={`/teacher/classes/${c.id}`}
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
                {c.description ? <p className="text-sm text-muted">{c.description}</p> : null}
              </div>
            </Link>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3.5 rounded-lg border border-line bg-white p-5">
        <h2 className="text-sm font-semibold">Create a class</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3.5">
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted">Name</span>
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded-md border border-line px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm">
            <span className="text-xs font-medium text-muted">Description (optional)</span>
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded-md border border-line px-3 py-2 outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {pending ? "Creating..." : "Create class"}
          </button>
        </form>
      </section>
    </main>
  );
}

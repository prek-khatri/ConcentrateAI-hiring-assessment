"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/lib/api";

type ClassSummary = {
  id: string;
  name: string;
  description: string | null;
};

export default function TeacherDashboard() {
  const router = useRouter();
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

  async function handleSignOut() {
    await apiFetch("/auth/logout", { method: "POST" });
    router.push("/");
  }

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">My classes</h1>
        <button onClick={handleSignOut} className="text-sm underline">
          Sign out
        </button>
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-2">
        {classes === null ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : classes.length === 0 ? (
          <p className="text-sm text-gray-500">No classes yet — create your first one below.</p>
        ) : (
          classes.map((c) => (
            <Link
              key={c.id}
              href={`/teacher/classes/${c.id}`}
              className="rounded border px-4 py-3 hover:bg-gray-50"
            >
              <p className="font-medium">{c.name}</p>
              {c.description ? <p className="text-sm text-gray-500">{c.description}</p> : null}
            </Link>
          ))
        )}
      </section>

      <section className="flex flex-col gap-3 rounded border p-4">
        <h2 className="font-medium">Create a class</h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Name
            <input
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="rounded border px-3 py-2"
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            Description (optional)
            <input
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="rounded border px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          >
            {pending ? "Creating..." : "Create class"}
          </button>
        </form>
      </section>
    </main>
  );
}

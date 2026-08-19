"use client";

import { useEffect, useState, type FormEvent } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { apiFetch, ApiClientError } from "@/lib/api";

type ClassDetail = {
  class: { id: string; name: string; description: string | null };
  roster: { id: string; name: string; email: string }[];
  assignments: { id: string; title: string; published: boolean; due_at: string | null }[];
};

type Student = { id: string; name: string; email: string };

export default function ClassDetailPage() {
  const { id: classId } = useParams<{ id: string }>();
  const router = useRouter();

  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [allStudents, setAllStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingClass, setEditingClass] = useState(false);
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");

  async function loadDetail() {
    const data = await apiFetch<ClassDetail>(`/api/teacher/classes/${classId}`);
    setDetail(data);
  }

  useEffect(() => {
    loadDetail().catch((err) => setError(err instanceof ApiClientError ? err.message : "Failed to load class."));
    apiFetch<{ students: Student[] }>("/api/teacher/students")
      .then((data) => setAllStudents(data.students))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId]);

  async function handleAddStudent(e: FormEvent) {
    e.preventDefault();
    if (!selectedStudentId) return;
    setError(null);
    try {
      await apiFetch(`/api/teacher/classes/${classId}/students`, {
        method: "POST",
        body: JSON.stringify({ studentId: selectedStudentId }),
      });
      setSelectedStudentId("");
      await loadDetail();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not add student.");
    }
  }

  async function handleRemoveStudent(studentId: string) {
    setError(null);
    try {
      await apiFetch(`/api/teacher/classes/${classId}/students/${studentId}`, { method: "DELETE" });
      await loadDetail();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not remove student.");
    }
  }

  function startEditingClass() {
    setEditName(detail!.class.name);
    setEditDescription(detail!.class.description ?? "");
    setEditingClass(true);
  }

  async function handleSaveClass(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await apiFetch(`/api/teacher/classes/${classId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: editName, description: editDescription || null }),
      });
      setEditingClass(false);
      await loadDetail();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not update class.");
    }
  }

  async function handleDeleteClass() {
    if (!confirm("Delete this class? This also removes its assignments and submissions.")) return;
    setError(null);
    try {
      await apiFetch(`/api/teacher/classes/${classId}`, { method: "DELETE" });
      router.push("/teacher");
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not delete class.");
    }
  }

  async function handleCreateAssignment(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await apiFetch(`/api/teacher/classes/${classId}/assignments`, {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
          dueAt: dueAt ? new Date(dueAt).toISOString() : null,
          published: true,
        }),
      });
      setTitle("");
      setDescription("");
      setDueAt("");
      await loadDetail();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Could not create assignment.");
    } finally {
      setPending(false);
    }
  }

  if (!detail) {
    return <main className="mx-auto max-w-2xl p-8 text-sm text-muted">{error ?? "Loading..."}</main>;
  }

  const rosterIds = new Set(detail.roster.map((s) => s.id));
  const addableStudents = allStudents.filter((s) => !rosterIds.has(s.id));

  return (
    <main className="flex flex-col">
      <div className="px-8 pt-8">
        <Link href="/teacher" className="text-sm text-muted hover:text-ink">
          &larr; My classes
        </Link>

        {editingClass ? (
          <form onSubmit={handleSaveClass} className="mt-2 flex flex-col gap-2.5">
            <input
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="rounded-md border border-line px-3 py-2 text-xl font-semibold outline-none focus:border-accent"
            />
            <input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
            />
            <div className="flex gap-2">
              <button type="submit" className="rounded-md bg-accent px-3 py-2 text-sm font-semibold text-white">
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingClass(false)}
                className="rounded-md border border-line px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-2 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold">{detail.class.name}</h1>
              {detail.class.description ? <p className="text-sm text-muted">{detail.class.description}</p> : null}
            </div>
            <div className="flex gap-3 text-sm">
              <button onClick={startEditingClass} className="font-medium text-muted hover:text-ink">
                Edit
              </button>
              <button onClick={handleDeleteClass} className="font-medium text-danger hover:opacity-80">
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <p role="alert" className="mx-8 mt-4 rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <div className="flex flex-1 gap-6 p-8">
        <section className="flex min-w-0 flex-1 flex-col gap-3.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Assignments</h2>
            <p className="text-xs text-muted">{detail.assignments.length} total</p>
          </div>

          {detail.assignments.length === 0 ? (
            <p className="text-sm text-muted">No assignments yet.</p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
              {detail.assignments.map((a) => (
                <Link
                  key={a.id}
                  href={`/teacher/assignments/${a.id}`}
                  className="flex items-center justify-between px-4 py-3.5 text-sm transition-colors hover:bg-paper"
                >
                  <span className="font-medium">{a.title}</span>
                  <span
                    className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                      a.published ? "bg-success-soft text-success-text" : "bg-ink/5 text-muted"
                    }`}
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${a.published ? "bg-success" : "bg-muted"}`} />
                    {a.published ? "Published" : "Draft"}
                  </span>
                </Link>
              ))}
            </div>
          )}

          <form
            onSubmit={handleCreateAssignment}
            className="mt-1 flex flex-col gap-3.5 rounded-lg border border-line bg-white p-5"
          >
            <h3 className="text-sm font-semibold">New assignment</h3>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium text-muted">Title</span>
              <input
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
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
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium text-muted">Due date (optional)</span>
              <input
                type="date"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="rounded-md border border-line px-3 py-2 outline-none focus:border-accent"
              />
            </label>
            <button
              type="submit"
              disabled={pending}
              className="self-start rounded-md bg-accent px-4 py-2 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Publishing..." : "Publish assignment"}
            </button>
          </form>
        </section>

        <section className="flex w-[300px] flex-shrink-0 flex-col gap-3.5">
          <div className="flex items-baseline justify-between">
            <h2 className="text-base font-semibold">Roster</h2>
            <p className="text-xs text-muted">{detail.roster.length} students</p>
          </div>

          {detail.roster.length === 0 ? (
            <p className="text-sm text-muted">No students yet.</p>
          ) : (
            <div className="divide-y divide-line overflow-hidden rounded-lg border border-line bg-white">
              {detail.roster.map((s) => (
                <div key={s.id} className="flex items-center gap-2.5 px-3.5 py-3 text-sm">
                  <div className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-accent-soft text-[11px] font-semibold text-accent-text">
                    {s.name
                      .split(" ")
                      .map((p) => p[0])
                      .join("")
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{s.name}</p>
                    <p className="truncate text-xs text-muted">{s.email}</p>
                  </div>
                  <button
                    onClick={() => handleRemoveStudent(s.id)}
                    className="flex-shrink-0 text-xs font-medium text-danger hover:opacity-80"
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          )}

          <form onSubmit={handleAddStudent} className="flex flex-col gap-2">
            <select
              value={selectedStudentId}
              onChange={(e) => setSelectedStudentId(e.target.value)}
              className="rounded-md border border-line px-3 py-2 text-sm outline-none focus:border-accent"
            >
              <option value="">Select a student to add...</option>
              {addableStudents.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.email})
                </option>
              ))}
            </select>
            <button
              type="submit"
              disabled={!selectedStudentId}
              className="rounded-md border border-dashed border-line py-2 text-sm font-medium text-muted transition-colors hover:bg-white disabled:opacity-50"
            >
              Add
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}

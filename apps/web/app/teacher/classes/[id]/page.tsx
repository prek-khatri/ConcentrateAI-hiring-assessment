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
    if (!detail) return;
    setEditName(detail.class.name);
    setEditDescription(detail.class.description ?? "");
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
    return <main className="mx-auto max-w-2xl p-6 text-sm text-gray-500">{error ?? "Loading..."}</main>;
  }

  const rosterIds = new Set(detail.roster.map((s) => s.id));
  const addableStudents = allStudents.filter((s) => !rosterIds.has(s.id));

  return (
    <main className="mx-auto flex max-w-2xl flex-col gap-8 p-6">
      <div>
        <Link href="/teacher" className="text-sm underline">
          &larr; My classes
        </Link>

        {editingClass ? (
          <form onSubmit={handleSaveClass} className="mt-2 flex flex-col gap-2">
            <input
              required
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              className="rounded border px-3 py-2 text-xl font-semibold"
            />
            <input
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
              placeholder="Description (optional)"
              className="rounded border px-3 py-2 text-sm"
            />
            <div className="flex gap-2">
              <button type="submit" className="rounded bg-black px-3 py-2 text-sm text-white">
                Save
              </button>
              <button
                type="button"
                onClick={() => setEditingClass(false)}
                className="rounded border px-3 py-2 text-sm"
              >
                Cancel
              </button>
            </div>
          </form>
        ) : (
          <div className="mt-2 flex items-start justify-between">
            <div>
              <h1 className="text-xl font-semibold">{detail.class.name}</h1>
              {detail.class.description ? (
                <p className="text-sm text-gray-500">{detail.class.description}</p>
              ) : null}
            </div>
            <div className="flex gap-3 text-sm">
              <button onClick={startEditingClass} className="underline">
                Edit
              </button>
              <button onClick={handleDeleteClass} className="text-red-600 underline">
                Delete
              </button>
            </div>
          </div>
        )}
      </div>

      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3 rounded border p-4">
        <h2 className="font-medium">Roster</h2>
        {detail.roster.length === 0 ? (
          <p className="text-sm text-gray-500">No students yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.roster.map((s) => (
              <li key={s.id} className="flex items-center justify-between text-sm">
                <span>
                  {s.name} <span className="text-gray-500">({s.email})</span>
                </span>
                <button onClick={() => handleRemoveStudent(s.id)} className="text-red-600 underline">
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleAddStudent} className="flex gap-2">
          <select
            value={selectedStudentId}
            onChange={(e) => setSelectedStudentId(e.target.value)}
            className="flex-1 rounded border px-3 py-2 text-sm"
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
            className="rounded bg-black px-3 py-2 text-sm text-white disabled:opacity-50"
          >
            Add
          </button>
        </form>
      </section>

      <section className="flex flex-col gap-3 rounded border p-4">
        <h2 className="font-medium">Assignments</h2>
        {detail.assignments.length === 0 ? (
          <p className="text-sm text-gray-500">No assignments yet.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {detail.assignments.map((a) => (
              <Link
                key={a.id}
                href={`/teacher/assignments/${a.id}`}
                className="flex items-center justify-between rounded border px-3 py-2 text-sm hover:bg-gray-50"
              >
                <span>{a.title}</span>
                <span className="text-gray-500">{a.published ? "Published" : "Draft"}</span>
              </Link>
            ))}
          </ul>
        )}

        <form onSubmit={handleCreateAssignment} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1 text-sm">
            Title
            <input
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
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
          <label className="flex flex-col gap-1 text-sm">
            Due date (optional)
            <input
              type="date"
              value={dueAt}
              onChange={(e) => setDueAt(e.target.value)}
              className="rounded border px-3 py-2"
            />
          </label>
          <button
            type="submit"
            disabled={pending}
            className="rounded bg-black px-3 py-2 text-white disabled:opacity-50"
          >
            {pending ? "Publishing..." : "Publish assignment"}
          </button>
        </form>
      </section>
    </main>
  );
}

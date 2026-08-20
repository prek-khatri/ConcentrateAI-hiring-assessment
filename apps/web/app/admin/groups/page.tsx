"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiClientError } from "@/lib/api";

type Role = "admin" | "teacher" | "student";
type User = { id: string; email: string; name: string; role: Role; is_suspended: boolean };
type Member = { id: string; name: string; email: string };
type Group = { id: string; name: string; members: Member[] };

export default function AdminGroupsPage() {
  const [teachers, setTeachers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newGroup, setNewGroup] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [memberPick, setMemberPick] = useState<Record<string, string>>({});

  async function load() {
    const [usersRes, groupsRes] = await Promise.all([
      apiFetch<{ users: User[] }>("/api/admin/users"),
      apiFetch<{ groups: Array<{ id: string; name: string }> }>("/api/admin/groups"),
    ]);
    const detailed = await Promise.all(groupsRes.groups.map((g) => apiFetch<Group>(`/api/admin/groups/${g.id}`)));
    setTeachers(usersRes.users.filter((u) => u.role === "teacher"));
    setGroups(detailed);
  }

  async function run(action: () => Promise<void>) {
    setError(null);
    try {
      await action();
      await load();
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    }
  }

  useEffect(() => {
    run(async () => {}).finally(() => setLoading(false));
  }, []);

  function createGroup(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      await apiFetch("/api/admin/groups", { method: "POST", body: JSON.stringify({ name: newGroup }) });
      setNewGroup("");
    });
  }

  function addMember(groupId: string) {
    const teacherId = memberPick[groupId] ?? "";
    if (!teacherId) {
      return;
    }
    run(async () => {
      await apiFetch(`/api/admin/groups/${groupId}/members`, {
        method: "POST",
        body: JSON.stringify({ teacherId }),
      });
      setMemberPick({ ...memberPick, [groupId]: "" });
    });
  }

  if (loading) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 p-8">
      <h1 className="text-2xl font-semibold">Teacher groups</h1>
      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3.5">
        <form
          onSubmit={createGroup}
          className="flex items-end gap-2.5 rounded-lg border border-line bg-white p-4"
        >
          <label className="flex flex-1 flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted">Group name</span>
            <input
              aria-label="New group name"
              required
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              className="w-full rounded-md border border-line px-2.5 py-1.5 outline-none focus:border-accent"
            />
          </label>
          <button
            type="submit"
            className="shrink-0 rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Add group
          </button>
        </form>

        <ul className="flex flex-col gap-3">
          {groups.map((g) => (
            <li key={g.id} className="rounded-lg border border-line bg-white p-4">
              <div className="flex items-center gap-2.5">
                <input
                  aria-label={`Group name for ${g.name}`}
                  value={drafts[g.id] ?? g.name}
                  onChange={(e) => setDrafts({ ...drafts, [g.id]: e.target.value })}
                  className="rounded-md border border-line px-2.5 py-1.5 text-sm font-medium outline-none focus:border-accent"
                />
                <button
                  onClick={() =>
                    run(async () => {
                      await apiFetch(`/api/admin/groups/${g.id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ name: drafts[g.id] ?? g.name }),
                      });
                    })
                  }
                  className="text-xs font-medium text-accent-text"
                >
                  Save name
                </button>
                <button
                  onClick={() =>
                    run(async () => {
                      await apiFetch(`/api/admin/groups/${g.id}`, { method: "DELETE" });
                    })
                  }
                  className="text-xs font-medium text-danger"
                >
                  Delete group
                </button>
              </div>

              <ul className="mt-3 flex flex-col gap-1.5">
                {g.members.map((m) => (
                  <li key={m.id} className="flex items-center justify-between text-sm">
                    {m.name}
                    <button
                      aria-label={`Remove ${m.name} from ${g.name}`}
                      onClick={() =>
                        run(async () => {
                          await apiFetch(`/api/admin/groups/${g.id}/members/${m.id}`, { method: "DELETE" });
                        })
                      }
                      className="text-xs font-medium text-danger"
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-3 flex items-center gap-2">
                <select
                  aria-label={`Add teacher to ${g.name}`}
                  value={memberPick[g.id] ?? ""}
                  onChange={(e) => setMemberPick({ ...memberPick, [g.id]: e.target.value })}
                  className="rounded-md border border-line px-2.5 py-1.5 text-sm"
                >
                  <option value="">Select teacher…</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => addMember(g.id)} className="text-xs font-medium text-accent-text">
                  Add member
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

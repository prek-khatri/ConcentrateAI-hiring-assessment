"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiClientError } from "@/lib/api";

type Role = "admin" | "teacher" | "student";
type User = { id: string; email: string; name: string; role: Role; is_suspended: boolean };
type Member = { id: string; name: string; email: string };
type Group = { id: string; name: string; members: Member[] };

const ROLES: Role[] = ["admin", "teacher", "student"];
const EMPTY_NEW_USER = { email: "", name: "", role: "student" as Role, password: "" };

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState(EMPTY_NEW_USER);
  const [newGroup, setNewGroup] = useState("");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [memberPick, setMemberPick] = useState<Record<string, string>>({});

  async function load() {
    const [usersRes, groupsRes] = await Promise.all([
      apiFetch<{ users: User[] }>("/api/admin/users"),
      apiFetch<{ groups: Array<{ id: string; name: string }> }>("/api/admin/groups"),
    ]);
    const detailed = await Promise.all(groupsRes.groups.map((g) => apiFetch<Group>(`/api/admin/groups/${g.id}`)));
    setUsers(usersRes.users);
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

  function createUser(e: FormEvent) {
    e.preventDefault();
    run(async () => {
      await apiFetch("/api/admin/users", { method: "POST", body: JSON.stringify(newUser) });
      setNewUser(EMPTY_NEW_USER);
    });
  }

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
      <main className="p-6">
        <p>Loading…</p>
      </main>
    );
  }

  const teachers = users.filter((u) => u.role === "teacher");

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-8 p-6">
      <h1 className="text-2xl font-semibold">Admin</h1>
      {error ? (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Users</h2>

        <form onSubmit={createUser} className="flex flex-wrap items-end gap-2">
          <label className="flex flex-col text-sm">
            Name
            <input
              aria-label="New user name"
              required
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="rounded border px-2 py-1"
            />
          </label>
          <label className="flex flex-col text-sm">
            Email
            <input
              aria-label="New user email"
              type="email"
              required
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="rounded border px-2 py-1"
            />
          </label>
          <label className="flex flex-col text-sm">
            Password
            <input
              aria-label="New user password"
              type="password"
              required
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="rounded border px-2 py-1"
            />
          </label>
          <label className="flex flex-col text-sm">
            Role
            <select
              aria-label="New user role"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
              className="rounded border px-2 py-1"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="rounded bg-black px-3 py-1 text-white">
            Add user
          </button>
        </form>

        <table className="w-full text-left text-sm">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td>{u.name}</td>
                <td>{u.email}</td>
                <td>
                  <select
                    aria-label={`Role for ${u.email}`}
                    value={u.role}
                    onChange={(e) =>
                      run(async () => {
                        await apiFetch(`/api/admin/users/${u.id}`, {
                          method: "PATCH",
                          body: JSON.stringify({ role: e.target.value }),
                        });
                      })
                    }
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r}>
                        {r}
                      </option>
                    ))}
                  </select>
                </td>
                <td>{u.is_suspended ? "Suspended" : "Active"}</td>
                <td className="flex gap-2">
                  <button
                    onClick={() =>
                      run(async () => {
                        await apiFetch(`/api/admin/users/${u.id}/${u.is_suspended ? "unsuspend" : "suspend"}`, {
                          method: "POST",
                        });
                      })
                    }
                  >
                    {u.is_suspended ? "Unsuspend" : "Suspend"}
                  </button>
                  <button
                    onClick={() =>
                      run(async () => {
                        await apiFetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
                      })
                    }
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-medium">Teacher groups</h2>

        <form onSubmit={createGroup} className="flex items-end gap-2">
          <label className="flex flex-col text-sm">
            Group name
            <input
              aria-label="New group name"
              required
              value={newGroup}
              onChange={(e) => setNewGroup(e.target.value)}
              className="rounded border px-2 py-1"
            />
          </label>
          <button type="submit" className="rounded bg-black px-3 py-1 text-white">
            Add group
          </button>
        </form>

        <ul className="flex flex-col gap-4">
          {groups.map((g) => (
            <li key={g.id} className="rounded border p-3">
              <div className="flex items-center gap-2">
                <input
                  aria-label={`Group name for ${g.name}`}
                  value={drafts[g.id] ?? g.name}
                  onChange={(e) => setDrafts({ ...drafts, [g.id]: e.target.value })}
                  className="rounded border px-2 py-1"
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
                >
                  Save name
                </button>
                <button
                  onClick={() =>
                    run(async () => {
                      await apiFetch(`/api/admin/groups/${g.id}`, { method: "DELETE" });
                    })
                  }
                >
                  Delete group
                </button>
              </div>

              <ul className="mt-2 flex flex-col gap-1">
                {g.members.map((m) => (
                  <li key={m.id} className="flex items-center gap-2 text-sm">
                    {m.name}
                    <button
                      aria-label={`Remove ${m.name} from ${g.name}`}
                      onClick={() =>
                        run(async () => {
                          await apiFetch(`/api/admin/groups/${g.id}/members/${m.id}`, { method: "DELETE" });
                        })
                      }
                    >
                      Remove
                    </button>
                  </li>
                ))}
              </ul>

              <div className="mt-2 flex items-center gap-2">
                <select
                  aria-label={`Add teacher to ${g.name}`}
                  value={memberPick[g.id] ?? ""}
                  onChange={(e) => setMemberPick({ ...memberPick, [g.id]: e.target.value })}
                >
                  <option value="">Select teacher…</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.name}
                    </option>
                  ))}
                </select>
                <button onClick={() => addMember(g.id)}>Add member</button>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}

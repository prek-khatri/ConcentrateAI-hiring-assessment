"use client";

import { useEffect, useState, type FormEvent } from "react";
import { apiFetch, ApiClientError } from "@/lib/api";

type Role = "admin" | "teacher" | "student";
type User = { id: string; email: string; name: string; role: Role; is_suspended: boolean };

const ROLES: Role[] = ["admin", "teacher", "student"];
const EMPTY_NEW_USER = { email: "", name: "", role: "student" as Role, password: "" };

export default function AdminPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [newUser, setNewUser] = useState(EMPTY_NEW_USER);

  async function load() {
    const usersRes = await apiFetch<{ users: User[] }>("/api/admin/users");
    setUsers(usersRes.users);
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

  if (loading) {
    return (
      <main className="p-8">
        <p className="text-sm text-muted">Loading…</p>
      </main>
    );
  }

  const roleBadgeClass: Record<Role, string> = {
    admin: "bg-accent-soft text-accent-text",
    teacher: "bg-accent-soft text-accent-text",
    student: "bg-success-soft text-success-text",
  };

  return (
    <main className="mx-auto flex max-w-4xl flex-col gap-10 p-8">
      <h1 className="text-2xl font-semibold">Admin</h1>
      {error ? (
        <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
          {error}
        </p>
      ) : null}

      <section className="flex flex-col gap-3.5">
        <h2 className="text-base font-semibold">Users</h2>

        <form
          onSubmit={createUser}
          className="flex flex-wrap items-end gap-2.5 rounded-lg border border-line bg-white p-4"
        >
          <label className="flex flex-1 basis-40 flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted">Name</span>
            <input
              aria-label="New user name"
              required
              value={newUser.name}
              onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
              className="w-full rounded-md border border-line px-2.5 py-1.5 outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-1 basis-40 flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted">Email</span>
            <input
              aria-label="New user email"
              type="email"
              required
              value={newUser.email}
              onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
              className="w-full rounded-md border border-line px-2.5 py-1.5 outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-1 basis-40 flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted">Password</span>
            <input
              aria-label="New user password"
              type="password"
              required
              value={newUser.password}
              onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
              className="w-full rounded-md border border-line px-2.5 py-1.5 outline-none focus:border-accent"
            />
          </label>
          <label className="flex flex-1 basis-32 flex-col gap-1 text-sm">
            <span className="text-xs font-medium text-muted">Role</span>
            <select
              aria-label="New user role"
              value={newUser.role}
              onChange={(e) => setNewUser({ ...newUser, role: e.target.value as Role })}
              className="w-full rounded-md border border-line px-2.5 py-1.5"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button
            type="submit"
            className="shrink-0 rounded-md bg-accent px-4 py-1.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Add user
          </button>
        </form>

        <div className="overflow-hidden rounded-lg border border-line bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-line text-xs font-semibold uppercase tracking-wide text-muted">
                <th className="px-4 py-2.5">Name</th>
                <th className="px-4 py-2.5">Email</th>
                <th className="px-4 py-2.5">Role</th>
                <th className="px-4 py-2.5">Status</th>
                <th className="px-4 py-2.5">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u, i) => (
                <tr key={u.id} className={i > 0 ? "border-t border-line" : ""}>
                  <td className="px-4 py-4 font-medium">{u.name}</td>
                  <td className="px-4 py-4 font-mono text-xs text-muted">{u.email}</td>
                  <td className="px-4 py-4">
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
                      className={`rounded-full border-0 px-2.5 py-0.5 text-xs font-semibold capitalize ${roleBadgeClass[u.role]}`}
                    >
                      {ROLES.map((r) => (
                        <option key={r} value={r}>
                          {r}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-4">
                    <span
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                        u.is_suspended ? "bg-danger-soft text-danger-text" : "bg-success-soft text-success-text"
                      }`}
                    >
                      {u.is_suspended ? "Suspended" : "Active"}
                    </span>
                  </td>
                  <td className="flex gap-3 px-4 py-4 text-xs font-medium">
                    <button
                      onClick={() =>
                        run(async () => {
                          await apiFetch(`/api/admin/users/${u.id}/${u.is_suspended ? "unsuspend" : "suspend"}`, {
                            method: "POST",
                          });
                        })
                      }
                      className={u.is_suspended ? "text-accent-text" : "text-muted hover:text-ink"}
                    >
                      {u.is_suspended ? "Unsuspend" : "Suspend"}
                    </button>
                    <button
                      onClick={() =>
                        run(async () => {
                          await apiFetch(`/api/admin/users/${u.id}`, { method: "DELETE" });
                        })
                      }
                      className="text-danger hover:opacity-80"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}

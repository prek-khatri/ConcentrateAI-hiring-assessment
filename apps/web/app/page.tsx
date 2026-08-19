"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { apiFetch, ApiClientError } from "@/lib/api";
import { GoogleIcon } from "@/components/GoogleIcon";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type LoginResponse = { id: string; name: string; email: string; role: "admin" | "teacher" | "student" };

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      const user = await apiFetch<LoginResponse>("/auth/login", {
        method: "POST",
        body: JSON.stringify({ email, password }),
      });
      router.push(`/${user.role}`);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong. Try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="flex min-h-screen">
      <div className="hidden w-[420px] flex-shrink-0 flex-col justify-between bg-sidebar p-12 lg:flex">
        <div className="flex items-center gap-2.5">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="oklch(0.75 0.1 255)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2 8l10-5 10 5-10 5-10-5z" />
            <path d="M6 10.5v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5" />
          </svg>
          <span className="text-[15px] font-semibold text-white">Concentrate</span>
        </div>
        <div className="flex flex-col gap-3.5">
          <p className="max-w-[340px] text-[22px] font-semibold leading-snug text-white">
            Classes, assignments, and grading — in one place.
          </p>
          <p className="max-w-[340px] text-sm leading-relaxed text-sidebar-text">
            Built for admins, teachers, and students. Sign in with your school account to continue.
          </p>
        </div>
        <p className="font-mono text-xs text-sidebar-muted">v1.0</p>
      </div>

      <div className="flex flex-1 items-center justify-center p-6">
        <div className="flex w-full max-w-sm flex-col gap-5">
          <div className="flex flex-col gap-1.5">
            <h1 className="text-xl font-semibold">Sign in</h1>
            <p className="text-sm text-muted">Use your school email and password.</p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-3.5">
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium text-muted">Email</span>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="rounded-md border border-line px-3 py-2.5 outline-none focus:border-accent"
              />
            </label>
            <label className="flex flex-col gap-1.5 text-sm">
              <span className="text-xs font-medium text-muted">Password</span>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="rounded-md border border-line px-3 py-2.5 outline-none focus:border-accent"
              />
            </label>

            {error ? (
              <p role="alert" className="rounded-md bg-danger-soft px-3 py-2 text-sm text-danger">
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="rounded-md bg-accent px-3 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              {pending ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="flex items-center gap-2.5 text-xs text-muted">
            <div className="h-px flex-1 bg-line" />
            or
            <div className="h-px flex-1 bg-line" />
          </div>

          <a
            href={`${API_URL}/auth/google`}
            className="flex items-center justify-center gap-2.5 rounded-md border border-line bg-white px-3 py-2.5 text-sm font-medium text-ink shadow-sm hover:bg-paper"
          >
            <GoogleIcon />
            Sign in with Google
          </a>
        </div>
      </div>
    </main>
  );
}

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, type CurrentUser } from "@/lib/auth-api";
import { ApiClientError } from "@/lib/api";

export function TopBar() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  useEffect(() => {
    authApi.me().then(setUser).catch(() => setUser(null));
  }, []);

  async function handleLogout() {
    setLogoutError(null);
    try {
      await authApi.logout();
    } catch (err) {
      // UNAUTHORIZED means there was nothing to clear server-side — safe to proceed.
      // Any other failure means the session cookie may still be valid; don't pretend
      // we logged out, or a still-active session could be reused from this browser.
      if (err instanceof ApiClientError && err.code === "UNAUTHORIZED") {
        router.push("/");
        return;
      }
      setLogoutError("Couldn't sign out — check your connection and try again.");
      return;
    }
    router.push("/");
  }

  return (
    <header className="relative flex items-center justify-between bg-sidebar px-6 py-3.5">
      <div className="flex items-center gap-2.5">
        <svg
          width="19"
          height="19"
          viewBox="0 0 24 24"
          fill="none"
          stroke="oklch(0.75 0.1 255)"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M2 8l10-5 10 5-10 5-10-5z" />
          <path d="M6 10.5v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5" />
        </svg>
        <span className="font-semibold text-white">Concentrate</span>
      </div>
      <div className="flex items-center gap-3 text-sm">
        {user ? (
          <>
            <span className="text-sidebar-text">{user.name}</span>
            <span className="rounded-full bg-accent-soft px-2.5 py-0.5 text-xs font-semibold capitalize text-accent-text">
              {user.role}
            </span>
          </>
        ) : null}
        <button
          onClick={handleLogout}
          className="rounded-md border border-white/15 px-3 py-1.5 text-sidebar-text transition-colors hover:bg-white/10 hover:text-white"
        >
          Sign out
        </button>
      </div>
      {logoutError ? (
        <p role="alert" className="absolute right-6 top-14 rounded-md bg-white px-3 py-2 text-sm text-danger shadow-md">
          {logoutError}
        </p>
      ) : null}
    </header>
  );
}

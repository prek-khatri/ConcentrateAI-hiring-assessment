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
    <header className="relative flex items-center justify-between border-b px-6 py-3">
      <span className="font-medium">Concentrate School Portal</span>
      <div className="flex items-center gap-3 text-sm">
        {user ? (
          <>
            <span>{user.name}</span>
            <span className="rounded bg-gray-100 px-2 py-0.5 capitalize text-gray-600">{user.role}</span>
          </>
        ) : null}
        <button onClick={handleLogout} className="rounded border px-3 py-1 hover:bg-gray-100">
          Sign out
        </button>
      </div>
      {logoutError ? (
        <p role="alert" className="absolute right-6 top-14 text-sm text-red-600">
          {logoutError}
        </p>
      ) : null}
    </header>
  );
}

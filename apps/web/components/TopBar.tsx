"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { authApi, type CurrentUser } from "@/lib/auth-api";

export function TopBar() {
  const router = useRouter();
  const [user, setUser] = useState<CurrentUser | null>(null);

  useEffect(() => {
    authApi.me().then(setUser).catch(() => setUser(null));
  }, []);

  async function handleLogout() {
    await authApi.logout();
    router.push("/");
  }

  return (
    <header className="flex items-center justify-between border-b px-6 py-3">
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
    </header>
  );
}

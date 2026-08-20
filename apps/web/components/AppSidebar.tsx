"use client";

import { useEffect, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authApi, type CurrentUser } from "@/lib/auth-api";
import { ApiClientError } from "@/lib/api";

export type SidebarNavItem = {
  key: string;
  label: string;
  href: string;
  active: boolean;
};

function initials(name: string) {
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]!.toUpperCase())
    .join("");
}

export function AppSidebar({
  ariaLabel,
  sectionLabel,
  items,
  footer,
}: {
  ariaLabel: string;
  sectionLabel: string;
  items: SidebarNavItem[];
  footer?: ReactNode;
}) {
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
      if (err instanceof ApiClientError && err.code === "UNAUTHORIZED") {
        router.push("/");
        return;
      }
      setLogoutError("Couldn't sign out.");
      return;
    }
    router.push("/");
  }

  return (
    <aside className="flex w-60 shrink-0 flex-col bg-sidebar">
      <div className="flex items-center gap-2.5 px-5 py-4">
        <svg width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="oklch(0.75 0.1 255)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M2 8l10-5 10 5-10 5-10-5z" />
          <path d="M6 10.5v5c0 1.5 2.5 3 6 3s6-1.5 6-3v-5" />
        </svg>
        <span className="font-semibold text-white">Concentrate</span>
      </div>

      <nav aria-label={ariaLabel} className="flex flex-1 flex-col gap-1 px-3 pt-2">
        <p className="px-2.5 pb-1 text-[10.5px] font-semibold uppercase tracking-wider text-sidebar-muted">{sectionLabel}</p>
        {items.map((item) => (
          <Link
            key={item.key}
            href={item.href}
            aria-current={item.active ? "page" : undefined}
            className={`flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm transition-colors ${
              item.active ? "bg-sidebar-active font-medium text-white" : "text-sidebar-text hover:bg-sidebar-active/60 hover:text-white"
            }`}
          >
            <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${item.active ? "bg-accent" : "bg-sidebar-muted"}`} />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
        {footer}
      </nav>

      <div className="flex items-center gap-2.5 border-t border-white/10 px-4 py-3.5">
        <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-[11px] font-semibold text-white">
          {user ? initials(user.name) : ""}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium text-white">{user?.name}</p>
          <p className="truncate text-[11px] capitalize text-sidebar-muted">{user?.role}</p>
        </div>
        <button
          onClick={handleLogout}
          aria-label="Sign out"
          title="Sign out"
          className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md text-sidebar-muted transition-colors hover:bg-white/10 hover:text-white"
        >
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
            <path d="M16 17l5-5-5-5" />
            <path d="M21 12H9" />
          </svg>
        </button>
      </div>
      {logoutError ? (
        <p role="alert" className="px-4 pb-3 text-[11px] text-danger">
          {logoutError}
        </p>
      ) : null}
    </aside>
  );
}

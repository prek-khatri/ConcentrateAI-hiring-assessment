"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { apiFetch } from "@/lib/api";
import { AppSidebar, type SidebarNavItem } from "./AppSidebar";

type ClassSummary = { id: string; name: string };

export function TeacherSidebar() {
  const pathname = usePathname();
  const [classes, setClasses] = useState<ClassSummary[]>([]);

  useEffect(() => {
    apiFetch<{ classes: ClassSummary[] }>("/api/teacher/classes")
      .then((data) => setClasses(data.classes))
      .catch(() => {});
  }, []);

  const items: SidebarNavItem[] = classes.map((c) => ({
    key: c.id,
    label: c.name,
    href: `/teacher/classes/${c.id}`,
    active: pathname === `/teacher/classes/${c.id}`,
  }));

  return (
    <AppSidebar
      ariaLabel="Teacher navigation"
      sectionLabel="My classes"
      items={items}
      footer={
        <Link
          href="/teacher"
          className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-sidebar-muted transition-colors hover:bg-sidebar-active/60 hover:text-white"
        >
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New class
        </Link>
      }
    />
  );
}

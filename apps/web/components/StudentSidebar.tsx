"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { label: "My Classes", href: "/student" },
  { label: "Assignments", href: "/student/assignments" },
  { label: "Submissions", href: "/student/submissions" },
];

export function StudentSidebar() {
  const pathname = usePathname();

  return (
    <nav aria-label="Student navigation" className="flex w-56 shrink-0 flex-col gap-1 border-r p-4">
      {NAV_ITEMS.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={`rounded px-3 py-2 text-sm ${
              active ? "bg-black text-white" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

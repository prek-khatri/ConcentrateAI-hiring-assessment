"use client";

import { usePathname } from "next/navigation";
import { AppSidebar, type SidebarNavItem } from "./AppSidebar";

const NAV_ITEMS = [
  {
    key: "classes",
    label: "My classes",
    href: "/student",
    matches: (pathname: string) => pathname === "/student" || pathname.startsWith("/student/classes/"),
  },
  {
    key: "assignments",
    label: "Assignments",
    href: "/student/assignments",
    matches: (pathname: string) => pathname.startsWith("/student/assignments"),
  },
  {
    key: "submissions",
    label: "Submissions",
    href: "/student/submissions",
    matches: (pathname: string) => pathname === "/student/submissions",
  },
];

export function StudentSidebar() {
  const pathname = usePathname();

  const items: SidebarNavItem[] = NAV_ITEMS.map((item) => ({
    key: item.key,
    label: item.label,
    href: item.href,
    active: item.matches(pathname),
  }));

  return <AppSidebar ariaLabel="Student navigation" sectionLabel="Student" items={items} />;
}

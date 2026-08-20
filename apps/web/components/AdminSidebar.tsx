"use client";

import { usePathname } from "next/navigation";
import { AppSidebar, type SidebarNavItem } from "./AppSidebar";

export function AdminSidebar() {
  const pathname = usePathname();

  const items: SidebarNavItem[] = [
    { key: "users", label: "Users", href: "/admin", active: pathname === "/admin" },
    { key: "teacher-groups", label: "Teacher groups", href: "/admin/groups", active: pathname === "/admin/groups" },
  ];

  return <AppSidebar ariaLabel="Admin navigation" sectionLabel="Admin" items={items} />;
}

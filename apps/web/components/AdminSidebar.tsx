"use client";

import { usePathname } from "next/navigation";
import { AppSidebar, type SidebarNavItem } from "./AppSidebar";

export function AdminSidebar() {
  const pathname = usePathname();
  const onAdmin = pathname === "/admin";

  const items: SidebarNavItem[] = [
    { key: "users", label: "Users", href: "/admin#users", active: onAdmin },
    { key: "teacher-groups", label: "Teacher groups", href: "/admin#teacher-groups", active: false },
  ];

  return <AppSidebar ariaLabel="Admin navigation" sectionLabel="Admin" items={items} />;
}

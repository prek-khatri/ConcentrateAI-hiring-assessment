import type { ReactNode } from "react";
import { TeacherSidebar } from "@/components/TeacherSidebar";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <TeacherSidebar />
      <div className="flex-1">{children}</div>
    </div>
  );
}

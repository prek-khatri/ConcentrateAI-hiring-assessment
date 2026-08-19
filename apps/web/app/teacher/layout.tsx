import type { ReactNode } from "react";
import { TeacherSidebar } from "@/components/TeacherSidebar";
import { TopBar } from "@/components/TopBar";

export default function TeacherLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <div className="flex flex-1">
        <TeacherSidebar />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

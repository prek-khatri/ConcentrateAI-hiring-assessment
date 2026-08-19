import type { ReactNode } from "react";
import { StudentSidebar } from "@/components/StudentSidebar";
import { TopBar } from "@/components/TopBar";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <TopBar />
      <div className="flex flex-1">
        <StudentSidebar />
        <div className="flex-1">{children}</div>
      </div>
    </div>
  );
}

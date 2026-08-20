import type { ReactNode } from "react";
import { StudentSidebar } from "@/components/StudentSidebar";

export default function StudentLayout({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen">
      <StudentSidebar />
      <div className="flex-1">{children}</div>
    </div>
  );
}

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

vi.mock("next/navigation", () => ({ usePathname: () => "/student/submissions" }));

import { StudentSidebar } from "./StudentSidebar";

describe("StudentSidebar", () => {
  it("renders all nav items and marks the active one", () => {
    render(<StudentSidebar />);
    expect(screen.getByRole("link", { name: /my classes/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /assignments/i })).toBeInTheDocument();
    const submissionsLink = screen.getByRole("link", { name: /submissions/i });
    expect(submissionsLink).toHaveAttribute("aria-current", "page");
  });
});

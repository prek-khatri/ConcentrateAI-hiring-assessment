import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));

import { TeacherSidebar } from "./TeacherSidebar";

describe("TeacherSidebar", () => {
  it("marks My classes active on the dashboard", () => {
    pathnameMock.mockReturnValue("/teacher");
    render(<TeacherSidebar />);
    expect(screen.getByRole("link", { name: /my classes/i })).toHaveAttribute("aria-current", "page");
  });

  it("marks My classes active while drilled into a class or assignment", () => {
    pathnameMock.mockReturnValue("/teacher/classes/abc-123");
    render(<TeacherSidebar />);
    expect(screen.getByRole("link", { name: /my classes/i })).toHaveAttribute("aria-current", "page");
  });

  it("does not mark it active outside the teacher section", () => {
    pathnameMock.mockReturnValue("/student");
    render(<TeacherSidebar />);
    expect(screen.getByRole("link", { name: /my classes/i })).not.toHaveAttribute("aria-current");
  });
});

import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));

import { AdminSidebar } from "./AdminSidebar";

describe("AdminSidebar", () => {
  it("marks Users active on the admin page", () => {
    pathnameMock.mockReturnValue("/admin");
    render(<AdminSidebar />);
    expect(screen.getByRole("link", { name: /users/i })).toHaveAttribute("aria-current", "page");
  });

  it("does not mark it active outside the admin section", () => {
    pathnameMock.mockReturnValue("/teacher");
    render(<AdminSidebar />);
    expect(screen.getByRole("link", { name: /users/i })).not.toHaveAttribute("aria-current");
  });
});

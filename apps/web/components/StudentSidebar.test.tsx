import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock(), useRouter: () => ({ push: vi.fn() }) }));

import { StudentSidebar } from "./StudentSidebar";

afterEach(() => vi.restoreAllMocks());

function stubUnauthenticated() {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: {} }) }));
}

describe("StudentSidebar", () => {
  it("renders all nav items and marks the active one", () => {
    pathnameMock.mockReturnValue("/student/submissions");
    stubUnauthenticated();
    render(<StudentSidebar />);
    expect(screen.getByRole("link", { name: /my classes/i })).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /assignments/i })).toBeInTheDocument();
    const submissionsLink = screen.getByRole("link", { name: /submissions/i });
    expect(submissionsLink).toHaveAttribute("aria-current", "page");
  });

  it("keeps My classes active while viewing a class's detail page", () => {
    pathnameMock.mockReturnValue("/student/classes/bio-101");
    stubUnauthenticated();
    render(<StudentSidebar />);
    expect(screen.getByRole("link", { name: /my classes/i })).toHaveAttribute("aria-current", "page");
  });

  it("keeps Assignments active while viewing an assignment's detail page", () => {
    pathnameMock.mockReturnValue("/student/assignments/cell-structure");
    stubUnauthenticated();
    render(<StudentSidebar />);
    expect(screen.getByRole("link", { name: /assignments/i })).toHaveAttribute("aria-current", "page");
  });
});

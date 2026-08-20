import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock(), useRouter: () => ({ push: vi.fn() }) }));

import { TeacherSidebar } from "./TeacherSidebar";

function fetchMockFor(classesOk: boolean) {
  return vi.fn((url: string) => {
    if (url.includes("/api/auth/me")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({ id: "1", name: "Terry Teacher", email: "teacher@example.com", role: "teacher" }),
      });
    }
    if (classesOk) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          classes: [
            { id: "bio", name: "Biology 101" },
            { id: "chem", name: "Chemistry class" },
          ],
        }),
      });
    }
    return Promise.resolve({ ok: false, status: 500, json: async () => ({ error: {} }) });
  });
}

afterEach(() => vi.restoreAllMocks());

describe("TeacherSidebar", () => {
  it("lists the teacher's classes and marks the open one active", async () => {
    pathnameMock.mockReturnValue("/teacher/classes/bio");
    vi.stubGlobal("fetch", fetchMockFor(true));
    render(<TeacherSidebar />);

    const bioLink = await screen.findByRole("link", { name: /biology 101/i });
    expect(bioLink).toHaveAttribute("aria-current", "page");
    const chemLink = screen.getByRole("link", { name: /chemistry class/i });
    expect(chemLink).not.toHaveAttribute("aria-current");
    expect(screen.getByRole("link", { name: /new class/i })).toHaveAttribute("href", "/teacher");
  });

  it("shows no classes without failing when the class list can't load", async () => {
    pathnameMock.mockReturnValue("/teacher");
    vi.stubGlobal("fetch", fetchMockFor(false));
    render(<TeacherSidebar />);

    await waitFor(() => expect(screen.getByText("My classes")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /biology 101/i })).not.toBeInTheDocument();
  });
});

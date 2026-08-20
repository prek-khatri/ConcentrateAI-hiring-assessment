import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock(), useRouter: () => ({ push: vi.fn() }) }));

import { AdminSidebar } from "./AdminSidebar";

afterEach(() => vi.restoreAllMocks());

describe("AdminSidebar", () => {
  it("marks Users active on the admin page", () => {
    pathnameMock.mockReturnValue("/admin");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: {} }) }));
    render(<AdminSidebar />);
    expect(screen.getByRole("link", { name: /^users$/i })).toHaveAttribute("aria-current", "page");
    expect(screen.getByRole("link", { name: /teacher groups/i })).toHaveAttribute("href", "/admin#teacher-groups");
  });

  it("does not mark it active outside the admin section", () => {
    pathnameMock.mockReturnValue("/teacher");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: {} }) }));
    render(<AdminSidebar />);
    expect(screen.getByRole("link", { name: /^users$/i })).not.toHaveAttribute("aria-current");
  });
});

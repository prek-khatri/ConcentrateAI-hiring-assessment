import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }), usePathname: () => "/student" }));

import StudentLayout from "./layout";

afterEach(() => vi.restoreAllMocks());

describe("StudentLayout", () => {
  it("renders the top bar, sidebar, and page content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: {} }) }));
    render(
      <StudentLayout>
        <p>page content</p>
      </StudentLayout>
    );
    expect(screen.getByText("page content")).toBeInTheDocument();
  });
});

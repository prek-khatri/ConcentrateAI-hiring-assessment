import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }), usePathname: () => "/admin" }));

import AdminLayout from "./layout";

afterEach(() => vi.restoreAllMocks());

describe("AdminLayout", () => {
  it("renders the top bar with a sign-out control and the page content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: {} }) }));
    render(
      <AdminLayout>
        <p>page content</p>
      </AdminLayout>
    );
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});

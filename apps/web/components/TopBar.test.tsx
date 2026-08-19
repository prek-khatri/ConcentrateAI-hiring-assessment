import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

import { TopBar } from "./TopBar";

afterEach(() => {
  vi.restoreAllMocks();
  pushMock.mockClear();
});

describe("TopBar", () => {
  it("shows the current user's name and role once loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "1", name: "Sam Student", email: "student@example.com", role: "student" }),
      })
    );
    render(<TopBar />);
    await waitFor(() => expect(screen.getByText("Sam Student")).toBeInTheDocument());
    expect(screen.getByText("student")).toBeInTheDocument();
  });

  it("logs out and redirects to the login page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "1", name: "Sam Student", email: "student@example.com", role: "student" }),
      })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    render(<TopBar />);
    await waitFor(() => screen.getByText("Sam Student"));
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
  });
});

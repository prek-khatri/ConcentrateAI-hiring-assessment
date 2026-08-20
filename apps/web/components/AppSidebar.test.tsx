import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

import { AppSidebar } from "./AppSidebar";

const ITEMS = [{ key: "a", label: "Biology 101", href: "/teacher/classes/a", active: true }];

afterEach(() => {
  vi.restoreAllMocks();
  pushMock.mockClear();
});

describe("AppSidebar", () => {
  it("shows the current user's initials, name, and role once loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "1", name: "Terry Teacher", email: "teacher@example.com", role: "teacher" }),
      })
    );
    render(<AppSidebar ariaLabel="Teacher navigation" sectionLabel="My classes" items={ITEMS} />);
    await waitFor(() => expect(screen.getByText("Terry Teacher")).toBeInTheDocument());
    expect(screen.getByText("TT")).toBeInTheDocument();
    expect(screen.getByText("teacher")).toBeInTheDocument();
  });

  it("renders without a user when the auth check fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: {} }) }));
    render(<AppSidebar ariaLabel="Admin navigation" sectionLabel="Admin" items={ITEMS} />);
    await waitFor(() => expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument());
  });

  it("logs out and redirects to the login page", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "1", name: "Terry Teacher", email: "teacher@example.com", role: "teacher" }),
      })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppSidebar ariaLabel="Teacher navigation" sectionLabel="My classes" items={ITEMS} />);
    await waitFor(() => screen.getByText("Terry Teacher"));
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
  });

  it("redirects to login when logout 401s (session was already invalid)", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "1", name: "Terry Teacher", email: "teacher@example.com", role: "teacher" }),
      })
      .mockResolvedValueOnce({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: "UNAUTHORIZED", message: "Invalid or expired session" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppSidebar ariaLabel="Teacher navigation" sectionLabel="My classes" items={ITEMS} />);
    await waitFor(() => screen.getByText("Terry Teacher"));
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
  });

  it("shows an error and does not redirect on a non-auth logout failure", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "1", name: "Terry Teacher", email: "teacher@example.com", role: "teacher" }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { code: "INTERNAL_ERROR", message: "boom" } }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<AppSidebar ariaLabel="Teacher navigation" sectionLabel="My classes" items={ITEMS} />);
    await waitFor(() => screen.getByText("Terry Teacher"));
    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/couldn't sign out/i));
    expect(pushMock).not.toHaveBeenCalled();
  });
});

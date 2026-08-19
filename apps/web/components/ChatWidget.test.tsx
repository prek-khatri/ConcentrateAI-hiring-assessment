import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach, beforeEach } from "vitest";

const { pathnameMock } = vi.hoisted(() => ({ pathnameMock: vi.fn() }));
vi.mock("next/navigation", () => ({ usePathname: () => pathnameMock() }));

import { ChatWidget } from "./ChatWidget";

beforeEach(() => pathnameMock.mockReturnValue("/teacher"));
afterEach(() => vi.restoreAllMocks());

describe("ChatWidget", () => {
  it("renders nothing when the user isn't authenticated", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: {} }) }));
    const { container } = render(<ChatWidget />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("renders nothing for an admin (chatbot is teacher/student only)", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "1", name: "Ada", email: "admin@example.com", role: "admin" }),
      })
    );
    const { container } = render(<ChatWidget />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
  });

  it("re-checks auth on navigation instead of only once on mount", async () => {
    // Regression test: the root layout (and this widget) persists across a client-side
    // navigation, e.g. the redirect right after login. If the auth check only ran once
    // on mount, a widget that first rendered on the login page (unauthenticated) would
    // stay hidden forever even after the user logs in and lands on their dashboard.
    const fetchMock = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ error: {} }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { container, rerender } = render(<ChatWidget />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());

    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "1", name: "Sam", email: "student@example.com", role: "student" }),
    });
    pathnameMock.mockReturnValue("/student");
    rerender(<ChatWidget />);

    await waitFor(() => expect(screen.getByRole("button", { name: /chat/i })).toBeInTheDocument());
  });

  it("clears the conversation when a different person logs in on the same tab", async () => {
    // Regression test: this widget is one persisting component instance for the whole
    // tab. If someone signs out and a different person signs in without a full page
    // reload, the previous person's messages must not carry over into the new session.
    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ id: "teacher-1", name: "Terry", email: "teacher@example.com", role: "teacher" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const { rerender } = render(<ChatWidget />);
    fireEvent.click(await screen.findByRole("button", { name: /chat/i }));

    fetchMock.mockResolvedValueOnce({
      ok: true,
      status: 200,
      json: async () => ({ reply: "Terry's average is 92." }),
    });
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: "average score" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));
    await waitFor(() => expect(screen.getByText(/terry's average is 92/i)).toBeInTheDocument());

    // A different person (different id) logs in on the same tab.
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "student-1", name: "Sam", email: "student@example.com", role: "student" }),
    });
    pathnameMock.mockReturnValue("/student");
    rerender(<ChatWidget />);

    await waitFor(() => expect(screen.getByRole("button", { name: /chat/i })).toBeInTheDocument());
    expect(screen.queryByText(/average score/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/terry's average is 92/i)).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/ask a question/i)).not.toBeInTheDocument();
  });

  it("shows a toggle button once authenticated, and opens the panel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "1", name: "Sam", email: "student@example.com", role: "student" }),
      })
    );
    render(<ChatWidget />);
    const toggle = await screen.findByRole("button", { name: /chat/i });
    fireEvent.click(toggle);
    expect(screen.getByPlaceholderText(/ask a question/i)).toBeInTheDocument();
  });

  it("closes the panel", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "1", name: "Sam", email: "student@example.com", role: "student" }),
      })
    );
    render(<ChatWidget />);
    fireEvent.click(await screen.findByRole("button", { name: /chat/i }));
    fireEvent.click(screen.getByRole("button", { name: /close chat/i }));
    expect(screen.queryByPlaceholderText(/ask a question/i)).not.toBeInTheDocument();
  });

  it("sends a message and renders the reply", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "1", name: "Sam", email: "student@example.com", role: "student" }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ reply: "You have 2 assignments due soon." }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<ChatWidget />);
    fireEvent.click(await screen.findByRole("button", { name: /chat/i }));
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: "What's due soon?" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(screen.getByText(/2 assignments due soon/i)).toBeInTheDocument());
  });

  it("shows a generic error when sending fails without an ApiClientError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "1", name: "Sam", email: "student@example.com", role: "student" }),
      })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);

    render(<ChatWidget />);
    fireEvent.click(await screen.findByRole("button", { name: /chat/i }));
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i));
  });

  it("shows an error when sending a message fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: "1", name: "Sam", email: "student@example.com", role: "student" }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { code: "INTERNAL_ERROR", message: "boom" } }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<ChatWidget />);
    fireEvent.click(await screen.findByRole("button", { name: /chat/i }));
    fireEvent.change(screen.getByPlaceholderText(/ask a question/i), { target: { value: "hi" } });
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/boom/i));
  });

  it("does not send an empty message", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "1", name: "Sam", email: "student@example.com", role: "student" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<ChatWidget />);
    fireEvent.click(await screen.findByRole("button", { name: /chat/i }));
    fireEvent.click(screen.getByRole("button", { name: /send/i }));

    expect(fetchMock).toHaveBeenCalledTimes(1); // only the initial /api/auth/me call
  });
});

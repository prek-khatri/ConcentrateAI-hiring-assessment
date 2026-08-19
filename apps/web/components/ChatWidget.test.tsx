import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ChatWidget } from "./ChatWidget";

afterEach(() => vi.restoreAllMocks());

describe("ChatWidget", () => {
  it("renders nothing when the user isn't authenticated", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: {} }) }));
    const { container } = render(<ChatWidget />);
    await waitFor(() => expect(container).toBeEmptyDOMElement());
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

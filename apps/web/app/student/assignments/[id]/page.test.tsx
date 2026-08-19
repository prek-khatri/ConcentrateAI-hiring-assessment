import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "assignment-1" }) }));

import AssignmentDetailPage from "./page";

afterEach(() => vi.restoreAllMocks());

describe("AssignmentDetailPage", () => {
  it("shows a submission form when there's no submission yet", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          assignment: { id: "assignment-1", class_id: "c1", title: "Cell Structure", description: "Desc", published: true, due_at: null },
          submission: null,
        }),
      })
    );
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByRole("button", { name: /submit assignment/i })).toBeInTheDocument());
  });

  it("shows a field error on empty content and does not call the API", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({
        assignment: { id: "assignment-1", class_id: "c1", title: "Cell Structure", description: "Desc", published: true, due_at: null },
        submission: null,
      }),
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentDetailPage />);
    await waitFor(() => screen.getByRole("button", { name: /submit assignment/i }));

    fireEvent.click(screen.getByRole("button", { name: /submit assignment/i }));
    expect(await screen.findByText(/content is required/i)).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledTimes(1); // only the initial GET, no POST
  });

  it("shows a generic error when loading fails without an ApiClientError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/failed to load assignment/i));
  });

  it("shows a load error and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 404, json: async () => ({ error: { code: "NOT_FOUND", message: "Not found" } }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          assignment: { id: "assignment-1", class_id: "c1", title: "Cell Structure", description: "Desc", published: true, due_at: "2026-09-01T12:00:00.000Z" },
          submission: null,
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/not found/i));
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/due 9\/1\/2026/i)).toBeInTheDocument());
  });

  it("submits new content and reloads", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          assignment: { id: "assignment-1", class_id: "c1", title: "Cell Structure", description: "Desc", published: true, due_at: null },
          submission: null,
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "s1", content: "my answer", submitted_at: "2024-01-01", score: null, feedback: null }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          assignment: { id: "assignment-1", class_id: "c1", title: "Cell Structure", description: "Desc", published: true, due_at: null },
          submission: { id: "s1", content: "my answer", submitted_at: "2024-01-01", score: null, feedback: null },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentDetailPage />);
    await waitFor(() => screen.getByRole("button", { name: /submit assignment/i }));
    fireEvent.change(screen.getByLabelText(/submission/i), { target: { value: "my answer" } });
    fireEvent.click(screen.getByRole("button", { name: /submit assignment/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [, submitOptions] = fetchMock.mock.calls[1];
    expect(submitOptions.method).toBe("POST");
  });

  it("updates an existing submission via PATCH", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          assignment: { id: "assignment-1", class_id: "c1", title: "Cell Structure", description: "Desc", published: true, due_at: null },
          submission: { id: "s1", content: "old answer", submitted_at: "2024-01-01", score: null, feedback: null },
        }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ id: "s1", content: "new answer", submitted_at: "2024-01-01", score: null, feedback: null }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          assignment: { id: "assignment-1", class_id: "c1", title: "Cell Structure", description: "Desc", published: true, due_at: null },
          submission: { id: "s1", content: "new answer", submitted_at: "2024-01-01", score: null, feedback: null },
        }),
      });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentDetailPage />);
    await waitFor(() => screen.getByRole("button", { name: /update submission/i }));
    fireEvent.change(screen.getByLabelText(/submission/i), { target: { value: "new answer" } });
    fireEvent.click(screen.getByRole("button", { name: /update submission/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(3));
    const [, updateOptions] = fetchMock.mock.calls[1];
    expect(updateOptions.method).toBe("PATCH");
  });

  it("shows a generic form error when submission fails without an ApiClientError", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          assignment: { id: "assignment-1", class_id: "c1", title: "Cell Structure", description: "Desc", published: true, due_at: null },
          submission: null,
        }),
      })
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentDetailPage />);
    await waitFor(() => screen.getByRole("button", { name: /submit assignment/i }));
    fireEvent.change(screen.getByLabelText(/submission/i), { target: { value: "my answer" } });
    fireEvent.click(screen.getByRole("button", { name: /submit assignment/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/failed to submit/i));
  });

  it("shows a form error when submission fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          assignment: { id: "assignment-1", class_id: "c1", title: "Cell Structure", description: "Desc", published: true, due_at: null },
          submission: null,
        }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { code: "INTERNAL_ERROR", message: "boom" } }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentDetailPage />);
    await waitFor(() => screen.getByRole("button", { name: /submit assignment/i }));
    fireEvent.change(screen.getByLabelText(/submission/i), { target: { value: "my answer" } });
    fireEvent.click(screen.getByRole("button", { name: /submit assignment/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/boom/i));
  });

  it("shows the score and feedback when graded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          assignment: { id: "assignment-1", class_id: "c1", title: "Cell Structure", description: "Desc", published: true, due_at: null },
          submission: { id: "s1", content: "answer", submitted_at: "2024-01-01", score: 92, feedback: "Great work." },
        }),
      })
    );
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByText(/score: 92\/100/i)).toBeInTheDocument());
    expect(screen.getByText(/great work/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /submit assignment/i })).not.toBeInTheDocument();
  });
});

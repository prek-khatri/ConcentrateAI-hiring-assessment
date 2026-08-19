import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import SubmissionsPage from "./page";

afterEach(() => vi.restoreAllMocks());

describe("SubmissionsPage", () => {
  it("shows an empty state with no submissions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ submissions: [] }) }));
    render(<SubmissionsPage />);
    await waitFor(() => expect(screen.getByText(/no submissions yet/i)).toBeInTheDocument());
  });

  it("shows a generic error when the failure isn't an ApiClientError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<SubmissionsPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/failed to load submissions/i));
  });

  it("shows a load error and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { code: "INTERNAL_ERROR", message: "boom" } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ submissions: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<SubmissionsPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/boom/i));
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/no submissions yet/i)).toBeInTheDocument());
  });

  it("renders a table row per submission with status", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          submissions: [
            { id: "s1", assignment_id: "a1", assignmentTitle: "Cell Structure", className: "Biology 101", score: 92, feedback: "Good" },
            { id: "s2", assignment_id: "a2", assignmentTitle: "Photosynthesis", className: "Biology 101", score: null, feedback: null },
          ],
        }),
      })
    );
    render(<SubmissionsPage />);
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    expect(screen.getByText(/graded — 92\/100/i)).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });
});

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import SubmissionsPage from "./page";

afterEach(() => vi.restoreAllMocks());

describe("SubmissionsPage", () => {
  it("shows an empty state with no submissions", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ submissions: [] }) }));
    render(<SubmissionsPage />);
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

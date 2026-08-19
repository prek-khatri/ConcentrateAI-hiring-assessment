import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import AssignmentsPage from "./page";

afterEach(() => vi.restoreAllMocks());

describe("AssignmentsPage", () => {
  it("shows an empty state with no assignments", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ assignments: [] }) }));
    render(<AssignmentsPage />);
    await waitFor(() => expect(screen.getByText(/no assignments yet/i)).toBeInTheDocument());
  });

  it("shows status per assignment across all classes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          assignments: [
            { id: "a1", title: "Cell Structure", description: "", due_at: null, classId: "c1", className: "Biology 101", submissionId: "s1", score: 92 },
            { id: "a2", title: "Photosynthesis", description: "", due_at: null, classId: "c1", className: "Biology 101", submissionId: null, score: null },
            { id: "a3", title: "Kinematics", description: "", due_at: null, classId: "c2", className: "Physics 201", submissionId: "s2", score: null },
          ],
        }),
      })
    );
    render(<AssignmentsPage />);
    await waitFor(() => expect(screen.getByRole("table")).toBeInTheDocument());
    expect(screen.getByText(/graded — 92\/100/i)).toBeInTheDocument();
    expect(screen.getByText("Not submitted")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
  });
});

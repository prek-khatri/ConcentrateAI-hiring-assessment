import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ id: "class-1" }) }));

import ClassAssignmentsPage from "./page";

afterEach(() => vi.restoreAllMocks());

function mockFetchSequence(responses: unknown[]) {
  const fn = vi.fn();
  responses.forEach((body) => fn.mockResolvedValueOnce({ ok: true, status: 200, json: async () => body }));
  vi.stubGlobal("fetch", fn);
}

describe("ClassAssignmentsPage", () => {
  it("shows an empty state with no assignments", async () => {
    mockFetchSequence([{ assignments: [] }, { submissions: [] }]);
    render(<ClassAssignmentsPage />);
    await waitFor(() => expect(screen.getByText(/no assignments yet/i)).toBeInTheDocument());
  });

  it("shows a generic error when the failure isn't an ApiClientError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<ClassAssignmentsPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/failed to load assignments/i));
  });

  it("shows a load error and retries", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({ error: { code: "INTERNAL_ERROR", message: "boom" } }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ submissions: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ assignments: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ submissions: [] }) });
    vi.stubGlobal("fetch", fetchMock);
    render(<ClassAssignmentsPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/boom/i));
    fireEvent.click(screen.getByRole("button", { name: /retry/i }));
    await waitFor(() => expect(screen.getByText(/no assignments yet/i)).toBeInTheDocument());
  });

  it("shows the due date when an assignment has one", async () => {
    mockFetchSequence([
      { assignments: [{ id: "a1", class_id: "class-1", title: "Cell Structure", description: "", published: true, due_at: "2026-09-01T12:00:00.000Z" }] },
      { submissions: [] },
    ]);
    render(<ClassAssignmentsPage />);
    await waitFor(() => expect(screen.getByText(/due 9\/1\/2026/i)).toBeInTheDocument());
  });

  it("derives Not submitted / Submitted / Graded status per assignment", async () => {
    mockFetchSequence([
      {
        assignments: [
          { id: "a1", class_id: "class-1", title: "Cell Structure", description: "", published: true, due_at: null },
          { id: "a2", class_id: "class-1", title: "Photosynthesis", description: "", published: true, due_at: null },
          { id: "a3", class_id: "class-1", title: "Genetics", description: "", published: true, due_at: null },
        ],
      },
      {
        submissions: [
          { id: "s1", assignment_id: "a1", assignmentTitle: "Cell Structure", className: "Biology 101", score: 92, feedback: "Good" },
          { id: "s2", assignment_id: "a2", assignmentTitle: "Photosynthesis", className: "Biology 101", score: null, feedback: null },
        ],
      },
    ]);
    render(<ClassAssignmentsPage />);

    await waitFor(() => expect(screen.getByText("Cell Structure")).toBeInTheDocument());
    expect(screen.getByText("Graded")).toBeInTheDocument();
    expect(screen.getByText("Submitted")).toBeInTheDocument();
    expect(screen.getByText("Not submitted")).toBeInTheDocument();
  });
});

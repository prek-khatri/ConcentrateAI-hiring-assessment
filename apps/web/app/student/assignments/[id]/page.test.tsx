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

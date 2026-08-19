import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({ id: "assignment-1" }),
}));

import AssignmentDetailPage from "./page";

const baseAssignment = {
  id: "assignment-1",
  class_id: "class-1",
  title: "Cell Structure",
  description: "Describe the parts of a cell.",
  published: true,
  due_at: null as string | null,
};

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body };
}

function mockRoutedFetch(routes: { match: (url: string, method: string) => boolean; response: () => unknown }[]) {
  const fetchMock = vi.fn((url: string, opts: RequestInit = {}) => {
    const method = opts.method ?? "GET";
    const route = routes.find((r) => r.match(String(url), method));
    return Promise.resolve(route ? route.response() : jsonResponse(404, { error: { message: "unhandled" } }));
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

afterEach(() => {
  vi.restoreAllMocks();
  pushMock.mockClear();
});

describe("AssignmentDetailPage", () => {
  it("shows loading, then the assignment with no submissions", async () => {
    mockRoutedFetch([
      { match: (u) => u.includes("/assignments/assignment-1"), response: () => jsonResponse(200, { assignment: baseAssignment, submissions: [] }) },
    ]);
    render(<AssignmentDetailPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Cell Structure")).toBeInTheDocument());
    expect(screen.getByText(/describe the parts/i)).toBeInTheDocument();
    expect(screen.getByText(/^Published/)).toBeInTheDocument();
    expect(screen.getByText(/no submissions yet/i)).toBeInTheDocument();
  });

  it("shows the due date and draft status when unpublished", async () => {
    const draft = { ...baseAssignment, published: false, due_at: "2026-09-01T00:00:00.000Z" };
    mockRoutedFetch([
      { match: (u) => u.includes("/assignments/assignment-1"), response: () => jsonResponse(200, { assignment: draft, submissions: [] }) },
    ]);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByText(/Draft/)).toBeInTheDocument());
    expect(screen.getByText(/Due/)).toBeInTheDocument();
  });

  it("shows an assignment with no description as a plain view (no description paragraph)", async () => {
    const noDescription = { ...baseAssignment, description: null };
    mockRoutedFetch([
      { match: (u) => u.includes("/assignments/assignment-1"), response: () => jsonResponse(200, { assignment: noDescription, submissions: [] }) },
    ]);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByText("Cell Structure")).toBeInTheDocument());
    expect(screen.queryByText(/describe the parts/i)).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect((screen.getByPlaceholderText(/description/i) as HTMLInputElement).value).toBe("");
  });

  it("shows an error if the assignment fails to load", async () => {
    mockRoutedFetch([
      {
        match: (u) => u.includes("/assignments/assignment-1"),
        response: () => jsonResponse(404, { error: { code: "NOT_FOUND", message: "Assignment not found" } }),
      },
    ]);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByText("Assignment not found")).toBeInTheDocument());
  });

  it("shows a generic error if loading the assignment throws a non-API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByText(/failed to load assignment/i)).toBeInTheDocument());
  });

  it("lists a submission and grades it", async () => {
    const submission: { id: string; content: string; submitted_at: string; studentId: string; studentName: string; score: number | string | null; feedback: string | null } = {
      id: "sub-1",
      content: "Mitochondria is the powerhouse.",
      submitted_at: "2026-08-01T00:00:00.000Z",
      studentId: "s1",
      studentName: "Sam Student",
      score: null,
      feedback: null,
    };
    let submissions = [submission];
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/submissions/sub-1/grade") && m === "POST",
        response: () => {
          submissions = [{ ...submission, score: 90, feedback: "Great job." }];
          return jsonResponse(200, { score: 90, feedback: "Great job." });
        },
      },
      {
        match: (u) => u.includes("/assignments/assignment-1"),
        response: () => jsonResponse(200, { assignment: baseAssignment, submissions }),
      },
    ]);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByPlaceholderText("Score")).toBeInTheDocument());
    expect(screen.getAllByText("Sam Student").length).toBeGreaterThan(0);
    expect(screen.getByText(/mitochondria is the powerhouse/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /save grade/i })).toBeInTheDocument();

    fireEvent.change(screen.getByPlaceholderText("Score"), { target: { value: "90" } });
    fireEvent.change(screen.getByPlaceholderText(/feedback/i), { target: { value: "Great job." } });
    fireEvent.click(screen.getByRole("button", { name: /save grade/i }));

    await waitFor(() => expect(screen.getByRole("button", { name: /update grade/i })).toBeInTheDocument());
  });

  it("switches the detail pane by clicking a different submission in the list", async () => {
    const submissions = [
      {
        id: "sub-1",
        content: "Sam's answer",
        submitted_at: "2026-08-01T00:00:00.000Z",
        studentId: "s1",
        studentName: "Sam Student",
        score: 92,
        feedback: "Nice",
      },
      {
        id: "sub-2",
        content: "Sasha's answer",
        submitted_at: "2026-08-02T00:00:00.000Z",
        studentId: "s2",
        studentName: "Sasha Student",
        score: null,
        feedback: null,
      },
    ];
    mockRoutedFetch([
      {
        match: (u) => u.includes("/assignments/assignment-1"),
        response: () => jsonResponse(200, { assignment: baseAssignment, submissions }),
      },
    ]);
    render(<AssignmentDetailPage />);

    // Sam (first submission) is selected by default.
    await waitFor(() => expect(screen.getByText(/sam's answer/i)).toBeInTheDocument());
    expect(screen.queryByText(/sasha's answer/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous submission/i })).toBeDisabled();
    expect(screen.getByRole("button", { name: /next submission/i })).not.toBeDisabled();

    // Selecting Sasha from the list swaps the detail pane.
    fireEvent.click(screen.getByRole("button", { name: /sasha student/i }));
    await waitFor(() => expect(screen.getByText(/sasha's answer/i)).toBeInTheDocument());
    expect(screen.queryByText(/sam's answer/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /previous submission/i })).not.toBeDisabled();
    expect(screen.getByRole("button", { name: /next submission/i })).toBeDisabled();

    // Prev arrow goes back to Sam.
    fireEvent.click(screen.getByRole("button", { name: /previous submission/i }));
    await waitFor(() => expect(screen.getByText(/sam's answer/i)).toBeInTheDocument());

    // Next arrow goes forward to Sasha again.
    fireEvent.click(screen.getByRole("button", { name: /next submission/i }));
    await waitFor(() => expect(screen.getByText(/sasha's answer/i)).toBeInTheDocument());
  });

  it("shows an error when grading fails", async () => {
    const submission = {
      id: "sub-1",
      content: "attempt",
      submitted_at: "2026-08-01T00:00:00.000Z",
      studentId: "s1",
      studentName: "Sam Student",
      score: null,
      feedback: null,
    };
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/submissions/sub-1/grade") && m === "POST",
        response: () => jsonResponse(500, { error: { code: "INTERNAL_ERROR", message: "boom" } }),
      },
      {
        match: (u) => u.includes("/assignments/assignment-1"),
        response: () => jsonResponse(200, { assignment: baseAssignment, submissions: [submission] }),
      },
    ]);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByPlaceholderText("Score")).toBeInTheDocument());
    expect(screen.getAllByText("Sam Student").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("Score"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: /save grade/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("boom"));
  });

  it("shows a generic error when grading throws a non-API error", async () => {
    const submission = {
      id: "sub-1",
      content: "attempt",
      submitted_at: "2026-08-01T00:00:00.000Z",
      studentId: "s1",
      studentName: "Sam Student",
      score: null,
      feedback: null,
    };
    const fetchMock = vi.fn((url: string) => {
      if (String(url).includes("/grade")) return Promise.reject(new Error("network down"));
      return Promise.resolve(jsonResponse(200, { assignment: baseAssignment, submissions: [submission] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByPlaceholderText("Score")).toBeInTheDocument());
    expect(screen.getAllByText("Sam Student").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByPlaceholderText("Score"), { target: { value: "50" } });
    fireEvent.click(screen.getByRole("button", { name: /save grade/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not save the grade/i));
  });

  it("edits every field on the assignment, including clearing the due date", async () => {
    let assignment: Omit<typeof baseAssignment, "description"> & { description: string | null } = {
      ...baseAssignment,
      due_at: "2026-09-01T00:00:00.000Z",
    };
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/assignments/assignment-1") && m === "PATCH",
        response: () => {
          assignment = { ...assignment, title: "Cell Structure Revised", description: null, published: false };
          return jsonResponse(200, assignment);
        },
      },
      {
        match: (u) => u.includes("/assignments/assignment-1"),
        response: () => jsonResponse(200, { assignment, submissions: [] }),
      },
    ]);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByText("Cell Structure")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.change(screen.getByDisplayValue("Cell Structure"), { target: { value: "Cell Structure Revised" } });
    fireEvent.change(screen.getByDisplayValue(/describe the parts/i), { target: { value: "" } });
    fireEvent.change(screen.getByDisplayValue("2026-09-01"), { target: { value: "" } });
    fireEvent.click(screen.getByLabelText(/published/i));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(screen.getByText("Cell Structure Revised")).toBeInTheDocument());
  });

  it("sets a due date on save", async () => {
    let assignment = baseAssignment;
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/assignments/assignment-1") && m === "PATCH",
        response: () => {
          assignment = { ...assignment, due_at: "2026-10-01T00:00:00.000Z" };
          return jsonResponse(200, assignment);
        },
      },
      {
        match: (u) => u.includes("/assignments/assignment-1"),
        response: () => jsonResponse(200, { assignment, submissions: [] }),
      },
    ]);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByText("Cell Structure")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    fireEvent.change(dateInput, { target: { value: "2026-10-01" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(screen.getByText(/Due/)).toBeInTheDocument());
  });

  it("cancels editing without saving", async () => {
    mockRoutedFetch([
      {
        match: (u) => u.includes("/assignments/assignment-1"),
        response: () => jsonResponse(200, { assignment: baseAssignment, submissions: [] }),
      },
    ]);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByText("Cell Structure")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.getByText("Cell Structure")).toBeInTheDocument();
  });

  it("shows a generic error when saving throws a non-API error", async () => {
    const fetchMock = vi.fn((_url: string, opts: RequestInit = {}) => {
      if (opts.method === "PATCH") return Promise.reject(new Error("network down"));
      return Promise.resolve(jsonResponse(200, { assignment: baseAssignment, submissions: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByText("Cell Structure")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not update assignment/i));
  });

  it("shows an error when saving the assignment fails", async () => {
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/assignments/assignment-1") && m === "PATCH",
        response: () => jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Title required" } }),
      },
      {
        match: (u) => u.includes("/assignments/assignment-1"),
        response: () => jsonResponse(200, { assignment: baseAssignment, submissions: [] }),
      },
    ]);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByText("Cell Structure")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Title required"));
  });

  it("deletes the assignment and redirects to the class", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/assignments/assignment-1") && m === "DELETE",
        response: () => jsonResponse(204, {}),
      },
      {
        match: (u) => u.includes("/assignments/assignment-1"),
        response: () => jsonResponse(200, { assignment: baseAssignment, submissions: [] }),
      },
    ]);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByText("Cell Structure")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/teacher/classes/class-1"));
  });

  it("does nothing when delete is not confirmed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    mockRoutedFetch([
      {
        match: (u) => u.includes("/assignments/assignment-1"),
        response: () => jsonResponse(200, { assignment: baseAssignment, submissions: [] }),
      },
    ]);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByText("Cell Structure")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a generic error when deleting throws a non-API error", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn((_url: string, opts: RequestInit = {}) => {
      if (opts.method === "DELETE") return Promise.reject(new Error("network down"));
      return Promise.resolve(jsonResponse(200, { assignment: baseAssignment, submissions: [] }));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByText("Cell Structure")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not delete assignment/i));
  });

  it("shows an error when deleting the assignment fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/assignments/assignment-1") && m === "DELETE",
        response: () => jsonResponse(500, { error: { code: "INTERNAL_ERROR", message: "boom" } }),
      },
      {
        match: (u) => u.includes("/assignments/assignment-1"),
        response: () => jsonResponse(200, { assignment: baseAssignment, submissions: [] }),
      },
    ]);
    render(<AssignmentDetailPage />);
    await waitFor(() => expect(screen.getByText("Cell Structure")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("boom"));
  });
});

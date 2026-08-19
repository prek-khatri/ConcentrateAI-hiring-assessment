import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: pushMock }),
  useParams: () => ({ id: "class-1" }),
}));

import ClassDetailPage from "./page";

type Detail = {
  class: { id: string; name: string; description: string | null };
  roster: { id: string; name: string; email: string }[];
  assignments: { id: string; title: string; published: boolean; due_at: string | null }[];
};

const baseDetail: Detail = {
  class: { id: "class-1", name: "Biology 101", description: "Intro to Biology" },
  roster: [],
  assignments: [],
};

const students = { students: [{ id: "s1", name: "Sam Student", email: "sam@example.com" }] };

function jsonResponse(status: number, body: unknown) {
  return { ok: status < 400, status, json: async () => body };
}

/** Routes fetch calls by URL substring + method, in the order given; falls back to the last matcher. */
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

describe("ClassDetailPage", () => {
  it("shows loading, then the class name, empty roster, and empty assignments", async () => {
    mockRoutedFetch([
      { match: (u) => u.includes("/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, baseDetail) },
    ]);
    render(<ClassDetailPage />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText("Biology 101")).toBeInTheDocument());
    expect(screen.getByText("Intro to Biology")).toBeInTheDocument();
    expect(screen.getByText(/no students yet/i)).toBeInTheDocument();
    expect(screen.getByText(/no assignments yet/i)).toBeInTheDocument();
  });

  it("renders a class with no description with no description paragraph", async () => {
    const noDescription = { ...baseDetail, class: { ...baseDetail.class, description: null } };
    mockRoutedFetch([
      { match: (u) => u.includes("/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, noDescription) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText("Biology 101")).toBeInTheDocument());
    expect(screen.queryByText("Intro to Biology")).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    expect((screen.getByPlaceholderText(/description/i) as HTMLInputElement).value).toBe("");
  });

  it("shows an error if the class fails to load", async () => {
    mockRoutedFetch([
      { match: (u) => u.includes("/students"), response: () => jsonResponse(200, students) },
      {
        match: (u) => u.includes("/classes/class-1"),
        response: () => jsonResponse(404, { error: { code: "NOT_FOUND", message: "Class not found" } }),
      },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText("Class not found")).toBeInTheDocument());
  });

  it("shows a generic error if loading the class throws a non-API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText(/failed to load class/i)).toBeInTheDocument());
  });

  it("adds a student to the roster", async () => {
    let detail = baseDetail;
    mockRoutedFetch([
      { match: (u) => u.includes("/students") && u.includes("class-1"), response: () => jsonResponse(204, {}) },
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      {
        match: (u) => u.includes("/classes/class-1"),
        response: () => {
          const current = detail;
          detail = { ...detail, roster: [{ id: "s1", name: "Sam Student", email: "sam@example.com" }] };
          return jsonResponse(200, current);
        },
      },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText(/no students yet/i)).toBeInTheDocument());

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "s1" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(screen.getByText(/Sam Student/)).toBeInTheDocument());
  });

  it("does nothing if the add-student form is submitted with no selection", async () => {
    const fetchMock = mockRoutedFetch([
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, baseDetail) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText(/no students yet/i)).toBeInTheDocument());

    fireEvent.submit(screen.getByRole("combobox").closest("form")!);
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/students"), expect.objectContaining({ method: "POST" }));
  });

  it("shows a generic error when adding a student throws a non-API error", async () => {
    const fetchMock = vi.fn((url: string, opts: RequestInit = {}) => {
      if (String(url).includes("/students") && opts.method === "POST") return Promise.reject(new Error("down"));
      if (String(url).endsWith("/api/teacher/students")) return Promise.resolve(jsonResponse(200, students));
      return Promise.resolve(jsonResponse(200, baseDetail));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText(/no students yet/i)).toBeInTheDocument());

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "s1" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not add student/i));
  });

  it("shows an error when adding a student fails", async () => {
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/students") && u.includes("class-1") && m === "POST",
        response: () => jsonResponse(404, { error: { code: "NOT_FOUND", message: "Student not found" } }),
      },
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, baseDetail) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText(/no students yet/i)).toBeInTheDocument());

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "s1" } });
    fireEvent.click(screen.getByRole("button", { name: /^add$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Student not found"));
  });

  it("removes a student from the roster", async () => {
    const withStudent = { ...baseDetail, roster: [{ id: "s1", name: "Sam Student", email: "sam@example.com" }] };
    let detail = withStudent;
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/students/s1") && m === "DELETE",
        response: () => {
          detail = baseDetail;
          return jsonResponse(204, {});
        },
      },
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, detail) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText(/Sam Student/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() => expect(screen.getByText(/no students yet/i)).toBeInTheDocument());
  });

  it("shows an error when removing a student fails", async () => {
    const withStudent = { ...baseDetail, roster: [{ id: "s1", name: "Sam Student", email: "sam@example.com" }] };
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/students/s1") && m === "DELETE",
        response: () => jsonResponse(500, { error: { code: "INTERNAL_ERROR", message: "boom" } }),
      },
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, withStudent) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText(/Sam Student/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("boom"));
  });

  it("shows a generic error when removing a student throws a non-API error", async () => {
    const withStudent: Detail = { ...baseDetail, roster: [{ id: "s1", name: "Sam Student", email: "sam@example.com" }] };
    const fetchMock = vi.fn((url: string, opts: RequestInit = {}) => {
      if (String(url).includes("/students/s1") && opts.method === "DELETE") return Promise.reject(new Error("down"));
      if (String(url).endsWith("/api/teacher/students")) return Promise.resolve(jsonResponse(200, students));
      return Promise.resolve(jsonResponse(200, withStudent));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText(/Sam Student/)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /remove/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not remove student/i));
  });

  it("edits the class name and description", async () => {
    let detail = baseDetail;
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/classes/class-1") && m === "PATCH",
        response: () => {
          detail = { ...detail, class: { ...detail.class, name: "Biology 102", description: "Updated" } };
          return jsonResponse(200, detail.class);
        },
      },
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, detail) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText("Biology 101")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.change(screen.getByDisplayValue("Biology 101"), { target: { value: "Biology 102" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(screen.getByText("Biology 102")).toBeInTheDocument());
  });

  it("clears the class description on save", async () => {
    let detail = baseDetail;
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/classes/class-1") && m === "PATCH",
        response: () => {
          detail = { ...detail, class: { ...detail.class, description: null } };
          return jsonResponse(200, detail.class);
        },
      },
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, detail) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText("Intro to Biology")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.change(screen.getByDisplayValue("Intro to Biology"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(screen.queryByText("Intro to Biology")).not.toBeInTheDocument());
  });

  it("shows a generic error when saving the class throws a non-API error", async () => {
    const fetchMock = vi.fn((url: string, opts: RequestInit = {}) => {
      if (opts.method === "PATCH") return Promise.reject(new Error("down"));
      if (String(url).endsWith("/api/teacher/students")) return Promise.resolve(jsonResponse(200, students));
      return Promise.resolve(jsonResponse(200, baseDetail));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText("Biology 101")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not update class/i));
  });

  it("cancels editing the class without saving", async () => {
    mockRoutedFetch([
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, baseDetail) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText("Biology 101")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^cancel$/i }));
    expect(screen.getByText("Biology 101")).toBeInTheDocument();
  });

  it("shows an error when saving the class fails", async () => {
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/classes/class-1") && m === "PATCH",
        response: () => jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Name required" } }),
      },
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, baseDetail) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText("Biology 101")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^edit$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Name required"));
  });

  it("deletes the class and redirects to the dashboard", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/classes/class-1") && m === "DELETE",
        response: () => jsonResponse(204, {}),
      },
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, baseDetail) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText("Biology 101")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/teacher"));
  });

  it("does nothing when delete is not confirmed", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(false);
    mockRoutedFetch([
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, baseDetail) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText("Biology 101")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows an error when deleting the class fails", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/classes/class-1") && m === "DELETE",
        response: () => jsonResponse(500, { error: { code: "INTERNAL_ERROR", message: "boom" } }),
      },
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, baseDetail) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText("Biology 101")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("boom"));
  });

  it("shows a generic error when deleting the class throws a non-API error", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    const fetchMock = vi.fn((url: string, opts: RequestInit = {}) => {
      if (opts.method === "DELETE") return Promise.reject(new Error("down"));
      if (String(url).endsWith("/api/teacher/students")) return Promise.resolve(jsonResponse(200, students));
      return Promise.resolve(jsonResponse(200, baseDetail));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText("Biology 101")).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not delete class/i));
  });

  it("shows a draft assignment in the list", async () => {
    const withDraft: Detail = {
      ...baseDetail,
      assignments: [{ id: "a1", title: "Draft one", published: false, due_at: null }],
    };
    mockRoutedFetch([
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, withDraft) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText("Draft one")).toBeInTheDocument());
    expect(screen.getByText("Draft")).toBeInTheDocument();
  });

  it("creates an assignment with a description and due date", async () => {
    let detail = baseDetail;
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/assignments") && m === "POST",
        response: () => {
          detail = {
            ...detail,
            assignments: [{ id: "a2", title: "Photosynthesis", published: true, due_at: "2026-09-01T00:00:00.000Z" }],
          };
          return jsonResponse(201, { id: "a2" });
        },
      },
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, detail) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText(/no assignments yet/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: "Photosynthesis" } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Light reactions" } });
    fireEvent.change(screen.getByLabelText(/due date/i), { target: { value: "2026-09-01" } });
    fireEvent.click(screen.getByRole("button", { name: /publish assignment/i }));

    await waitFor(() => expect(screen.getByText("Photosynthesis")).toBeInTheDocument());
  });

  it("shows a generic error when creating an assignment throws a non-API error", async () => {
    const fetchMock = vi.fn((url: string, opts: RequestInit = {}) => {
      if (String(url).includes("/assignments") && opts.method === "POST") return Promise.reject(new Error("down"));
      if (String(url).endsWith("/api/teacher/students")) return Promise.resolve(jsonResponse(200, students));
      return Promise.resolve(jsonResponse(200, baseDetail));
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText(/no assignments yet/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: /publish assignment/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not create assignment/i));
  });

  it("creates an assignment and lists it", async () => {
    let detail = baseDetail;
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/assignments") && m === "POST",
        response: () => {
          detail = {
            ...detail,
            assignments: [{ id: "a1", title: "Cells", published: true, due_at: null }],
          };
          return jsonResponse(201, { id: "a1" });
        },
      },
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, detail) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText(/no assignments yet/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: "Cells" } });
    fireEvent.click(screen.getByRole("button", { name: /publish assignment/i }));

    await waitFor(() => expect(screen.getByText("Cells")).toBeInTheDocument());
    expect(screen.getByText("Published")).toBeInTheDocument();
  });

  it("shows an error when creating an assignment fails", async () => {
    mockRoutedFetch([
      {
        match: (u, m) => u.includes("/assignments") && m === "POST",
        response: () => jsonResponse(400, { error: { code: "VALIDATION_ERROR", message: "Title required" } }),
      },
      { match: (u) => u.endsWith("/api/teacher/students"), response: () => jsonResponse(200, students) },
      { match: (u) => u.includes("/classes/class-1"), response: () => jsonResponse(200, baseDetail) },
    ]);
    render(<ClassDetailPage />);
    await waitFor(() => expect(screen.getByText(/no assignments yet/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/^title$/i), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: /publish assignment/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Title required"));
  });
});

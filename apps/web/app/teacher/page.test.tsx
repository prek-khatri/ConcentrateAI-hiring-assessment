import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

import TeacherDashboard from "./page";

afterEach(() => {
  vi.restoreAllMocks();
  pushMock.mockClear();
});

function mockFetchOnce(response: { ok: boolean; status: number; json: () => unknown }) {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ...response, json: async () => response.json() }));
}

describe("TeacherDashboard", () => {
  it("shows loading, then an empty state when there are no classes", async () => {
    mockFetchOnce({ ok: true, status: 200, json: () => ({ classes: [] }) });
    render(<TeacherDashboard />);
    expect(screen.getByText(/loading/i)).toBeInTheDocument();
    await waitFor(() => expect(screen.getByText(/no classes yet/i)).toBeInTheDocument());
  });

  it("lists classes returned from the API as links", async () => {
    mockFetchOnce({
      ok: true,
      status: 200,
      json: () => ({ classes: [{ id: "c1", name: "Biology 101", description: "Intro" }] }),
    });
    render(<TeacherDashboard />);
    await waitFor(() => expect(screen.getByText("Biology 101")).toBeInTheDocument());
    expect(screen.getByText("Intro")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /Biology 101/i })).toHaveAttribute("href", "/teacher/classes/c1");
  });

  it("shows an error if loading classes fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: "INTERNAL_ERROR", message: "boom" } }),
      })
    );
    render(<TeacherDashboard />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("boom"));
  });

  it("shows a generic error if loading classes fails with a non-API error", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    render(<TeacherDashboard />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/failed to load classes/i));
  });

  it("creates a class and prepends it to the list", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ classes: [] }) })
      .mockResolvedValueOnce({
        ok: true,
        status: 201,
        json: async () => ({ id: "c2", name: "Chemistry", description: null }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<TeacherDashboard />);
    await waitFor(() => expect(screen.getByText(/no classes yet/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "Chemistry" } });
    fireEvent.change(screen.getByLabelText(/description/i), { target: { value: "Intro to Chem" } });
    fireEvent.click(screen.getByRole("button", { name: /create class/i }));

    await waitFor(() => expect(screen.getByText("Chemistry")).toBeInTheDocument());
    expect((screen.getByLabelText(/^name$/i) as HTMLInputElement).value).toBe("");
  });

  it("creates a class before the initial list finishes loading", async () => {
    let resolveInitial: (v: unknown) => void;
    const initial = new Promise((resolve) => (resolveInitial = resolve));
    const fetchMock = vi
      .fn()
      .mockImplementationOnce(() => initial)
      .mockResolvedValueOnce({ ok: true, status: 201, json: async () => ({ id: "c3", name: "Physics", description: null }) });
    vi.stubGlobal("fetch", fetchMock);

    render(<TeacherDashboard />);
    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "Physics" } });
    fireEvent.click(screen.getByRole("button", { name: /create class/i }));

    await waitFor(() => expect(screen.getByText("Physics")).toBeInTheDocument());
    resolveInitial!({ ok: true, status: 200, json: async () => ({ classes: [] }) });
  });

  it("shows a generic error if creating a class throws a non-API error", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ classes: [] }) })
      .mockRejectedValueOnce(new Error("network down"));
    vi.stubGlobal("fetch", fetchMock);

    render(<TeacherDashboard />);
    await waitFor(() => expect(screen.getByText(/no classes yet/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: /create class/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/could not create the class/i));
  });

  it("shows an error if creating a class fails", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ classes: [] }) })
      .mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { code: "VALIDATION_ERROR", message: "Name is required" } }),
      });
    vi.stubGlobal("fetch", fetchMock);

    render(<TeacherDashboard />);
    await waitFor(() => expect(screen.getByText(/no classes yet/i)).toBeInTheDocument());

    fireEvent.change(screen.getByLabelText(/^name$/i), { target: { value: "X" } });
    fireEvent.click(screen.getByRole("button", { name: /create class/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent("Name is required"));
  });

  it("signs out and redirects to login", async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ classes: [] }) })
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => ({}) });
    vi.stubGlobal("fetch", fetchMock);

    render(<TeacherDashboard />);
    await waitFor(() => expect(screen.getByText(/no classes yet/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole("button", { name: /sign out/i }));
    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/"));
  });
});

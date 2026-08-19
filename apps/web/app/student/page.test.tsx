import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import StudentClassesPage from "./page";

afterEach(() => vi.restoreAllMocks());

describe("StudentClassesPage", () => {
  it("shows an empty state when there are no classes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true, status: 200, json: async () => ({ classes: [] }) }));
    render(<StudentClassesPage />);
    await waitFor(() => expect(screen.getByText(/no classes yet/i)).toBeInTheDocument());
  });

  it("renders each class with a link to its detail page", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({
          classes: [{ id: "class-1", name: "Biology 101", description: "Intro", teacherName: "Terry Teacher" }],
        }),
      })
    );
    render(<StudentClassesPage />);
    await waitFor(() => expect(screen.getByRole("link", { name: /biology 101/i })).toHaveAttribute(
      "href",
      "/student/classes/class-1"
    ));
  });

  it("shows a generic error when the failure isn't an ApiClientError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<StudentClassesPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/failed to load classes/i));
  });

  it("shows an error state with a retry button on failure", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        json: async () => ({ error: { code: "INTERNAL_ERROR", message: "Failed to load classes." } }),
      })
    );
    render(<StudentClassesPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/failed to load classes/i));
    expect(screen.getByRole("button", { name: /retry/i })).toBeInTheDocument();
  });
});

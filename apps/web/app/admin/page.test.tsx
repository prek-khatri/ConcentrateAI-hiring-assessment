import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import AdminPage from "./page";

const USERS = {
  users: [
    { id: "u-admin", email: "admin@x", name: "Ada", role: "admin", is_suspended: false },
    { id: "u-teacher", email: "terry@x", name: "Terry", role: "teacher", is_suspended: false },
    { id: "u-student", email: "sam@x", name: "Sam", role: "student", is_suspended: false },
    { id: "u-susp", email: "suzy@x", name: "Suzy", role: "student", is_suspended: true },
  ],
};

function routeData(url: string): unknown {
  if (url.endsWith("/api/admin/users")) return USERS;
  return {};
}

function stubFetchOk() {
  const fetchMock = vi.fn(async (url: string, opts: RequestInit = {}) => {
    const method = opts.method ?? "GET";
    const json = async () => routeData(String(url));
    if (method === "DELETE") return { ok: true, status: 204, json } as Response;
    return { ok: true, status: 200, json } as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

function called(fetchMock: ReturnType<typeof vi.fn>, urlEnd: string, method: string) {
  return fetchMock.mock.calls.some(
    ([url, opts]) => String(url).endsWith(urlEnd) && (opts?.method ?? "GET") === method
  );
}

afterEach(() => {
  vi.restoreAllMocks();
});

async function renderLoaded() {
  const fetchMock = stubFetchOk();
  render(<AdminPage />);
  await screen.findByText("Ada");
  return fetchMock;
}

describe("AdminPage", () => {
  it("renders users (active + suspended) after loading", async () => {
    await renderLoaded();
    expect(screen.getByText("terry@x")).toBeInTheDocument();
    expect(screen.getByText("Suspended")).toBeInTheDocument();
    expect(screen.getAllByText("Active").length).toBeGreaterThan(0);
  });

  it("creates a user from the form", async () => {
    const fetchMock = await renderLoaded();
    fireEvent.change(screen.getByLabelText("New user name"), { target: { value: "New Person" } });
    fireEvent.change(screen.getByLabelText("New user email"), { target: { value: "new@x" } });
    fireEvent.change(screen.getByLabelText("New user password"), { target: { value: "password123" } });
    fireEvent.change(screen.getByLabelText("New user role"), { target: { value: "teacher" } });
    fireEvent.click(screen.getByRole("button", { name: /add user/i }));
    await waitFor(() => expect(called(fetchMock, "/api/admin/users", "POST")).toBe(true));
  });

  it("changes a user's role", async () => {
    const fetchMock = await renderLoaded();
    fireEvent.change(screen.getByLabelText("Role for sam@x"), { target: { value: "teacher" } });
    await waitFor(() => expect(called(fetchMock, "/api/admin/users/u-student", "PATCH")).toBe(true));
  });

  it("suspends an active user and unsuspends a suspended one", async () => {
    const fetchMock = await renderLoaded();
    fireEvent.click(screen.getAllByRole("button", { name: /^suspend$/i })[0]);
    await waitFor(() => expect(called(fetchMock, "/api/admin/users/u-admin/suspend", "POST")).toBe(true));
    fireEvent.click(screen.getByRole("button", { name: /^unsuspend$/i }));
    await waitFor(() => expect(called(fetchMock, "/api/admin/users/u-susp/unsuspend", "POST")).toBe(true));
  });

  it("deletes a user", async () => {
    const fetchMock = await renderLoaded();
    fireEvent.click(screen.getAllByRole("button", { name: /^delete$/i })[0]);
    await waitFor(() => expect(called(fetchMock, "/api/admin/users/u-admin", "DELETE")).toBe(true));
  });

  it("shows the API error message when a request fails", async () => {
    const fetchMock = vi.fn(async (url: string, opts: RequestInit = {}) => {
      const method = opts.method ?? "GET";
      if (method === "POST" && String(url).endsWith("/api/admin/users")) {
        return {
          ok: false,
          status: 409,
          json: async () => ({ error: { code: "CONFLICT", message: "Email already in use" } }),
        } as Response;
      }
      return { ok: true, status: 200, json: async () => routeData(String(url)) } as Response;
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<AdminPage />);
    await screen.findByText("Ada");
    fireEvent.change(screen.getByLabelText("New user name"), { target: { value: "Dupe" } });
    fireEvent.change(screen.getByLabelText("New user email"), { target: { value: "admin@x" } });
    fireEvent.change(screen.getByLabelText("New user password"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /add user/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/email already in use/i));
  });

  it("shows a generic error when the network fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new Error("network down")));
    render(<AdminPage />);
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i));
  });
});

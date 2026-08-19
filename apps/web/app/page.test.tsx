import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

import LoginPage from "./page";

afterEach(() => {
  vi.restoreAllMocks();
  pushMock.mockClear();
});

describe("LoginPage", () => {
  it("renders email, password, and a google sign-in link", () => {
    render(<LoginPage />);
    expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/password/i)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /sign in with google/i })).toBeInTheDocument();
  });

  it("redirects to the role-specific dashboard on successful login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => ({ id: "1", name: "Sam", email: "student@example.com", role: "student" }),
      })
    );

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(pushMock).toHaveBeenCalledWith("/student"));
  });

  it("shows an error message on failed login", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: false,
        status: 401,
        json: async () => ({ error: { code: "UNAUTHORIZED", message: "Invalid email or password" } }),
      })
    );

    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "wrong" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));

    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/invalid email or password/i));
    expect(pushMock).not.toHaveBeenCalled();
  });

  it("shows a generic error when the failure isn't an ApiClientError", async () => {
    vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
    render(<LoginPage />);
    fireEvent.change(screen.getByLabelText(/email/i), { target: { value: "student@example.com" } });
    fireEvent.change(screen.getByLabelText(/password/i), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: /sign in/i }));
    await waitFor(() => expect(screen.getByRole("alert")).toHaveTextContent(/something went wrong/i));
  });

  it("uses NEXT_PUBLIC_API_URL for the Google sign-in link when it's set", async () => {
    vi.stubEnv("NEXT_PUBLIC_API_URL", "https://api.example.com");
    vi.resetModules();
    const { default: LoginPageWithEnv } = await import("./page");
    render(<LoginPageWithEnv />);
    expect(screen.getByRole("link", { name: /sign in with google/i })).toHaveAttribute(
      "href",
      "https://api.example.com/auth/google"
    );
  });
});

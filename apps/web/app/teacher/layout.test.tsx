import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

const pushMock = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: pushMock }) }));

import TeacherLayout from "./layout";

afterEach(() => vi.restoreAllMocks());

describe("TeacherLayout", () => {
  it("renders the top bar with a sign-out control and the page content", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: {} }) }));
    render(
      <TeacherLayout>
        <p>page content</p>
      </TeacherLayout>
    );
    expect(screen.getByText("page content")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /sign out/i })).toBeInTheDocument();
  });
});

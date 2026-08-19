import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

afterEach(() => vi.restoreAllMocks());

describe("RootLayout", () => {
  it("renders its children", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 401, json: async () => ({ error: {} }) }));
    const { default: RootLayout } = await import("./layout");
    render(
      <RootLayout>
        <p>page content</p>
      </RootLayout>
    );
    expect(screen.getByText("page content")).toBeInTheDocument();
  });
});

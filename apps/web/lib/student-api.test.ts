import { describe, it, expect, vi, afterEach } from "vitest";
import { studentApi } from "./student-api";

afterEach(() => vi.restoreAllMocks());

describe("studentApi", () => {
  it("submits new content via POST", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "s1", content: "answer", submitted_at: "2024-01-01", score: null, feedback: null }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await studentApi.submit("assignment-1", "answer");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/student/assignments/assignment-1/submission");
    expect(options.method).toBe("POST");
    expect(options.body).toBe(JSON.stringify({ content: "answer" }));
  });

  it("updates an existing submission via PATCH", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ id: "s1", content: "updated", submitted_at: "2024-01-01", score: null, feedback: null }),
    });
    vi.stubGlobal("fetch", fetchMock);
    await studentApi.updateSubmission("assignment-1", "updated");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toContain("/api/student/assignments/assignment-1/submission");
    expect(options.method).toBe("PATCH");
    expect(options.body).toBe(JSON.stringify({ content: "updated" }));
  });
});

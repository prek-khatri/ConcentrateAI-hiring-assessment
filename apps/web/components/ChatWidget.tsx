"use client";

import { useEffect, useState, type FormEvent } from "react";
import { authApi } from "@/lib/auth-api";
import { chatApi } from "@/lib/chat-api";
import { ApiClientError } from "@/lib/api";

type Message = { role: "user" | "assistant"; content: string };

export function ChatWidget() {
  const [authed, setAuthed] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    authApi
      .me()
      .then(() => setAuthed(true))
      .catch(() => setAuthed(false));
  }, []);

  async function handleSend(e: FormEvent) {
    e.preventDefault();
    if (!input.trim()) return;
    setError(null);
    const userMessage = input;
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    setPending(true);
    try {
      const { reply } = await chatApi.ask(userMessage);
      setMessages((prev) => [...prev, { role: "assistant", content: reply }]);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : "Something went wrong.");
    } finally {
      setPending(false);
    }
  }

  if (!authed) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="flex h-96 w-80 flex-col rounded-lg border bg-white shadow-lg">
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-medium">Assistant</span>
            <button onClick={() => setOpen(false)} aria-label="Close chat" className="text-gray-500">
              ×
            </button>
          </div>
          <div className="flex-1 overflow-y-auto p-3 text-sm">
            {messages.length === 0 ? (
              <p className="text-gray-500">Ask about your classes, assignments, or grades.</p>
            ) : (
              messages.map((m, i) => (
                <p key={i} className={m.role === "user" ? "mb-2 text-right" : "mb-2 text-left"}>
                  <span
                    className={`inline-block rounded px-2 py-1 ${
                      m.role === "user" ? "bg-black text-white" : "bg-gray-100"
                    }`}
                  >
                    {m.content}
                  </span>
                </p>
              ))
            )}
            {error ? (
              <p role="alert" className="text-red-600">
                {error}
              </p>
            ) : null}
          </div>
          <form onSubmit={handleSend} className="flex gap-2 border-t p-2">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 rounded border px-2 py-1 text-sm"
            />
            <button
              type="submit"
              disabled={pending}
              className="rounded bg-black px-3 py-1 text-sm text-white disabled:opacity-50"
            >
              Send
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="rounded-full bg-black px-4 py-3 text-sm text-white shadow-lg"
        >
          Chat
        </button>
      )}
    </div>
  );
}

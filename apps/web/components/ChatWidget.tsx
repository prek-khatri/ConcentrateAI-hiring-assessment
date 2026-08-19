"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { usePathname } from "next/navigation";
import { authApi } from "@/lib/auth-api";
import { chatApi } from "@/lib/chat-api";
import { ApiClientError } from "@/lib/api";

type Message = { role: "user" | "assistant"; content: string };

export function ChatWidget() {
  const pathname = usePathname();
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastUserId = useRef<string | null>(null);

  function clearConversation() {
    setMessages([]);
    setInput("");
    setError(null);
    setOpen(false);
  }

  // Re-checked on every navigation, not just once on mount: the root layout persists
  // across client-side route changes, so a fresh login redirect wouldn't otherwise
  // trigger a re-check and the widget could get stuck on the previous page's auth state.
  useEffect(() => {
    authApi
      .me()
      .then((user) => {
        const isChatRole = user.role === "teacher" || user.role === "student";
        setVisible(isChatRole);
        // Safety net for a different person landing here without ever tripping the
        // catch below (e.g. a stale cookie silently swapped for a new one) — the
        // common logout path is handled the moment it happens, in the catch.
        if (lastUserId.current !== null && lastUserId.current !== user.id) clearConversation();
        lastUserId.current = isChatRole ? user.id : null;
      })
      .catch(() => {
        setVisible(false);
        // Clear right when this tab becomes unauthenticated — i.e. the moment someone
        // signs out — rather than waiting for whoever logs in next to trigger it. The
        // widget is one persisting component instance for the whole tab, so its own
        // state otherwise survives a logout and the next person would see this chat.
        if (lastUserId.current !== null) clearConversation();
        lastUserId.current = null;
      });
  }, [pathname]);

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

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 right-4 z-50">
      {open ? (
        <div className="flex h-96 w-80 flex-col overflow-hidden rounded-xl bg-white shadow-2xl">
          <div className="flex flex-shrink-0 items-center justify-between bg-sidebar px-4 py-3.5">
            <div className="flex items-center gap-2">
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="oklch(0.75 0.1 255)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
              </svg>
              <span className="text-sm font-semibold text-white">Assistant</span>
            </div>
            <button
              onClick={() => setOpen(false)}
              aria-label="Close chat"
              className="flex h-[22px] w-[22px] items-center justify-center rounded-md text-sidebar-muted hover:text-white"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div className="flex flex-1 flex-col gap-2.5 overflow-y-auto p-3.5 text-sm">
            {messages.length === 0 ? (
              <p className="text-muted">Ask about your classes, assignments, or grades.</p>
            ) : (
              messages.map((m, i) => (
                <p key={i} className={m.role === "user" ? "self-end text-right" : "self-start text-left"}>
                  <span
                    className={`inline-block max-w-[85%] whitespace-pre-wrap rounded-xl px-3 py-2 text-[13px] leading-relaxed ${
                      m.role === "user"
                        ? "rounded-br-sm bg-accent text-white"
                        : "rounded-bl-sm bg-paper text-ink"
                    }`}
                  >
                    {m.content}
                  </span>
                </p>
              ))
            )}
            {error ? (
              <p role="alert" className="text-danger">
                {error}
              </p>
            ) : null}
          </div>
          <form onSubmit={handleSend} className="flex flex-shrink-0 gap-2 border-t border-line p-2.5">
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask a question..."
              className="flex-1 rounded-lg border border-line px-2.5 py-2 text-[13px] outline-none focus:border-accent"
            />
            <button
              type="submit"
              disabled={pending}
              aria-label="Send"
              className="flex h-[34px] w-[34px] flex-shrink-0 items-center justify-center rounded-lg bg-accent text-white disabled:opacity-50"
            >
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2L11 13" />
                <path d="M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </form>
        </div>
      ) : (
        <button
          onClick={() => setOpen(true)}
          aria-label="Chat"
          className="flex h-[52px] w-[52px] items-center justify-center rounded-full bg-accent shadow-lg shadow-accent/35"
        >
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.38 8.38 0 01-.9 3.8 8.5 8.5 0 01-7.6 4.7 8.38 8.38 0 01-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 01-.9-3.8 8.5 8.5 0 014.7-7.6 8.38 8.38 0 013.8-.9h.5a8.48 8.48 0 018 8v.5z" />
          </svg>
        </button>
      )}
    </div>
  );
}

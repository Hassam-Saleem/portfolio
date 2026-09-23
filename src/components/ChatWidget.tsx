"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { site, suggestedQuestions } from "@/lib/site";

interface SourceRef {
  source: string;
  docTitle: string;
  heading: string;
}

interface Msg {
  id: number;
  role: "user" | "assistant";
  content: string;
  sources?: SourceRef[];
  refused?: boolean;
  error?: string;
}

type Phase = "idle" | "thinking" | "answering";

/** Drop failed answers together with the question that produced them, so no orphaned question is left behind. */
function withoutFailed(msgs: Msg[]): Msg[] {
  return msgs.filter((m, i) => !m.error && !(m.role === "user" && msgs[i + 1]?.error));
}

const STALL_MS = 40_000; // no bytes for this long → treat the request as failed

export function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [phase, setPhase] = useState<Phase>("idle");
  const [stage, setStage] = useState("Searching my documents…");
  const [input, setInput] = useState("");

  const nextId = useRef(1);
  const abortRef = useRef<AbortController | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const launcherRef = useRef<HTMLButtonElement>(null);
  const busy = phase !== "idle";

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages, phase, open]);

  const wasOpen = useRef(false);
  useEffect(() => {
    if (open) inputRef.current?.focus();
    else if (wasOpen.current) launcherRef.current?.focus(); // the launcher remounts on close, so restore focus after render
    wasOpen.current = open;
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const close = () => setOpen(false);

  const patchLast = (patch: Partial<Msg> | ((m: Msg) => Partial<Msg>)) =>
    setMessages((prev) => {
      const copy = [...prev];
      const last = copy[copy.length - 1];
      if (last?.role === "assistant") copy[copy.length - 1] = { ...last, ...(typeof patch === "function" ? patch(last) : patch) };
      return copy;
    });

  const ask = useCallback(
    async (question: string, history: Msg[]) => {
      const q = question.trim();
      if (!q) return;

      const userMsg: Msg = { id: nextId.current++, role: "user", content: q };
      const botMsg: Msg = { id: nextId.current++, role: "assistant", content: "" };
      setMessages([...history, userMsg, botMsg]);
      setPhase("thinking");
      setStage("Searching my documents…");

      const controller = new AbortController();
      abortRef.current = controller;
      let stall: ReturnType<typeof setTimeout> | undefined;
      const armStall = () => {
        clearTimeout(stall);
        stall = setTimeout(() => controller.abort(), STALL_MS);
      };

      try {
        armStall();
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            messages: [...history, userMsg]
              .filter((m) => m.content)
              .map(({ role, content }) => ({ role, content })),
          }),
          signal: controller.signal,
        });

        if (!res.ok || !res.body) {
          const data = await res.json().catch(() => null);
          throw new Error(data?.error || `Request failed (${res.status}).`);
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        let finished = false;

        const handle = (line: string) => {
          const ev = JSON.parse(line);
          if (ev.type === "status") {
            setStage(ev.stage === "retrieving" ? "Searching my documents…" : "Writing an answer…");
          } else if (ev.type === "token") {
            setPhase("answering");
            patchLast((m) => ({ content: m.content + ev.text }));
          } else if (ev.type === "done") {
            finished = true;
            patchLast({ sources: ev.sources, refused: ev.refused });
          } else if (ev.type === "error") {
            throw new Error(ev.message);
          }
        };

        for (;;) {
          const { done, value } = await reader.read();
          if (done) break;
          armStall();
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) if (line.trim()) handle(line);
        }
        if (buffer.trim()) handle(buffer);
        if (!finished) throw new Error("The connection closed before the answer finished.");
      } catch (e) {
        const aborted = e instanceof DOMException && e.name === "AbortError";
        patchLast({
          error: aborted ? "This is taking too long. Please try again." : e instanceof Error ? e.message : "Something went wrong.",
        });
      } finally {
        clearTimeout(stall);
        setPhase("idle");
      }
    },
    [],
  );

  const submit = (text: string) => {
    if (busy) return;
    setInput("");
    void ask(text, withoutFailed(messages));
  };

  const retry = () => {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (!lastUser || busy) return;
    const idx = messages.lastIndexOf(lastUser);
    void ask(lastUser.content, withoutFailed(messages.slice(0, idx)));
  };

  return (
    <>
      {!open && (
        <button
          ref={launcherRef}
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={false}
          aria-controls="talk-panel"
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-50 flex items-center gap-2 rounded-full bg-linear-to-r from-brand to-brand-2 px-5 py-3 text-sm font-semibold text-brand-ink shadow-xl shadow-brand/30 transition hover:scale-[1.03] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand sm:right-6"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M21 15a2 2 0 0 1-2 2H8l-5 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Talk to {site.firstName}
        </button>
      )}

      {open && (
        <div
          id="talk-panel"
          role="dialog"
          aria-label={`Talk to ${site.firstName}`}
          className="animate-rise fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-50 flex h-[min(78dvh,620px)] flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl shadow-black/30 sm:inset-x-auto sm:right-6 sm:bottom-6 sm:w-[400px]"
        >
          <div className="flex items-center justify-between border-b border-line bg-linear-to-r from-brand-soft to-white px-4 py-3">
            <div>
              <p className="text-sm font-semibold">Talk to {site.firstName}</p>
              <p className="text-xs text-muted">AI assistant · answers from my own documents</p>
            </div>
            <button
              type="button"
              onClick={close}
              aria-label="Close chat"
              className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-bg hover:text-ink focus-visible:outline-2 focus-visible:outline-brand"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <path d="M6 6l12 12M18 6L6 18" />
              </svg>
            </button>
          </div>

          <div ref={listRef} role="log" aria-live="polite" className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {messages.length === 0 && (
              <div className="space-y-3">
                <p className="text-sm text-muted">
                  Hi! I&apos;m {site.firstName}. Ask me about my experience, projects or skills.
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestedQuestions.map((q) => (
                    <button
                      key={q}
                      type="button"
                      onClick={() => submit(q)}
                      className="rounded-full border border-line bg-bg px-3 py-1.5 text-left text-xs hover:border-brand"
                    >
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((m, i) => {
              const isLast = i === messages.length - 1;
              if (m.role === "user") {
                return (
                  <div key={m.id} className="flex justify-end">
                    <p className="max-w-[85%] whitespace-pre-wrap break-words rounded-2xl rounded-br-md bg-linear-to-br from-brand to-brand-2 px-3.5 py-2 text-sm text-brand-ink">
                      {m.content}
                    </p>
                  </div>
                );
              }
              const waiting = isLast && busy && !m.content;
              return (
                <div key={m.id} className="flex justify-start">
                  <div className="max-w-[90%] space-y-2">
                    {waiting ? (
                      <p className="flex items-center gap-2 rounded-2xl rounded-bl-md border border-line bg-bg px-3.5 py-2 text-sm text-muted" role="status">
                        <span className="flex gap-1" aria-hidden="true">
                          {[0, 1, 2].map((d) => (
                            <span key={d} data-dot className="h-1.5 w-1.5 rounded-full bg-muted" style={{ animation: `dot 1.2s ${d * 0.15}s infinite` }} />
                          ))}
                        </span>
                        {stage}
                      </p>
                    ) : (
                      (m.content || m.error) && (
                        <div
                          className={`whitespace-pre-wrap break-words rounded-2xl rounded-bl-md px-3.5 py-2 text-sm ${
                            m.error ? "bg-err-soft text-err-ink" : m.refused ? "bg-warn-soft text-warn-ink" : "border border-line bg-bg"
                          }`}
                        >
                          {m.content}
                          {isLast && phase === "answering" && <span className="ml-0.5 inline-block h-4 w-1.5 animate-pulse bg-current align-middle opacity-60" aria-hidden="true" />}
                          {m.error && (
                            <span className="block">
                              {m.content && <span className="block pt-1" />}
                              <span className="font-medium">Couldn&apos;t answer: </span>
                              {m.error}
                            </span>
                          )}
                        </div>
                      )
                    )}

                    {m.error && isLast && !busy && (
                      <button
                        type="button"
                        onClick={retry}
                        className="rounded-full border border-line bg-bg px-3 py-1.5 text-xs font-medium hover:border-brand"
                      >
                        Try again
                      </button>
                    )}

                    {!!m.sources?.length && (
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-xs text-muted">Retrieved from:</span>
                        {m.sources.map((s) => (
                          <span
                            key={`${s.source}|${s.heading}`}
                            title={`${s.docTitle} — ${s.heading}`}
                            className="max-w-full truncate rounded-md bg-brand-soft px-2 py-0.5 text-xs text-brand"
                          >
                            {s.source} · {s.heading.split(" > ").pop()}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              submit(input);
            }}
            className="flex gap-2 border-t border-line p-3"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={500}
              placeholder="Ask me anything…"
              aria-label={`Ask ${site.firstName} a question`}
              className="min-w-0 flex-1 rounded-full border border-line bg-bg px-4 py-2 text-base outline-none focus:border-brand"
            />
            <button
              type="submit"
              disabled={busy || !input.trim()}
              className="rounded-full bg-linear-to-r from-brand to-brand-2 px-4 py-2 text-sm font-semibold text-brand-ink disabled:opacity-40"
            >
              {busy ? "…" : "Send"}
            </button>
          </form>
        </div>
      )}
    </>
  );
}

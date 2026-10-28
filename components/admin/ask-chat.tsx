"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { MessagesSquare, SendHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { askTheShop } from "@/app/admin/assistant-actions";
import type { ChatTurn } from "@/lib/assistant/agent";
import { cn } from "@/lib/utils";

type Message = ChatTurn & { lookups?: string[]; failed?: boolean };

const EXAMPLES = [
  "Who hasn't been in for 60 days?",
  "Which services were most popular this month?",
  "Who are our top 5 customers by lifetime points?",
  "How much gift voucher credit is unspent?",
];

/**
 * "Ask the shop": a chat button at the bottom right of every admin page. It lives in the admin
 * layout, so the conversation stays while moving between pages.
 */
export function AskChat() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [draft, setDraft] = useState("");
  const [pending, startAsking] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  // Keeps the newest message in view, including the "Looking it up…" line.
  useEffect(() => {
    if (open) endRef.current?.scrollIntoView({ block: "end" });
  }, [open, messages, pending]);

  const close = () => {
    setOpen(false);
    toggleRef.current?.focus();
  };

  const ask = (question: string) => {
    const text = question.trim();
    if (!text || pending) return;
    // Failed answers aren't sent back: the model only sees real questions and answers.
    const history: ChatTurn[] = [...messages.filter((m) => !m.failed).map(({ role, text }) => ({ role, text })), { role: "user", text }];
    setMessages((m) => [...m, { role: "user", text }]);
    setDraft("");
    startAsking(async () => {
      const result = await askTheShop(history);
      setMessages((m) => [
        ...m,
        result.ok ? { role: "assistant", text: result.answer, lookups: result.lookups } : { role: "assistant", text: result.message, failed: true },
      ]);
    });
  };

  return (
    <>
      {open && (
        <section
          role="dialog"
          aria-label="Ask the shop"
          onKeyDown={(e) => e.key === "Escape" && close()}
          className="fixed right-4 bottom-22 z-40 flex h-[min(600px,calc(100dvh-7.5rem))] w-[min(420px,calc(100vw-2rem))] flex-col rounded-2xl border border-border bg-card shadow-2xl sm:right-6"
        >
          <header className="flex items-start justify-between gap-3 border-b border-border py-3 pr-2 pl-5">
            <div className="flex flex-col gap-0.5 pt-1">
              <h2 className="text-lg font-extrabold">Ask the shop</h2>
              <p className="text-xs text-muted-foreground">Looks up your customers, visits and gift vouchers. It can read, but never change anything.</p>
            </div>
            <Button type="button" variant="ghost" size="icon" onClick={close} aria-label="Close">
              <X className="size-5" />
            </Button>
          </header>

          <div className="flex flex-1 flex-col gap-4 overflow-y-auto px-5 py-4" aria-live="polite">
            {messages.length === 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-sm text-muted-foreground">Ask in your own words, or try one of these:</p>
                {EXAMPLES.map((q) => (
                  <Button key={q} type="button" variant="outline" size="sm" className="h-auto min-h-9 justify-start py-2 text-left whitespace-normal" onClick={() => ask(q)}>
                    {q}
                  </Button>
                ))}
              </div>
            )}
            {messages.map((m, i) => (
              <div key={i} className={cn("flex max-w-[90%] flex-col gap-1.5", m.role === "user" && "items-end self-end")}>
                <div
                  className={cn(
                    "rounded-2xl px-4 py-2.5 text-[15px] whitespace-pre-wrap",
                    m.role === "user" ? "bg-primary text-primary-foreground" : m.failed ? "bg-destructive/10 text-destructive" : "bg-secondary",
                  )}
                >
                  {m.text}
                </div>
                {/* What the agent looked up: the tool calls behind the answer. */}
                {m.lookups && m.lookups.length > 0 && <p className="px-1 text-xs text-muted-foreground">Looked up: {m.lookups.join(" · ")}</p>}
              </div>
            ))}
            {pending && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Spinner />
                Looking it up…
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form
            className="flex items-end gap-2 border-t border-border p-3"
            onSubmit={(e) => {
              e.preventDefault();
              ask(draft);
            }}
          >
            <Textarea
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  ask(draft);
                }
              }}
              placeholder="Ask a question"
              aria-label="Your question"
              maxLength={2000}
              rows={1}
              className="max-h-32 min-h-11"
            />
            <Button type="submit" size="icon" pending={pending} disabled={!draft.trim()} aria-label="Ask">
              <SendHorizontal />
            </Button>
          </form>
        </section>
      )}

      <button
        ref={toggleRef}
        type="button"
        onClick={() => (open ? close() : setOpen(true))}
        aria-expanded={open}
        aria-label={open ? "Close Ask the shop" : "Ask the shop"}
        title="Ask the shop"
        className="fixed right-4 bottom-4 z-40 flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform outline-none hover:scale-105 focus-visible:ring-3 focus-visible:ring-ring/50 sm:right-6 sm:bottom-6"
      >
        {open ? <X className="size-6" aria-hidden="true" /> : <MessagesSquare className="size-6" aria-hidden="true" />}
      </button>
    </>
  );
}

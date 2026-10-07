"use client";

import { useEffect, useRef, useState } from "react";
import { SendIcon, XIcon } from "@/components/icons";
import { Button, inputClass, Spinner } from "@/components/ui";
import { sendChat } from "@/lib/client/actions";
import { useFlowStore } from "@/lib/store/use-flow-store";

const SUGGESTIONS = [
  "Put email sending behind a queue",
  "Add a cache in front of the database",
  "Make it serverless and explain the trade-offs",
  "Show the checkout as a sequence diagram",
];

const BUSY_LABEL = {
  reading: "Reading file",
  extracting: "Reading PRD",
  planning: "Designing",
  patching: "Updating design",
  repairing: "Checking the design",
} as const;

export function ChatPanel() {
  const chat = useFlowStore((s) => s.project.chat);
  const busy = useFlowStore((s) => s.busy);
  const selection = useFlowStore((s) => s.selection);
  const nodes = useFlowStore((s) => s.project.plan?.nodes);
  const toggleSelection = useFlowStore((s) => s.toggleSelection);
  const clearSelection = useFlowStore((s) => s.clearSelection);
  const [text, setText] = useState("");
  const end = useRef<HTMLDivElement>(null);

  // Block body: newer browsers return a Promise from scrollIntoView, which React would treat as a cleanup.
  useEffect(() => {
    end.current?.scrollIntoView({ block: "end" });
  }, [chat.length, busy]);

  const submit = (value = text) => {
    const message = value.trim();
    if (!message || busy) return;
    setText("");
    void sendChat(message);
  };

  const label = (id: string) => nodes?.find((n) => n.id === id)?.label ?? id;

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
        {chat.length === 0 && (
          <div className="space-y-3 pt-2">
            <p className="text-sm text-muted">
              Describe your app to start, or ask for changes once a design exists. Click components in the diagram
              to point at them.
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setText(s)}
                  className="rounded-full border border-line bg-panel px-3 py-1 text-xs text-muted hover:border-accent hover:text-fg"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}
        {chat.map((m) => (
          <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex"}>
            <p
              className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2 text-sm ${
                m.role === "user"
                  ? "bg-accent text-accent-fg"
                  : m.tone === "error"
                    ? "bg-danger-soft text-danger"
                    : "bg-subtle"
              }`}
            >
              {m.text}
            </p>
          </div>
        ))}
        {busy && (
          <p className="flex items-center gap-2 text-sm text-muted" role="status">
            <Spinner /> {BUSY_LABEL[busy.kind]}
            {busy.detail ? `: ${busy.detail}` : "…"}
          </p>
        )}
        <div ref={end} />
      </div>

      <div className="space-y-2 border-t border-line bg-panel p-3">
        {selection.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs text-muted">Selected:</span>
            {selection.map((id) => (
              <button
                key={id}
                type="button"
                onClick={() => toggleSelection(id)}
                className="inline-flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-xs"
              >
                {label(id)} <XIcon className="size-3" />
              </button>
            ))}
            <button type="button" onClick={clearSelection} className="text-xs text-muted hover:text-fg">
              Clear
            </button>
          </div>
        )}
        <form
          className="flex items-end gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <textarea
            aria-label="Message"
            rows={2}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={selection.length ? "What should change about the selection?" : "Ask for a change…"}
            className={`${inputClass} max-h-40 min-h-11 flex-1 resize-none`}
          />
          <Button type="submit" variant="primary" aria-label="Send" disabled={!text.trim() || !!busy} className="h-11 w-11 px-0">
            <SendIcon />
          </Button>
        </form>
      </div>
    </div>
  );
}

"use client";

import { LogoIcon } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { applyTemplate } from "@/lib/client/actions";
import { TEMPLATES } from "@/lib/plan/templates";
import { useFlowStore } from "@/lib/store/use-flow-store";

export function EmptyState() {
  return (
    <div className="absolute inset-0 overflow-y-auto">
      <div className="mx-auto flex max-w-2xl flex-col items-center gap-5 px-6 py-12 text-center">
        <span className="flex size-12 items-center justify-center rounded-2xl bg-accent-soft text-accent">
          <LogoIcon className="size-6" />
        </span>
        <h2 className="text-lg font-semibold">Plan your system</h2>
        <ol className="space-y-2 text-left text-sm text-muted">
          <li>
            <b className="text-fg">1.</b> Upload a PRD, start from a template, or list features and describe the user flow.
          </li>
          <li>
            <b className="text-fg">2.</b> Generate: Flow picks the simplest design that fits and maps every user story to
            the components that deliver it.
          </li>
          <li>
            <b className="text-fg">3.</b> Refine it in chat or drag things around on the canvas, then export to Markdown,
            PDF, PNG, SVG, draw.io, JSON or CSV.
          </li>
        </ol>
        <div className="w-full space-y-2 pt-2 text-left">
          <p className="text-sm font-medium">Start from a template</p>
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => applyTemplate(t)}
                className="rounded-xl border border-line bg-panel p-3 text-left transition hover:border-accent"
              >
                <span className="block text-sm font-medium">{t.name}</span>
                <span className="block text-xs text-muted">{t.description}</span>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

const LABELS = {
  repairing: "Checking the design",
  patching: "Updating the design",
  planning: "Designing your system",
} as const;

/** Shown over the diagram while the planner works; PRD reading has its own indicator. */
export function BusyOverlay() {
  const busy = useFlowStore((s) => s.busy);
  if (!busy || busy.kind === "reading" || busy.kind === "extracting") return null;
  return (
    <div className="absolute inset-0 z-20 flex items-center justify-center bg-bg/60 backdrop-blur-[1px]">
      <div className="flex max-w-sm items-center gap-3 rounded-xl border border-line bg-panel px-4 py-3 shadow-lg" role="status">
        <Spinner className="text-accent" />
        <div className="min-w-0">
          <p className="text-sm font-medium">{LABELS[busy.kind]}</p>
          {busy.detail && <p className="truncate text-xs text-muted">{busy.detail}</p>}
        </div>
      </div>
    </div>
  );
}

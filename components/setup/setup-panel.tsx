"use client";

import { useRef, useState, type DragEvent } from "react";
import { FileIcon, SparkIcon, UploadIcon, XIcon } from "@/components/icons";
import { Button, Field, inputClass, Notice, Spinner } from "@/components/ui";
import { applyTemplate, generate, uploadPrd } from "@/lib/client/actions";
import { PRIORITY_LABEL } from "@/lib/export/stories-csv";
import { TEMPLATES } from "@/lib/plan/templates";
import {
  DESIGN_TYPES,
  DiagramKind,
  type RequestedDesignType,
} from "@/lib/schema/flow-plan";
import { PRD_ACCEPT } from "@/lib/schema/prd";
import { useFlowStore } from "@/lib/store/use-flow-store";

const DESIGN_LABELS: Record<RequestedDesignType, string> = {
  auto: "Auto (simplest fit)",
  monolith: "Monolith",
  "modular-monolith": "Modular monolith",
  microservices: "Microservices",
  serverless: "Serverless",
  "event-driven": "Event-driven",
  layered: "Layered (n-tier)",
  hexagonal: "Hexagonal (ports & adapters)",
  cqrs: "CQRS",
  "client-server": "Client–server",
  jamstack: "Jamstack",
};

const DIAGRAM_LABELS: Record<DiagramKind, string> = {
  architecture: "System architecture",
  "user-flow": "User flow",
  sequence: "Sequence diagram",
  erd: "Data model (ERD)",
  state: "State machine",
};

function PrdUpload() {
  const prdName = useFlowStore((s) => s.project.prdName);
  const brief = useFlowStore((s) => s.project.brief);
  const busy = useFlowStore((s) => s.busy);
  const input = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const reading = busy?.kind === "reading" || busy?.kind === "extracting";

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    setDragging(false);
    const file = event.dataTransfer.files[0];
    if (file && !busy) void uploadPrd(file);
  };

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Product requirements (PRD)</h2>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-xl border border-dashed p-4 text-center transition ${
          dragging ? "border-accent bg-accent-soft" : "border-line bg-subtle/60"
        }`}
      >
        {reading ? (
          <p className="flex items-center justify-center gap-2 text-sm text-muted">
            <Spinner />
            {busy?.kind === "reading" ? "Reading" : "Extracting requirements from"} {busy?.detail}…
          </p>
        ) : prdName ? (
          <div className="flex items-center gap-3 text-left">
            <FileIcon className="size-5 shrink-0 text-accent" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{prdName}</p>
              <p className="text-xs text-muted">
                {brief
                  ? `${brief.features.length} features · ${brief.userStories.length} stories · ${brief.personas.length} personas`
                  : "Not analysed"}
              </p>
            </div>
            <Button variant="ghost" onClick={() => input.current?.click()} disabled={!!busy}>
              Replace
            </Button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={!!busy}
            className="flex w-full flex-col items-center gap-1.5 text-sm"
          >
            <UploadIcon className="size-5 text-accent" />
            <span className="font-medium">Drop a PRD or browse</span>
            <span className="text-xs text-muted">Markdown, text, PDF (≤ 3 MB) or Word</span>
          </button>
        )}
        <input
          ref={input}
          type="file"
          accept={PRD_ACCEPT}
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (file) void uploadPrd(file);
          }}
        />
      </div>
      {brief && brief.openQuestions.length > 0 && (
        <details className="rounded-lg bg-warn-soft px-3 py-2 text-sm">
          <summary className="cursor-pointer font-medium text-warn">
            {brief.openQuestions.length} open question{brief.openQuestions.length === 1 ? "" : "s"} in the PRD
          </summary>
          <ul className="mt-2 list-disc space-y-1 pl-5 text-fg">
            {brief.openQuestions.map((q) => (
              <li key={q}>{q}</li>
            ))}
          </ul>
        </details>
      )}
    </section>
  );
}

function ParamForm() {
  const form = useFlowStore((s) => s.project.form);
  const setForm = useFlowStore((s) => s.setForm);

  return (
    <section className="space-y-4">
      <Field label="Template" hint="Fills the form">
        <select
          className={inputClass}
          value=""
          onChange={(e) => {
            const template = TEMPLATES.find((t) => t.id === e.target.value);
            if (template) applyTemplate(template);
          }}
        >
          <option value="">Start from a template…</option>
          {TEMPLATES.map((t) => (
            <option key={t.id} value={t.id}>
              {t.name}: {t.description}
            </option>
          ))}
        </select>
      </Field>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
        <Field label="System design">
          <select
            className={inputClass}
            value={form.designType}
            onChange={(e) => setForm({ designType: e.target.value as RequestedDesignType })}
          >
            {(["auto", ...DESIGN_TYPES] as const).map((t) => (
              <option key={t} value={t}>
                {DESIGN_LABELS[t]}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Diagram">
          <select
            className={inputClass}
            value={form.diagramKind}
            onChange={(e) => setForm({ diagramKind: e.target.value as DiagramKind })}
          >
            {DiagramKind.options.map((k) => (
              <option key={k} value={k}>
                {DIAGRAM_LABELS[k]}
              </option>
            ))}
          </select>
        </Field>
      </div>

      <Field label="Features" hint="One per line">
        <textarea
          className={`${inputClass} min-h-24 resize-y`}
          value={form.features}
          placeholder={"Email sign-up\nSubscription billing\nTeam workspaces"}
          onChange={(e) => setForm({ features: e.target.value })}
        />
      </Field>

      <Field label="User flow">
        <textarea
          className={`${inputClass} min-h-24 resize-y`}
          value={form.flowDescription}
          placeholder="A visitor signs up, verifies their email, picks a plan and pays…"
          onChange={(e) => setForm({ flowDescription: e.target.value })}
        />
      </Field>

      <Field label="Constraints" hint="Optional">
        <textarea
          className={`${inputClass} min-h-16 resize-y`}
          value={form.constraints}
          placeholder="Under 1k users, 2 developers, low budget, EU data residency"
          onChange={(e) => setForm({ constraints: e.target.value })}
        />
      </Field>

      {form.userStories.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">
            User stories <span className="font-normal text-muted">({form.userStories.length})</span>
          </p>
          <ul className="space-y-1.5">
            {form.userStories.map((story) => (
              <li key={story.id} className="flex items-start gap-2 rounded-lg border border-line bg-panel px-3 py-2">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{story.title}</p>
                  <p className="text-xs text-muted">
                    {PRIORITY_LABEL[story.priority]} · As a {story.persona}, I want {story.want}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label={`Remove story ${story.title}`}
                  className="rounded p-1 text-muted hover:bg-subtle hover:text-fg"
                  onClick={() => setForm({ userStories: form.userStories.filter((s) => s.id !== story.id) })}
                >
                  <XIcon className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export function SetupPanel({ onGenerated }: { onGenerated: () => void }) {
  const busy = useFlowStore((s) => s.busy);
  const notice = useFlowStore((s) => s.notice);
  const hasPlan = useFlowStore((s) => !!s.project.plan);
  const hasPrd = useFlowStore((s) => !!s.prd);
  const hasBrief = useFlowStore((s) => !!s.project.brief);
  const planning = busy?.kind === "planning" || busy?.kind === "repairing";

  const run = async (includePrd: boolean) => {
    if (await generate({ includePrd })) onGenerated();
  };

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4">
        <PrdUpload />
        {notice && <Notice tone={notice.tone}>{notice.text}</Notice>}
        <ParamForm />
      </div>
      <div className="space-y-2 border-t border-line bg-panel p-4">
        <Button variant="primary" className="w-full" disabled={!!busy} onClick={() => run(!hasBrief && hasPrd)}>
          {planning ? <Spinner /> : <SparkIcon />}
          {planning ? "Designing…" : hasPlan ? "Regenerate design" : "Generate design"}
        </Button>
        {hasPrd && hasBrief && (
          <button
            type="button"
            disabled={!!busy}
            onClick={() => run(true)}
            className="w-full text-center text-xs text-muted underline-offset-2 hover:text-fg hover:underline disabled:opacity-50"
          >
            Generate from the full PRD instead (slower, uses more tokens)
          </button>
        )}
      </div>
    </div>
  );
}

"use client";

import { useRef, useState } from "react";
import { DownloadIcon } from "@/components/icons";
import { Spinner } from "@/components/ui";
import { download, fileSlug, printHtml, svgToPng } from "@/lib/client/files";
import { toDrawio } from "@/lib/export/drawio";
import { fromJson, toJson } from "@/lib/export/json";
import { toMarkdown } from "@/lib/export/markdown";
import { toReportHtml } from "@/lib/export/report-html";
import { toStoriesCsv } from "@/lib/export/stories-csv";
import { validatePlan } from "@/lib/plan/validate-plan";
import { resolveLayout, type SavedPositions } from "@/lib/render/layout";
import { renderSvg } from "@/lib/render/render-svg";
import { toMermaid } from "@/lib/render/to-mermaid";
import type { FlowPlan } from "@/lib/schema/flow-plan";
import { useFlowStore } from "@/lib/store/use-flow-store";

type Format = "md" | "pdf" | "png" | "svg" | "drawio" | "mmd" | "csv" | "json";

const FORMATS: { id: Format; label: string; hint: string }[] = [
  { id: "md", label: "Markdown", hint: "Report with diagram" },
  { id: "pdf", label: "PDF", hint: "Print-ready report" },
  { id: "png", label: "PNG image", hint: "Diagram, 2×" },
  { id: "svg", label: "SVG image", hint: "Diagram, vector" },
  { id: "drawio", label: "draw.io", hint: "Editable, keeps your layout" },
  { id: "mmd", label: "Mermaid", hint: "Diagram source" },
  { id: "csv", label: "User stories CSV", hint: "Jira, Linear, Sheets" },
  { id: "json", label: "JSON", hint: "Re-importable plan" },
];

async function exportPlan(plan: FlowPlan, format: Format, positions: SavedPositions): Promise<void> {
  const name = fileSlug(plan.title);
  // Exports always use the light theme so they read well on paper and in docs.
  const svg = () => renderSvg(toMermaid(plan), "default");
  switch (format) {
    case "md":
      return download(`${name}.md`, toMarkdown(plan), "text/markdown;charset=utf-8");
    case "drawio":
      return download(
        `${name}.drawio`,
        toDrawio(plan, await resolveLayout(plan, positions)),
        "application/vnd.jgraph.mxfile",
      );
    case "mmd":
      return download(`${name}.mmd`, toMermaid(plan));
    case "svg":
      return download(`${name}.svg`, await svg(), "image/svg+xml");
    case "png":
      return download(`${name}.png`, await svgToPng(await svg()));
    case "pdf":
      return printHtml(toReportHtml(plan, await svg()));
    case "json":
      return download(`${name}.json`, toJson(plan), "application/json");
    case "csv":
      // BOM so Excel opens the file as UTF-8.
      return download(`${name}-user-stories.csv`, `﻿${toStoriesCsv(plan)}`, "text/csv;charset=utf-8");
  }
}

export function ExportMenu() {
  const plan = useFlowStore((s) => s.project.plan);
  const layout = useFlowStore((s) => s.project.layout);
  const commitPlan = useFlowStore((s) => s.commitPlan);
  const setNotice = useFlowStore((s) => s.setNotice);
  const menu = useRef<HTMLDetailsElement>(null);
  const importInput = useRef<HTMLInputElement>(null);
  const [working, setWorking] = useState<Format | null>(null);

  const run = async (format: Format) => {
    if (!plan) return;
    setWorking(format);
    try {
      await exportPlan(plan, format, layout?.planId === plan.id ? layout.positions : {});
      if (menu.current) menu.current.open = false;
    } catch (error) {
      setNotice({ tone: "error", text: `Export failed: ${error instanceof Error ? error.message : String(error)}` });
    } finally {
      setWorking(null);
    }
  };

  return (
    <details ref={menu} className="relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg bg-accent px-3 text-sm font-medium text-accent-fg hover:opacity-90 [&::-webkit-details-marker]:hidden">
        <DownloadIcon /> <span className="hidden sm:inline">Export</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-64 overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-xl">
        {FORMATS.map((f) => (
          <button
            key={f.id}
            type="button"
            disabled={!plan || !!working}
            onClick={() => void run(f.id)}
            className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left text-sm hover:bg-subtle disabled:opacity-45"
          >
            <span className="font-medium">{f.label}</span>
            {working === f.id ? <Spinner className="text-accent" /> : <span className="text-xs text-muted">{f.hint}</span>}
          </button>
        ))}
        <div className="my-1 border-t border-line" />
        <button
          type="button"
          onClick={() => importInput.current?.click()}
          className="w-full px-3 py-2 text-left text-sm hover:bg-subtle"
        >
          Import plan JSON…
        </button>
        <input
          ref={importInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          onChange={async (e) => {
            const file = e.target.files?.[0];
            e.target.value = "";
            if (!file) return;
            try {
              const imported = fromJson(await file.text());
              commitPlan(imported, validatePlan(imported));
              if (menu.current) menu.current.open = false;
            } catch {
              setNotice({ tone: "error", text: `${file.name} isn't a valid Flow plan export.` });
            }
          }}
        />
      </div>
    </details>
  );
}

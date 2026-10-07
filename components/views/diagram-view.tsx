"use client";

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { ZoomInIcon, ZoomOutIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import { BusyOverlay, EmptyState } from "@/components/views/shared";
import { renderSvg } from "@/lib/render/render-svg";
import { nodeIdFromElementId, toMermaid } from "@/lib/render/to-mermaid";
import { useFlowStore } from "@/lib/store/use-flow-store";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function usePrefersDark(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const media = window.matchMedia(DARK_QUERY);
      media.addEventListener("change", onChange);
      return () => media.removeEventListener("change", onChange);
    },
    () => window.matchMedia(DARK_QUERY).matches,
    () => false,
  );
}

/** The Mermaid rendering of the plan: what the Markdown, SVG, PNG and PDF exports contain. */
export function MermaidView() {
  const plan = useFlowStore((s) => s.project.plan);
  const selection = useFlowStore((s) => s.selection);
  const toggleSelection = useFlowStore((s) => s.toggleSelection);
  const dark = usePrefersDark();
  const code = useMemo(() => (plan ? toMermaid(plan) : ""), [plan]);
  const [svg, setSvg] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const canvas = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!code) {
      setSvg("");
      return;
    }
    let cancelled = false;
    renderSvg(code, dark ? "dark" : "default").then(
      (result) => {
        if (cancelled) return;
        setSvg(result);
        setError(null);
      },
      (err: unknown) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      },
    );
    return () => {
      cancelled = true;
    };
  }, [code, dark]);

  useEffect(() => {
    canvas.current?.querySelectorAll<SVGGElement>("g.node").forEach((g) => {
      const id = nodeIdFromElementId(g.id);
      g.classList.toggle("is-selected", !!id && selection.includes(id));
    });
  }, [svg, selection]);

  return (
    <div className="relative min-h-0 flex-1">
      {plan ? (
        <>
          <div className="absolute inset-0 overflow-auto p-6">
            {error ? (
              <div className="mx-auto max-w-2xl space-y-2">
                <p className="text-sm text-danger">The diagram couldn&apos;t be drawn: {error}</p>
                <pre className="overflow-auto rounded-lg bg-subtle p-3 font-mono text-xs">{code}</pre>
              </div>
            ) : (
              <div
                ref={canvas}
                className="flow-diagram mx-auto w-fit min-w-full"
                style={{ zoom }}
                onClick={(event) => {
                  const node = (event.target as Element).closest("g.node");
                  const id = node && nodeIdFromElementId(node.id);
                  if (id && plan.nodes.some((n) => n.id === id)) toggleSelection(id);
                }}
                // Mermaid renders in strict security mode, which sanitizes all labels.
                dangerouslySetInnerHTML={{ __html: svg }}
              />
            )}
          </div>
          <div className="absolute bottom-3 right-3 flex gap-1 rounded-lg border border-line bg-panel p-1 shadow-sm">
            <Button variant="ghost" aria-label="Zoom out" className="h-8 w-8 px-0" onClick={() => setZoom((z) => Math.max(0.25, z - 0.25))}>
              <ZoomOutIcon />
            </Button>
            <button type="button" className="w-12 text-xs text-muted hover:text-fg" onClick={() => setZoom(1)} aria-label="Reset zoom">
              {Math.round(zoom * 100)}%
            </button>
            <Button variant="ghost" aria-label="Zoom in" className="h-8 w-8 px-0" onClick={() => setZoom((z) => Math.min(3, z + 0.25))}>
              <ZoomInIcon />
            </Button>
          </div>
        </>
      ) : (
        <EmptyState />
      )}
      <BusyOverlay />
    </div>
  );
}

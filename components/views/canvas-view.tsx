"use client";

import dynamic from "next/dynamic";
import { Button, Spinner } from "@/components/ui";
import { BusyOverlay, EmptyState } from "@/components/views/shared";
import { useFlowStore } from "@/lib/store/use-flow-store";

// React Flow and elk are client-only and large; load them with the canvas.
const FlowCanvas = dynamic(() => import("@/components/canvas/flow-canvas").then((m) => m.FlowCanvas), {
  ssr: false,
  loading: () => (
    <div className="absolute inset-0 flex items-center justify-center text-muted">
      <Spinner />
    </div>
  ),
});

export function CanvasView({ onShowMermaid }: { onShowMermaid: () => void }) {
  const plan = useFlowStore((s) => s.project.plan);

  return (
    <div className="relative min-h-0 flex-1">
      {!plan ? (
        <EmptyState />
      ) : plan.diagramKind === "sequence" ? (
        <div className="mx-auto flex max-w-md flex-col items-center gap-3 px-6 py-16 text-center">
          <p className="text-sm text-muted">
            Sequence diagrams show messages in time order, which the canvas can&apos;t represent. Use the Mermaid view, or
            ask in chat to turn this into an architecture diagram.
          </p>
          <Button onClick={onShowMermaid}>Open the Mermaid view</Button>
        </div>
      ) : (
        <FlowCanvas plan={plan} />
      )}
      <BusyOverlay />
    </div>
  );
}

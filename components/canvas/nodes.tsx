"use client";

import { Handle, Position, type Node, type NodeProps } from "@xyflow/react";
import { KIND_META } from "@/components/canvas/kinds";
import type { Direction } from "@/lib/render/to-mermaid";
import type { FlowNode } from "@/lib/schema/flow-plan";

export type ComponentNodeType = Node<{ node: FlowNode; direction: Direction }, "component">;
export type BoundaryNodeType = Node<{ label: string }, "boundary">;
export type CanvasNode = ComponentNodeType | BoundaryNodeType;

const handleClass = "!size-2.5 !border-2 !border-panel !bg-muted hover:!bg-accent";

export function ComponentNode({ data, selected }: NodeProps<ComponentNodeType>) {
  const { node, direction } = data;
  const meta = KIND_META[node.kind];
  const [target, source] = direction === "LR" ? [Position.Left, Position.Right] : [Position.Top, Position.Bottom];
  return (
    <div
      className={`flex min-h-16 flex-col justify-center rounded-xl border bg-panel px-3 py-2 shadow-sm transition ${
        selected ? "border-accent ring-2 ring-accent/30" : "border-line"
      }`}
      style={{ borderLeft: `4px solid ${meta.color}` }}
    >
      <Handle type="target" position={target} className={handleClass} />
      <span className="text-[10px] font-medium uppercase tracking-wide text-muted">{meta.label}</span>
      <span className="text-sm font-medium leading-snug text-fg">{node.label}</span>
      {node.tech && <span className="truncate text-xs text-muted">{node.tech}</span>}
      <Handle type="source" position={source} className={handleClass} />
    </div>
  );
}

export function BoundaryNode({ data, selected }: NodeProps<BoundaryNodeType>) {
  return (
    <div
      className={`h-full w-full rounded-2xl border-2 border-dashed bg-subtle/40 ${
        selected ? "border-accent" : "border-line"
      }`}
    >
      <div className="px-3 py-2 text-xs font-semibold text-muted">{data.label}</div>
    </div>
  );
}

export const NODE_TYPES = { component: ComponentNode, boundary: BoundaryNode };

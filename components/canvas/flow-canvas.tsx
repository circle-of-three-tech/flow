"use client";

import {
  Background,
  ConnectionMode,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Connection,
  type Edge,
  type OnSelectionChangeParams,
} from "@xyflow/react";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { Inspector, type InspectorTarget } from "@/components/canvas/inspector";
import { KIND_META, PALETTE_KINDS, uniqueSlug } from "@/components/canvas/kinds";
import { NODE_TYPES, type CanvasNode } from "@/components/canvas/nodes";
import { PlusIcon } from "@/components/icons";
import { groupKey, resolveLayout, type Layout, type SavedPositions } from "@/lib/render/layout";
import { directionFor, type Direction } from "@/lib/render/to-mermaid";
import { NodeKind, type FlowPlan } from "@/lib/schema/flow-plan";
import { useFlowStore } from "@/lib/store/use-flow-store";

const DRAG_TYPE = "application/x-flow-kind";
const EMPTY_POSITIONS: SavedPositions = {};

type Picked = { edges: string[]; groups: string[] };

function toCanvasNodes(
  plan: FlowPlan,
  layout: Layout,
  selection: string[],
  picked: Picked,
  direction: Direction,
): CanvasNode[] {
  const groups: CanvasNode[] = plan.groups.flatMap((g) => {
    const b = layout.groups[g.id];
    if (!b) return [];
    return [
      {
        id: groupKey(g.id),
        type: "boundary" as const,
        position: { x: b.x, y: b.y },
        data: { label: g.label },
        style: { width: b.width, height: b.height },
        selected: picked.groups.includes(g.id),
        zIndex: -1,
      },
    ];
  });
  const nodes: CanvasNode[] = plan.nodes.flatMap((n) => {
    const b = layout.nodes[n.id];
    if (!b) return [];
    return [
      {
        id: n.id,
        type: "component" as const,
        position: { x: b.x, y: b.y },
        data: { node: n, direction },
        style: { width: b.width },
        selected: selection.includes(n.id),
        ...(b.parent ? { parentId: groupKey(b.parent), extent: "parent" as const } : {}),
      },
    ];
  });
  // React Flow requires parents before their children.
  return [...groups, ...nodes];
}

function toCanvasEdges(plan: FlowPlan, picked: Picked): Edge[] {
  const ids = new Set(plan.nodes.map((n) => n.id));
  return plan.edges
    .filter((e) => ids.has(e.from) && ids.has(e.to))
    .map((e) => ({
      id: e.id,
      source: e.from,
      target: e.to,
      label: e.label,
      selected: picked.edges.includes(e.id),
      type: "smoothstep",
      animated: e.style === "async",
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: e.style === "data" ? { strokeWidth: 2.5 } : undefined,
      labelBgPadding: [6, 3] as [number, number],
      labelBgBorderRadius: 4,
    }));
}

function Palette({ onAdd, disabled }: { onAdd: (kind: NodeKind) => void; disabled: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="absolute left-3 top-3 z-10 flex max-h-[calc(100%-1.5rem)] flex-col rounded-xl border border-line bg-panel shadow-lg">
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="flex h-9 items-center gap-1.5 px-3 text-sm font-medium hover:text-accent"
      >
        <PlusIcon /> Add
      </button>
      {open && (
        <div aria-label="Add a component" className="flex w-36 flex-col gap-1 overflow-y-auto border-t border-line p-2">
          <p className="px-1 pb-1 text-[11px] text-muted">Drag onto the canvas or click</p>
          {PALETTE_KINDS.map((kind) => (
            <button
              key={kind}
              type="button"
              draggable={!disabled}
              disabled={disabled}
              onDragStart={(e) => {
                e.dataTransfer.setData(DRAG_TYPE, kind);
                e.dataTransfer.effectAllowed = "move";
              }}
              onClick={() => onAdd(kind)}
              className="flex cursor-grab items-center gap-2 rounded-md px-2 py-1 text-left text-xs hover:bg-subtle active:cursor-grabbing disabled:opacity-45"
            >
              <span className="size-2.5 shrink-0 rounded-sm" style={{ background: KIND_META[kind].color }} />
              {KIND_META[kind].label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function CanvasInner({ plan }: { plan: FlowPlan }) {
  const saved = useFlowStore((s) =>
    s.project.layout?.planId === plan.id ? s.project.layout.positions : EMPTY_POSITIONS,
  );
  const selection = useFlowStore((s) => s.selection);
  const busy = useFlowStore((s) => !!s.busy);
  const { editPlan, savePositions, resetLayout, setSelection } = useFlowStore.getState();
  const [nodes, setNodes, onNodesChange] = useNodesState<CanvasNode>([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const [target, setTarget] = useState<InspectorTarget | null>(null);
  const { screenToFlowPosition, fitView } = useReactFlow();
  const wrapper = useRef<HTMLDivElement>(null);
  const fittedPlan = useRef<string | null>(null);
  // Edge and group selection live only on the canvas; remembered so re-deriving keeps the inspector open.
  const pickedRef = useRef<Picked>({ edges: [], groups: [] });
  // A node added from the palette is selected once it exists on the canvas (layout is async).
  const pendingFocus = useRef<string | null>(null);
  const direction = directionFor(plan.diagramKind);

  // The plan is the source of truth: re-derive nodes and edges whenever it or the saved layout changes.
  useEffect(() => {
    let cancelled = false;
    resolveLayout(plan, saved).then((layout) => {
      if (cancelled) return;
      const focus = pendingFocus.current;
      if (focus && plan.nodes.some((n) => n.id === focus)) {
        pendingFocus.current = null;
        setSelection([focus]);
        setTarget({ type: "node", id: focus });
      }
      setNodes(toCanvasNodes(plan, layout, useFlowStore.getState().selection, pickedRef.current, direction));
      setEdges(toCanvasEdges(plan, pickedRef.current));
      if (fittedPlan.current !== plan.id) {
        fittedPlan.current = plan.id;
        requestAnimationFrame(() => void fitView({ padding: 0.15, duration: 200 }));
      }
    });
    return () => {
      cancelled = true;
    };
  }, [plan, saved, direction, setNodes, setEdges, fitView, setSelection]);

  // Selection made elsewhere (chat chips, stories view) shows on the canvas.
  useEffect(() => {
    setNodes((current) =>
      current.map((n) => (n.type === "component" ? { ...n, selected: selection.includes(n.id) } : n)),
    );
  }, [selection, setNodes]);

  const addNode = useCallback(
    (kind: NodeKind, position: { x: number; y: number }) => {
      const meta = KIND_META[kind];
      const id = uniqueSlug(meta.slug, [...plan.nodes.map((n) => n.id), ...plan.groups.map((g) => g.id)]);
      savePositions(plan.id, { [id]: { x: Math.round(position.x), y: Math.round(position.y) } });
      pendingFocus.current = id;
      editPlan({ upsertNodes: [{ id, label: meta.defaultLabel, kind, rationale: "" }] });
    },
    [plan, editPlan, savePositions],
  );

  const onDrop = (event: DragEvent) => {
    event.preventDefault();
    const kind = NodeKind.safeParse(event.dataTransfer.getData(DRAG_TYPE));
    if (!kind.success || busy) return;
    addNode(kind.data, screenToFlowPosition({ x: event.clientX, y: event.clientY }));
  };

  const addAtCenter = (kind: NodeKind) => {
    const rect = wrapper.current?.getBoundingClientRect();
    if (!rect) return;
    const center = screenToFlowPosition({ x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 });
    addNode(kind, { x: center.x - 80, y: center.y - 32 });
  };

  // Must be stable: React Flow re-fires onSelectionChange whenever the handler identity changes.
  const onSelectionChange = useCallback(
    ({ nodes: picked, edges: pickedEdges }: OnSelectionChangeParams<CanvasNode, Edge>) => {
      const components = picked.filter((n) => n.type === "component").map((n) => n.id);
      pickedRef.current = {
        edges: pickedEdges.map((e) => e.id),
        groups: picked.filter((n) => n.type === "boundary").map((n) => n.id.slice("group:".length)),
      };
      setSelection(components);
      const count = picked.length + pickedEdges.length;
      let next: InspectorTarget | null = null;
      if (count > 1) next = { type: "many", count };
      else if (pickedEdges[0]) next = { type: "edge", id: pickedEdges[0].id };
      else if (picked[0]?.type === "boundary") next = { type: "group", id: picked[0].id.slice("group:".length) };
      else if (picked[0]) next = { type: "node", id: picked[0].id };
      // Skip no-op updates so selection churn from re-deriving nodes doesn't re-render.
      setTarget((current) => (JSON.stringify(current) === JSON.stringify(next) ? current : next));
    },
    [setSelection],
  );

  const onConnect = (connection: Connection) => {
    const { source, target: to } = connection;
    if (!source || !to || source === to || source.startsWith("group:") || to.startsWith("group:")) return;
    const id = uniqueSlug(`${source}-to-${to}`, plan.edges.map((e) => e.id));
    editPlan({ upsertEdges: [{ id, from: source, to, style: "sync" }] });
  };

  return (
    <div ref={wrapper} className="absolute inset-0" onDragOver={(e) => e.preventDefault()} onDrop={onDrop}>
      <ReactFlow<CanvasNode, Edge>
        nodes={nodes}
        edges={edges}
        nodeTypes={NODE_TYPES}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        connectionMode={ConnectionMode.Loose}
        nodesDraggable={!busy}
        nodesConnectable={!busy}
        deleteKeyCode={busy ? null : ["Backspace", "Delete"]}
        colorMode="system"
        minZoom={0.2}
        maxZoom={2.5}
        proOptions={{ hideAttribution: true }}
        onNodeDragStop={(_, __, dragged) => {
          const positions: SavedPositions = {};
          for (const n of dragged) {
            const parent = n.parentId?.slice("group:".length);
            positions[n.id] = { x: Math.round(n.position.x), y: Math.round(n.position.y), ...(parent ? { parent } : {}) };
          }
          savePositions(plan.id, positions);
        }}
        onDelete={({ nodes: removed, edges: removedEdges }) => {
          editPlan({
            removeNodes: removed.filter((n) => n.type === "component").map((n) => n.id),
            removeGroups: removed.filter((n) => n.type === "boundary").map((n) => n.id.slice("group:".length)),
            removeEdges: removedEdges.map((e) => e.id),
          });
          setTarget(null);
        }}
        onSelectionChange={onSelectionChange}
      >
        <Background gap={20} size={1.2} />
        <Controls position="bottom-right" showInteractive={false}>
          <button
            type="button"
            title="Auto-layout"
            aria-label="Auto-layout"
            className="react-flow__controls-button !text-[10px] font-semibold"
            onClick={() => {
              resetLayout();
              fittedPlan.current = null;
            }}
          >
            ⇄
          </button>
        </Controls>
        <MiniMap pannable zoomable position="bottom-left" className="!hidden md:!block" />
      </ReactFlow>
      <Palette onAdd={addAtCenter} disabled={busy} />
      {target && <Inspector target={target} plan={plan} onClose={() => setTarget(null)} />}
    </div>
  );
}

export function FlowCanvas({ plan }: { plan: FlowPlan }) {
  return (
    <ReactFlowProvider>
      <CanvasInner plan={plan} />
    </ReactFlowProvider>
  );
}

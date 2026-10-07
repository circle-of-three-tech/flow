import ELK from "elkjs/lib/elk.bundled.js";
import type { ElkNode } from "elkjs/lib/elk-api";
import { directionFor } from "@/lib/render/to-mermaid";
import type { FlowNode, FlowPlan } from "@/lib/schema/flow-plan";

/** Position relative to the parent group (or the canvas when there is no parent). */
export type Box = { x: number; y: number; width: number; height: number; parent?: string };
export type Layout = { nodes: Record<string, Box>; groups: Record<string, Box> };

/** User-dragged positions. Keys are node ids, or `group:<id>` for groups. */
export type SavedPosition = { x: number; y: number; parent?: string };
export type SavedPositions = Record<string, SavedPosition>;

export const NODE_HEIGHT = 64;
export const GROUP_PADDING = { top: 44, side: 20 };

export const groupKey = (id: string) => `group:${id}`;

export function nodeSize(node: FlowNode): { width: number; height: number } {
  const text = Math.max(node.label.length, (node.tech?.length ?? 0) * 0.85);
  return { width: Math.round(Math.min(260, Math.max(150, text * 7.5 + 56))), height: NODE_HEIGHT };
}

const elk = new ELK();

/** Layered auto-layout with groups as compound nodes. */
export async function autoLayout(plan: FlowPlan): Promise<Layout> {
  const nodes = [...new Map(plan.nodes.map((n) => [n.id, n])).values()];
  const nodeIds = new Set(nodes.map((n) => n.id));
  const groupIds = new Set(plan.groups.map((g) => g.id));
  const grouped = (n: FlowNode) => !!n.group && groupIds.has(n.group);
  const leaf = (n: FlowNode): ElkNode => ({ id: n.id, ...nodeSize(n) });

  const graph: ElkNode = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": directionFor(plan.diagramKind) === "LR" ? "RIGHT" : "DOWN",
      "elk.hierarchyHandling": "INCLUDE_CHILDREN",
      "elk.layered.spacing.nodeNodeBetweenLayers": "90",
      "elk.spacing.nodeNode": "40",
      "elk.layered.nodePlacement.strategy": "BRANDES_KOEPF",
    },
    children: [
      ...nodes.filter((n) => !grouped(n)).map(leaf),
      ...plan.groups
        .filter((g) => nodes.some((n) => n.group === g.id))
        .map((g) => ({
          id: groupKey(g.id),
          layoutOptions: {
            "elk.padding": `[top=${GROUP_PADDING.top},left=${GROUP_PADDING.side},bottom=${GROUP_PADDING.side},right=${GROUP_PADDING.side}]`,
          },
          children: nodes.filter((n) => n.group === g.id).map(leaf),
        })),
    ],
    edges: [...new Map(plan.edges.map((e) => [e.id, e])).values()]
      .filter((e) => nodeIds.has(e.from) && nodeIds.has(e.to) && e.from !== e.to)
      .map((e) => ({ id: `edge:${e.id}`, sources: [e.from], targets: [e.to] })),
  };

  const result = await elk.layout(graph);
  const layout: Layout = { nodes: {}, groups: {} };
  const box = (n: ElkNode, parent?: string): Box => ({
    x: Math.round(n.x ?? 0),
    y: Math.round(n.y ?? 0),
    width: Math.round(n.width ?? 0),
    height: Math.round(n.height ?? 0),
    ...(parent ? { parent } : {}),
  });
  for (const child of result.children ?? []) {
    if (child.id.startsWith("group:")) {
      const id = child.id.slice("group:".length);
      layout.groups[id] = box(child);
      for (const member of child.children ?? []) layout.nodes[member.id] = box(member, id);
    } else {
      layout.nodes[child.id] = box(child);
    }
  }
  return layout;
}

/**
 * Pure. Overrides auto positions with saved ones (only while a node stays in the same
 * group), then grows groups so they still contain their members.
 */
export function applySaved(layout: Layout, saved: SavedPositions): Layout {
  const nodes: Layout["nodes"] = {};
  for (const [id, b] of Object.entries(layout.nodes)) {
    const s = saved[id];
    nodes[id] = s && s.parent === b.parent ? { ...b, x: s.x, y: s.y } : b;
  }
  const groups: Layout["groups"] = {};
  for (const [id, b] of Object.entries(layout.groups)) {
    const s = saved[groupKey(id)];
    const moved = s ? { ...b, x: s.x, y: s.y } : b;
    const members = Object.values(nodes).filter((n) => n.parent === id);
    const right = Math.max(0, ...members.map((m) => m.x + m.width)) + GROUP_PADDING.side;
    const bottom = Math.max(0, ...members.map((m) => m.y + m.height)) + GROUP_PADDING.side;
    groups[id] = { ...moved, width: Math.max(moved.width, right), height: Math.max(moved.height, bottom) };
  }
  return { nodes, groups };
}

export async function resolveLayout(plan: FlowPlan, saved: SavedPositions = {}): Promise<Layout> {
  return applySaved(await autoLayout(plan), saved);
}

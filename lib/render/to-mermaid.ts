import type {
  DiagramKind,
  EdgeStyle,
  FlowEdge,
  FlowNode,
  FlowPlan,
  NodeKind,
} from "@/lib/schema/flow-plan";

export type Direction = "TD" | "LR";
export type MermaidOptions = { direction?: Direction };

const DEFAULT_DIRECTION: Partial<Record<DiagramKind, Direction>> = {
  architecture: "LR",
  "user-flow": "TD",
};

const ENTITIES: Record<string, string> = {
  "#": "#35;",
  '"': "#34;",
  "&": "#38;",
  "<": "#60;",
  ">": "#62;",
  ";": "#59;",
  "|": "#124;",
  "`": "#96;",
};

/** Escapes text for Mermaid labels. Single pass, so an inserted "#35;" is never re-escaped. */
export function escapeLabel(text: string): string {
  return text
    .replace(/\s+/g, " ")
    .trim()
    .replace(/[#"&<>;|`]/g, (ch) => ENTITIES[ch] ?? ch);
}

/** Prefixed so ids never start with a digit or collide with keywords like "end"; "-" breaks arrow parsing. */
export function mermaidId(id: string): string {
  return `n_${id.replace(/-/g, "_")}`;
}

/** Maps a rendered SVG element id (e.g. "flow-mermaid-3-flowchart-n_orders_svc-2") back to a node id. */
export function nodeIdFromElementId(elementId: string): string | null {
  const match = /(?:^|-)n_([a-z0-9_]+)-\d+$/.exec(elementId);
  return match?.[1] ? match[1].replace(/_/g, "-") : null;
}

function groupId(id: string): string {
  return `g_${id.replace(/-/g, "_")}`;
}

function entityName(id: string): string {
  return id.replace(/-/g, "_").toUpperCase();
}

const SHAPES: Record<NodeKind, readonly [string, string]> = {
  client: ["([", "])"],
  service: ["[", "]"],
  function: ["[[", "]]"],
  datastore: ["[(", ")]"],
  queue: [">", "]"],
  external: ["{{", "}}"],
  gateway: ["[/", "\\]"],
  actor: ["((", "))"],
  decision: ["{", "}"],
  step: ["(", ")"],
};

const FLOW_ARROWS: Record<EdgeStyle, string> = { sync: "-->", async: "-.->", data: "==>" };
const SEQUENCE_ARROWS: Record<EdgeStyle, string> = { sync: "->>", async: "-)", data: "-->>" };

/** Reading direction for graph diagrams; shared by Mermaid, the canvas and draw.io. */
export function directionFor(kind: DiagramKind): Direction {
  return DEFAULT_DIRECTION[kind] ?? "TD";
}

export function toMermaid(plan: FlowPlan, options: MermaidOptions = {}): string {
  const edges = connectedEdges(plan);
  switch (plan.diagramKind) {
    case "sequence":
      return sequence(plan, edges);
    case "erd":
      return erd(plan, edges);
    case "state":
      return state(plan, edges);
    default:
      return flowchart(plan, edges, options.direction ?? DEFAULT_DIRECTION[plan.diagramKind] ?? "TD");
  }
}

// Mermaid silently invents nodes for unknown ids; validatePlan reports those edges instead.
function connectedEdges(plan: FlowPlan): FlowEdge[] {
  const ids = new Set(plan.nodes.map((n) => n.id));
  return plan.edges.filter((e) => ids.has(e.from) && ids.has(e.to));
}

function nodeDecl(node: FlowNode): string {
  const [open, close] = SHAPES[node.kind];
  return `${mermaidId(node.id)}${open}"${escapeLabel(node.label)}"${close}`;
}

function flowchart(plan: FlowPlan, edges: FlowEdge[], direction: Direction): string {
  const lines = [`flowchart ${direction}`];
  const groupIds = new Set(plan.groups.map((g) => g.id));
  const members = new Map<string, FlowNode[]>();
  for (const node of plan.nodes) {
    const key = node.group && groupIds.has(node.group) ? node.group : "";
    members.set(key, [...(members.get(key) ?? []), node]);
  }

  for (const node of members.get("") ?? []) lines.push(`  ${nodeDecl(node)}`);
  for (const group of plan.groups) {
    const nodes = members.get(group.id);
    if (!nodes?.length) continue;
    lines.push(`  subgraph ${groupId(group.id)}["${escapeLabel(group.label)}"]`);
    for (const node of nodes) lines.push(`    ${nodeDecl(node)}`);
    lines.push("  end");
  }
  for (const edge of edges) {
    const label = edge.label ? `|"${escapeLabel(edge.label)}"|` : "";
    lines.push(`  ${mermaidId(edge.from)} ${FLOW_ARROWS[edge.style]}${label} ${mermaidId(edge.to)}`);
  }
  return lines.join("\n");
}

function sequence(plan: FlowPlan, edges: FlowEdge[]): string {
  const lines = ["sequenceDiagram"];
  for (const node of plan.nodes) {
    const keyword = node.kind === "actor" ? "actor" : "participant";
    lines.push(`  ${keyword} ${mermaidId(node.id)} as ${escapeLabel(node.label)}`);
  }
  for (const edge of edges) {
    const arrow = SEQUENCE_ARROWS[edge.style];
    lines.push(`  ${mermaidId(edge.from)}${arrow}${mermaidId(edge.to)}: ${escapeLabel(edge.label ?? "")}`);
  }
  return lines.join("\n");
}

// The schema has no cardinality yet, so every relationship renders as one-to-many.
function erd(plan: FlowPlan, edges: FlowEdge[]): string {
  const lines = ["erDiagram"];
  for (const node of plan.nodes) lines.push(`  ${entityName(node.id)}`);
  for (const edge of edges) {
    const label = escapeLabel(edge.label ?? "relates to");
    lines.push(`  ${entityName(edge.from)} ||--o{ ${entityName(edge.to)} : "${label}"`);
  }
  return lines.join("\n");
}

function state(plan: FlowPlan, edges: FlowEdge[]): string {
  const lines = ["stateDiagram-v2"];
  for (const node of plan.nodes) {
    lines.push(`  state "${escapeLabel(node.label)}" as ${mermaidId(node.id)}`);
  }
  const targets = new Set(edges.map((e) => e.to));
  const starts = plan.nodes.filter((n) => !targets.has(n.id));
  for (const node of starts.length ? starts : plan.nodes.slice(0, 1)) {
    lines.push(`  [*] --> ${mermaidId(node.id)}`);
  }
  for (const edge of edges) {
    const label = edge.label ? ` : ${escapeLabel(edge.label)}` : "";
    lines.push(`  ${mermaidId(edge.from)} --> ${mermaidId(edge.to)}${label}`);
  }
  return lines.join("\n");
}

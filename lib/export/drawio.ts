import { escapeHtml } from "@/lib/export/report-html";
import type { Layout } from "@/lib/render/layout";
import type { EdgeStyle, FlowPlan, NodeKind } from "@/lib/schema/flow-plan";

const BASE = "whiteSpace=wrap;html=1;";

const NODE_STYLES: Record<NodeKind, string> = {
  service: `rounded=1;${BASE}fillColor=#dae8fc;strokeColor=#6c8ebf;`,
  client: `rounded=1;arcSize=40;${BASE}fillColor=#e1d5e7;strokeColor=#9673a6;`,
  function: `shape=process;${BASE}fillColor=#dae8fc;strokeColor=#6c8ebf;`,
  datastore: `shape=cylinder3;boundedLbl=1;size=10;${BASE}fillColor=#d5e8d4;strokeColor=#82b366;`,
  queue: `shape=parallelogram;perimeter=parallelogramPerimeter;size=0.12;${BASE}fillColor=#fff2cc;strokeColor=#d6b656;`,
  external: `shape=hexagon;perimeter=hexagonPerimeter2;size=0.12;${BASE}fillColor=#f5f5f5;strokeColor=#666666;`,
  gateway: `shape=trapezoid;perimeter=trapezoidPerimeter;size=0.12;${BASE}fillColor=#ffe6cc;strokeColor=#d79b00;`,
  actor: "shape=umlActor;verticalLabelPosition=bottom;verticalAlign=top;html=1;outlineConnect=0;",
  decision: `rhombus;${BASE}fillColor=#fff2cc;strokeColor=#d6b656;`,
  step: `rounded=1;${BASE}`,
};

const EDGE_STYLES: Record<EdgeStyle, string> = {
  sync: "",
  async: "dashed=1;",
  data: "strokeWidth=2;",
};

const GROUP_STYLE =
  "swimlane;startSize=26;rounded=1;html=1;fillColor=none;dashed=1;strokeColor=#999999;fontStyle=1;";

/** Escapes text for an XML attribute value. */
function attr(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/\n/g, "&#10;");
}

const nodeCell = (id: string) => `n-${id}`;
const groupCell = (id: string) => `g-${id}`;

function geometry(b: { x: number; y: number; width: number; height: number }): string {
  return `<mxGeometry x="${b.x}" y="${b.y}" width="${b.width}" height="${b.height}" as="geometry"/>`;
}

/**
 * draw.io / diagrams.net file (uncompressed mxfile XML). Positions come from the same
 * layout as the canvas, so manual arrangement is preserved.
 */
export function toDrawio(plan: FlowPlan, layout: Layout): string {
  const cells: string[] = ['<mxCell id="0"/>', '<mxCell id="1" parent="0"/>'];

  for (const group of plan.groups) {
    const b = layout.groups[group.id];
    if (!b) continue;
    cells.push(
      `<mxCell id="${attr(groupCell(group.id))}" value="${attr(escapeHtml(group.label))}" style="${GROUP_STYLE}" vertex="1" parent="1">${geometry(b)}</mxCell>`,
    );
  }

  const nodeIds = new Set<string>();
  for (const node of plan.nodes) {
    const b = layout.nodes[node.id];
    if (!b || nodeIds.has(node.id)) continue;
    nodeIds.add(node.id);
    const label = node.tech
      ? `<b>${escapeHtml(node.label)}</b><br><font style="font-size:10px">${escapeHtml(node.tech)}</font>`
      : escapeHtml(node.label);
    const parent = b.parent && layout.groups[b.parent] ? groupCell(b.parent) : "1";
    cells.push(
      `<mxCell id="${attr(nodeCell(node.id))}" value="${attr(label)}" style="${NODE_STYLES[node.kind]}" vertex="1" parent="${attr(parent)}">${geometry(b)}</mxCell>`,
    );
  }

  for (const edge of plan.edges) {
    if (!nodeIds.has(edge.from) || !nodeIds.has(edge.to)) continue;
    const style = `edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;endArrow=block;endFill=1;${EDGE_STYLES[edge.style]}`;
    cells.push(
      `<mxCell id="${attr(`e-${edge.id}`)}" value="${attr(escapeHtml(edge.label ?? ""))}" style="${style}" edge="1" parent="1" source="${attr(nodeCell(edge.from))}" target="${attr(nodeCell(edge.to))}"><mxGeometry relative="1" as="geometry"/></mxCell>`,
    );
  }

  return `<?xml version="1.0" encoding="UTF-8"?>
<mxfile host="Flow" type="device">
  <diagram id="${attr(plan.id)}" name="${attr(plan.title)}">
    <mxGraphModel grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="0" math="0" shadow="0">
      <root>
        ${cells.join("\n        ")}
      </root>
    </mxGraphModel>
  </diagram>
</mxfile>
`;
}

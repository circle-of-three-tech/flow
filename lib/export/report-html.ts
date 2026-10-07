import { PRIORITY_LABEL } from "@/lib/export/stories-csv";
import type { FlowPlan, Priority } from "@/lib/schema/flow-plan";

const PRIORITY_ORDER: Priority[] = ["must", "should", "could", "wont"];

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function list(items: string[], checkbox = false): string {
  const mark = checkbox ? "☐ " : "";
  return `<ul>${items.map((i) => `<li>${mark}${escapeHtml(i)}</li>`).join("")}</ul>`;
}

function table(headers: string[], rows: string[][]): string {
  const head = headers.map((h) => `<th>${escapeHtml(h)}</th>`).join("");
  const body = rows
    .map((r) => `<tr>${r.map((c) => `<td>${escapeHtml(c || "—")}</td>`).join("")}</tr>`)
    .join("");
  return `<table><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

/**
 * A standalone, print-ready HTML report (the PDF export prints it).
 * `svg` must come from Mermaid's strict-mode renderer, which sanitizes labels.
 */
export function toReportHtml(plan: FlowPlan, svg: string): string {
  const nodeLabel = new Map(plan.nodes.map((n) => [n.id, n.label]));
  const groupLabel = new Map(plan.groups.map((g) => [g.id, g.label]));
  const flowName = new Map(plan.flows.map((f) => [f.id, f.name]));
  const parts: string[] = [];

  parts.push(`<h1>${escapeHtml(plan.title)}</h1>`);
  if (plan.summary) parts.push(`<p class="lead">${escapeHtml(plan.summary)}</p>`);
  parts.push(
    `<p class="meta">Design: <b>${escapeHtml(plan.designType)}</b> · Diagram: <b>${escapeHtml(plan.diagramKind)}</b> · Version ${plan.version}</p>`,
  );
  if (plan.rationale) parts.push(`<h2>Design rationale</h2><p>${escapeHtml(plan.rationale)}</p>`);
  parts.push(`<h2>Diagram</h2><figure>${svg}</figure>`);

  if (plan.userStories.length) {
    const stories = [...plan.userStories]
      .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
      .map((s) => {
        const trace = [
          s.nodes.length ? `Implemented by: ${s.nodes.map((id) => nodeLabel.get(id) ?? id).join(", ")}` : "",
          s.flow ? `Flow: ${flowName.get(s.flow) ?? s.flow}` : "",
        ].filter(Boolean);
        return `<section class="story"><h3>${escapeHtml(s.title)} <span class="tag">${PRIORITY_LABEL[s.priority]}</span></h3>
<p>As a <b>${escapeHtml(s.persona)}</b>, I want ${escapeHtml(s.want)}, so that ${escapeHtml(s.benefit)}.</p>
${s.acceptanceCriteria.length ? list(s.acceptanceCriteria, true) : ""}
${trace.length ? `<p class="meta">${escapeHtml(trace.join(" · "))}</p>` : ""}</section>`;
      });
    parts.push(`<h2>User stories</h2>${stories.join("")}`);
  }

  if (plan.nodes.length) {
    parts.push(
      `<h2>Components</h2>${table(
        ["Component", "Kind", "Tech", "Group", "Why"],
        plan.nodes.map((n) => [
          n.label,
          n.kind,
          n.tech ?? "",
          n.group ? (groupLabel.get(n.group) ?? n.group) : "",
          n.rationale,
        ]),
      )}`,
    );
  }
  if (plan.flows.length) {
    const flows = plan.flows.map(
      (f) =>
        `<h3>${escapeHtml(f.name)}</h3><ol>${f.steps
          .map((s) => `<li><b>${escapeHtml(nodeLabel.get(s.node) ?? s.node)}</b>: ${escapeHtml(s.action)}</li>`)
          .join("")}</ol>`,
    );
    parts.push(`<h2>Flows</h2>${flows.join("")}`);
  }
  if (plan.risks.length) parts.push(`<h2>Risks and failure points</h2>${list(plan.risks)}`);
  if (plan.openQuestions.length) parts.push(`<h2>Open questions</h2>${list(plan.openQuestions, true)}`);

  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(plan.title)}</title>
<style>
  body { font: 14px/1.55 ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif; color: #18181b; background: #fff; max-width: 860px; margin: 32px auto; padding: 0 24px; }
  h1 { font-size: 26px; margin: 0 0 8px; } h2 { font-size: 18px; margin: 28px 0 10px; border-bottom: 1px solid #e4e4e7; padding-bottom: 4px; } h3 { font-size: 15px; margin: 16px 0 6px; }
  .lead { font-size: 15px; color: #3f3f46; } .meta { color: #71717a; font-size: 12px; }
  .tag { font-size: 11px; font-weight: 500; color: #4338ca; background: #eef2ff; border-radius: 4px; padding: 1px 6px; vertical-align: middle; }
  figure { margin: 0; } figure svg { max-width: 100%; height: auto; }
  table { border-collapse: collapse; width: 100%; font-size: 12.5px; } th, td { border: 1px solid #e4e4e7; padding: 5px 8px; text-align: left; vertical-align: top; } th { background: #f4f4f5; }
  ul { padding-left: 20px; } .story { break-inside: avoid; }
  @media print { body { margin: 0; } h2 { break-after: avoid; } figure { break-inside: avoid; } }
</style></head><body>
${parts.join("\n")}
</body></html>
`;
}

import type { FlowPlan, Priority } from "@/lib/schema/flow-plan";

export const PRIORITY_LABEL: Record<Priority, string> = {
  must: "Must have",
  should: "Should have",
  could: "Could have",
  wont: "Won't have",
};

const HEADERS = ["ID", "Summary", "Description", "Acceptance Criteria", "Priority", "Components", "Flow"];

// Quote every field (RFC 4180) and neutralise leading formula characters so spreadsheets don't execute them.
function field(value: string): string {
  const safe = /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

/** User stories as CSV, importable into Jira, Linear or a spreadsheet. */
export function toStoriesCsv(plan: FlowPlan): string {
  const nodeLabel = new Map(plan.nodes.map((n) => [n.id, n.label]));
  const flowName = new Map(plan.flows.map((f) => [f.id, f.name]));
  const rows = plan.userStories.map((s) => [
    s.id,
    s.title,
    `As a ${s.persona}, I want ${s.want}, so that ${s.benefit}.`,
    // "•" not "-": a leading "-" would trip the formula guard.
    s.acceptanceCriteria.map((c) => `• ${c}`).join("\n"),
    PRIORITY_LABEL[s.priority],
    s.nodes.map((id) => nodeLabel.get(id) ?? id).join(", "),
    s.flow ? (flowName.get(s.flow) ?? s.flow) : "",
  ]);
  return [HEADERS, ...rows].map((row) => row.map(field).join(",")).join("\r\n") + "\r\n";
}

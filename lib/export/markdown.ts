import { PRIORITY_LABEL } from "@/lib/export/stories-csv";
import { toMermaid } from "@/lib/render/to-mermaid";
import type { FlowPlan, Priority, UserStory } from "@/lib/schema/flow-plan";

const PRIORITY_ORDER: Priority[] = ["must", "should", "could", "wont"];

function storySection(story: UserStory, nodeLabel: Map<string, string>, flowName: Map<string, string>): string {
  const parts = [
    `### ${story.title} · ${PRIORITY_LABEL[story.priority]}`,
    `As a **${story.persona}**, I want ${story.want}, so that ${story.benefit}.`,
  ];
  if (story.acceptanceCriteria.length) {
    parts.push(`**Acceptance criteria**\n\n${story.acceptanceCriteria.map((c) => `- [ ] ${c}`).join("\n")}`);
  }
  const trace = [`**ID:** \`${story.id}\``];
  if (story.nodes.length) {
    trace.push(`**Implemented by:** ${story.nodes.map((id) => nodeLabel.get(id) ?? id).join(", ")}`);
  }
  if (story.flow) trace.push(`**Flow:** ${flowName.get(story.flow) ?? story.flow}`);
  parts.push(trace.join(" · "));
  return parts.join("\n\n");
}

function cell(text: string | undefined): string {
  const value = (text ?? "").replace(/\s+/g, " ").trim().replace(/\|/g, "\\|");
  return value || "—";
}

function table(headers: string[], rows: string[][]): string {
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(cell).join(" | ")} |`),
  ].join("\n");
}

export function toMarkdown(plan: FlowPlan): string {
  const nodeLabel = new Map(plan.nodes.map((n) => [n.id, n.label]));
  const groupLabel = new Map(plan.groups.map((g) => [g.id, g.label]));
  const sections: string[] = [`# ${plan.title}`];

  if (plan.summary) sections.push(plan.summary);
  sections.push(
    `**Design:** ${plan.designType} · **Diagram:** ${plan.diagramKind} · **Version:** ${plan.version}`,
  );
  if (plan.rationale) sections.push(`## Design rationale\n\n${plan.rationale}`);
  sections.push(["## Diagram", "", "```mermaid", toMermaid(plan), "```"].join("\n"));

  if (plan.userStories.length) {
    const flowName = new Map(plan.flows.map((f) => [f.id, f.name]));
    const stories = [...plan.userStories]
      .sort((a, b) => PRIORITY_ORDER.indexOf(a.priority) - PRIORITY_ORDER.indexOf(b.priority))
      .map((s) => storySection(s, nodeLabel, flowName));
    sections.push(["## User stories", ...stories].join("\n\n"));
  }

  if (plan.nodes.length) {
    const rows = plan.nodes.map((n) => [
      n.label,
      n.kind,
      n.tech ?? "",
      n.group ? (groupLabel.get(n.group) ?? n.group) : "",
      n.rationale,
    ]);
    sections.push(`## Components\n\n${table(["Component", "Kind", "Tech", "Group", "Why"], rows)}`);
  }

  if (plan.edges.length) {
    const rows = plan.edges.map((e) => [
      nodeLabel.get(e.from) ?? e.from,
      nodeLabel.get(e.to) ?? e.to,
      e.style,
      e.label ?? "",
    ]);
    sections.push(`## Connections\n\n${table(["From", "To", "Type", "Label"], rows)}`);
  }

  if (plan.flows.length) {
    const flows = plan.flows.map((flow) => {
      const steps = flow.steps.map(
        (step, i) => `${i + 1}. **${nodeLabel.get(step.node) ?? step.node}**: ${step.action}`,
      );
      return [`### ${flow.name}`, "", ...steps].join("\n");
    });
    sections.push(["## Flows", ...flows].join("\n\n"));
  }

  if (plan.risks.length) {
    sections.push(`## Risks and failure points\n\n${plan.risks.map((r) => `- ${r}`).join("\n")}`);
  }
  if (plan.openQuestions.length) {
    sections.push(`## Open questions\n\n${plan.openQuestions.map((q) => `- [ ] ${q}`).join("\n")}`);
  }

  return `${sections.join("\n\n")}\n`;
}

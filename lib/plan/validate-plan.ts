import type { FlowPlan } from "@/lib/schema/flow-plan";

export type PlanIssue = {
  level: "error" | "warning";
  code: string;
  message: string;
};

export const MAX_NODES = 25;

/**
 * Structural checks the schema can't express. Errors break rendering or references;
 * warnings flag violations of the planning principles in CLAUDE.md §2.
 */
export function validatePlan(plan: FlowPlan): PlanIssue[] {
  const issues: PlanIssue[] = [];
  const error = (code: string, message: string) => issues.push({ level: "error", code, message });
  const warn = (code: string, message: string) => issues.push({ level: "warning", code, message });

  const checkDuplicates = (what: string, ids: string[]) => {
    const seen = new Set<string>();
    for (const id of ids) {
      if (seen.has(id)) error("duplicate-id", `Duplicate ${what} id "${id}"`);
      seen.add(id);
    }
  };
  checkDuplicates("node", plan.nodes.map((n) => n.id));
  checkDuplicates("edge", plan.edges.map((e) => e.id));
  checkDuplicates("group", plan.groups.map((g) => g.id));
  checkDuplicates("flow", plan.flows.map((f) => f.id));
  checkDuplicates("user story", plan.userStories.map((s) => s.id));

  const nodes = new Map(plan.nodes.map((n) => [n.id, n]));
  const groupIds = new Set(plan.groups.map((g) => g.id));
  const flows = new Map(plan.flows.map((f) => [f.id, f]));

  for (const node of plan.nodes) {
    if (node.group && !groupIds.has(node.group)) {
      error("unknown-group", `Node "${node.id}" is in unknown group "${node.group}"`);
    }
  }

  const neighbours = new Map<string, Set<string>>();
  const link = (a: string, b: string) => neighbours.set(a, (neighbours.get(a) ?? new Set()).add(b));
  for (const edge of plan.edges) {
    const fromOk = nodes.has(edge.from);
    const toOk = nodes.has(edge.to);
    if (!fromOk) error("dangling-edge", `Edge "${edge.id}" starts at unknown node "${edge.from}"`);
    if (!toOk) error("dangling-edge", `Edge "${edge.id}" ends at unknown node "${edge.to}"`);
    if (fromOk && toOk) {
      link(edge.from, edge.to);
      link(edge.to, edge.from);
    }
  }

  for (const flow of plan.flows) {
    for (const step of flow.steps) {
      if (!nodes.has(step.node)) {
        error("unknown-flow-step", `Flow "${flow.id}" references unknown node "${step.node}"`);
      }
    }
  }

  for (const node of plan.nodes) {
    const linked = neighbours.get(node.id);
    if (!linked?.size) {
      warn("isolated-node", `Node "${node.id}" has no connections`);
      continue;
    }
    if (node.kind === "datastore") {
      const owners = [...linked].filter((id) => {
        const kind = nodes.get(id)?.kind;
        return kind === "service" || kind === "function";
      });
      if (owners.length > 1) {
        warn(
          "shared-datastore",
          `Datastore "${node.id}" is used by ${owners.join(", ")}; give it a single owner`,
        );
      }
    }
  }

  // Traceability: every story maps to components, and every component serves a story (principle 9).
  const covered = new Set<string>();
  for (const story of plan.userStories) {
    for (const id of story.nodes) {
      if (!nodes.has(id)) error("unknown-story-node", `User story "${story.id}" references unknown node "${id}"`);
      covered.add(id);
    }
    if (story.flow) {
      const flow = flows.get(story.flow);
      if (!flow) error("unknown-story-flow", `User story "${story.id}" references unknown flow "${story.flow}"`);
      for (const step of flow?.steps ?? []) covered.add(step.node);
    }
    if (!story.nodes.length) warn("unmapped-story", `User story "${story.id}" is not implemented by any component`);
    if (!story.acceptanceCriteria.length) {
      warn("no-acceptance-criteria", `User story "${story.id}" has no acceptance criteria`);
    }
  }
  if (plan.userStories.length) {
    for (const node of plan.nodes) {
      if (node.kind !== "actor" && !covered.has(node.id)) {
        warn("unjustified-node", `Node "${node.id}" serves no user story`);
      }
    }
  }

  if (plan.nodes.length > MAX_NODES) {
    warn(
      "too-many-nodes",
      `${plan.nodes.length} nodes exceeds ${MAX_NODES}; group into subgraphs or split the diagram`,
    );
  }

  return issues;
}

export function hasErrors(issues: PlanIssue[]): boolean {
  return issues.some((i) => i.level === "error");
}

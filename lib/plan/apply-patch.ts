import type { FlowNode, FlowPlan, PlanPatch } from "@/lib/schema/flow-plan";

export const EMPTY_PATCH: Omit<PlanPatch, "message"> = {
  meta: {},
  upsertNodes: [],
  removeNodes: [],
  upsertEdges: [],
  removeEdges: [],
  upsertGroups: [],
  removeGroups: [],
  upsertFlows: [],
  removeFlows: [],
  upsertStories: [],
  removeStories: [],
};

/** Replaces items in place by id and appends new ones; the last update for an id wins. */
function upsert<T extends { id: string }>(items: T[], updates: T[]): T[] {
  const byId = new Map(updates.map((u) => [u.id, u]));
  const existing = new Set(items.map((i) => i.id));
  return [
    ...items.map((i) => byId.get(i.id) ?? i),
    ...[...byId.values()].filter((u) => !existing.has(u.id)),
  ];
}

function withoutGroup(node: FlowNode): FlowNode {
  const { group: _removed, ...rest } = node;
  return rest;
}

/**
 * Pure and immutable. Removing a node cascades to its edges, flow steps and story
 * references, so the model only has to name the node.
 */
export function applyPatch(plan: FlowPlan, patch: Omit<PlanPatch, "message">): FlowPlan {
  const removed = {
    nodes: new Set(patch.removeNodes),
    edges: new Set(patch.removeEdges),
    groups: new Set(patch.removeGroups),
    flows: new Set(patch.removeFlows),
    stories: new Set(patch.removeStories),
  };

  const nodes = upsert(
    plan.nodes.filter((n) => !removed.nodes.has(n.id)),
    patch.upsertNodes,
  ).map((n) => (n.group && removed.groups.has(n.group) ? withoutGroup(n) : n));
  const nodeIds = new Set(nodes.map((n) => n.id));
  const goneNode = (id: string) => removed.nodes.has(id) && !nodeIds.has(id);

  const edges = upsert(
    plan.edges.filter((e) => !removed.edges.has(e.id) && !goneNode(e.from) && !goneNode(e.to)),
    patch.upsertEdges,
  );

  const groups = upsert(
    plan.groups.filter((g) => !removed.groups.has(g.id)),
    patch.upsertGroups,
  );

  const flows = upsert(
    plan.flows.filter((f) => !removed.flows.has(f.id)),
    patch.upsertFlows,
  ).map((f) => ({ ...f, steps: f.steps.filter((s) => !goneNode(s.node)) }));
  const flowIds = new Set(flows.map((f) => f.id));

  const userStories = upsert(
    plan.userStories.filter((s) => !removed.stories.has(s.id)),
    patch.upsertStories,
  ).map((s) => {
    const story = { ...s, nodes: s.nodes.filter((id) => !goneNode(id)) };
    if (story.flow && removed.flows.has(story.flow) && !flowIds.has(story.flow)) {
      const { flow: _removed, ...rest } = story;
      return rest;
    }
    return story;
  });

  return {
    ...plan,
    ...patch.meta,
    nodes,
    edges,
    groups,
    flows,
    userStories,
    version: plan.version + 1,
  };
}

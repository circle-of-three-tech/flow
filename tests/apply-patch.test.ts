import { describe, expect, it } from "vitest";
import { applyPatch, EMPTY_PATCH } from "@/lib/plan/apply-patch";
import { validatePlan } from "@/lib/plan/validate-plan";
import { makePlan } from "./fixtures/sample-plan";

describe("applyPatch", () => {
  it("bumps the version without mutating the input", () => {
    const plan = makePlan();
    const snapshot = structuredClone(plan);
    const next = applyPatch(plan, EMPTY_PATCH);
    expect(next.version).toBe(2);
    expect(plan).toEqual(snapshot);
  });

  it("replaces existing items in place and appends new ones", () => {
    const next = applyPatch(makePlan(), {
      ...EMPTY_PATCH,
      upsertNodes: [
        { id: "api", label: "Orders service", kind: "service", group: "backend", rationale: "Checkout" },
        { id: "cache", label: "Cache", kind: "datastore", group: "backend", rationale: "Fast reads" },
      ],
      upsertEdges: [{ id: "e6", from: "api", to: "cache", style: "data" }],
    });
    expect(next.nodes.map((n) => n.id)).toEqual(["user", "web", "api", "db", "jobs", "email", "cache"]);
    expect(next.nodes[2]?.label).toBe("Orders service");
    expect(next.edges.at(-1)?.id).toBe("e6");
  });

  it("cascades node removal to edges, flow steps and stories", () => {
    const next = applyPatch(makePlan(), { ...EMPTY_PATCH, removeNodes: ["email"] });
    expect(next.edges.some((e) => e.to === "email")).toBe(false);
    expect(next.flows[0]?.steps.map((s) => s.node)).toEqual(["web", "api"]);
    expect(next.userStories.find((s) => s.id === "order-receipt")?.nodes).toEqual(["jobs"]);
    expect(validatePlan(next).filter((i) => i.level === "error")).toEqual([]);
  });

  it("keeps a node that is removed and re-added in the same patch", () => {
    const next = applyPatch(makePlan(), {
      ...EMPTY_PATCH,
      removeNodes: ["db"],
      upsertNodes: [{ id: "db", label: "Orders DB (managed)", kind: "datastore", rationale: "Owned by Orders API" }],
    });
    expect(next.edges.some((e) => e.to === "db")).toBe(true);
    expect(next.nodes.find((n) => n.id === "db")?.label).toBe("Orders DB (managed)");
  });

  it("clears references to removed groups and flows", () => {
    const next = applyPatch(makePlan(), { ...EMPTY_PATCH, removeGroups: ["backend"], removeFlows: ["checkout"] });
    expect(next.nodes.some((n) => n.group)).toBe(false);
    expect(next.userStories.some((s) => s.flow)).toBe(false);
  });

  it("applies meta changes and story upserts", () => {
    const plan = makePlan();
    const story = plan.userStories[0];
    if (!story) throw new Error("fixture has stories");
    const next = applyPatch(plan, {
      ...EMPTY_PATCH,
      meta: { designType: "serverless", openQuestions: [] },
      upsertStories: [{ ...story, priority: "should" }],
      removeStories: ["order-receipt"],
    });
    expect(next.designType).toBe("serverless");
    expect(next.openQuestions).toEqual([]);
    expect(next.title).toBe(plan.title);
    expect(next.userStories).toEqual([{ ...story, priority: "should" }]);
  });
});

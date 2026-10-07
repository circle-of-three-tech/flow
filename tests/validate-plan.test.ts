import { describe, expect, it } from "vitest";
import { hasErrors, MAX_NODES, validatePlan } from "@/lib/plan/validate-plan";
import { PlanInput, type FlowNode } from "@/lib/schema/flow-plan";
import { makePlan } from "./fixtures/sample-plan";

const codes = (plan: ReturnType<typeof makePlan>) => validatePlan(plan).map((i) => i.code);

describe("validatePlan", () => {
  it("accepts the sample plan", () => {
    expect(validatePlan(makePlan())).toEqual([]);
  });

  it("flags dangling edges and unknown references as errors", () => {
    const plan = makePlan();
    plan.edges.push({ id: "bad", from: "api", to: "ghost", style: "sync" });
    plan.nodes.push({ id: "x", label: "X", kind: "service", group: "nowhere", rationale: "" });
    plan.flows[0]?.steps.push({ node: "missing", action: "?" });
    const issues = validatePlan(plan);
    expect(hasErrors(issues)).toBe(true);
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["dangling-edge", "unknown-group", "unknown-flow-step"]),
    );
  });

  it("flags duplicate ids", () => {
    const plan = makePlan();
    plan.edges.push({ id: "e1", from: "web", to: "api", style: "sync" });
    expect(codes(plan)).toContain("duplicate-id");
  });

  it("warns on isolated nodes and shared datastores", () => {
    const plan = makePlan();
    plan.nodes.push(
      { id: "lonely", label: "Lonely", kind: "service", rationale: "" },
      { id: "billing", label: "Billing", kind: "service", rationale: "" },
    );
    plan.edges.push({ id: "e6", from: "billing", to: "db", style: "data" });
    const issues = validatePlan(plan);
    expect(hasErrors(issues)).toBe(false);
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["isolated-node", "shared-datastore"]),
    );
  });

  it("errors on stories that reference unknown nodes or flows", () => {
    const plan = makePlan();
    const [first] = plan.userStories;
    if (!first) throw new Error("fixture has stories");
    plan.userStories.push({ ...first, id: "broken", nodes: ["ghost"], flow: "nowhere" });
    expect(codes(plan)).toEqual(expect.arrayContaining(["unknown-story-node", "unknown-story-flow"]));
  });

  it("warns on unmapped stories, missing criteria and components no story needs", () => {
    const plan = makePlan();
    const [first] = plan.userStories;
    if (!first) throw new Error("fixture has stories");
    plan.userStories.push({ ...first, id: "vague", nodes: [], flow: undefined, acceptanceCriteria: [] });
    plan.nodes.push({ id: "cache", label: "Cache", kind: "datastore", rationale: "" });
    plan.edges.push({ id: "e6", from: "api", to: "cache", style: "data" });
    const issues = validatePlan(plan);
    expect(hasErrors(issues)).toBe(false);
    expect(issues.map((i) => i.code)).toEqual(
      expect.arrayContaining(["unmapped-story", "no-acceptance-criteria", "unjustified-node"]),
    );
  });

  it("counts nodes in a story's flow as covered", () => {
    const plan = makePlan();
    plan.userStories = plan.userStories.map((s) => (s.id === "order-receipt" ? { ...s, nodes: ["jobs"] } : s));
    // "email" is still covered through the checkout flow's steps.
    expect(codes(plan)).not.toContain("unjustified-node");
  });

  it("warns when a diagram is too large", () => {
    const nodes: FlowNode[] = Array.from({ length: MAX_NODES + 1 }, (_, i) => ({
      id: `n${i}`,
      label: `Node ${i}`,
      kind: "step",
      rationale: "",
    }));
    expect(codes(makePlan({ nodes, edges: [], flows: [] }))).toContain("too-many-nodes");
  });
});

describe("PlanInput", () => {
  it("applies defaults", () => {
    expect(PlanInput.parse({ features: ["auth"] })).toEqual({
      designType: "auto",
      diagramKind: "architecture",
      features: ["auth"],
      flowDescription: "",
      constraints: "",
      userStories: [],
    });
  });

  it("requires features, a flow description, stories or a PRD", () => {
    expect(PlanInput.safeParse({}).success).toBe(false);
    expect(PlanInput.safeParse({ flowDescription: "User signs up" }).success).toBe(true);
    expect(PlanInput.safeParse({ prd: { format: "text", name: "prd.md", text: "# PRD" } }).success).toBe(true);
  });
});

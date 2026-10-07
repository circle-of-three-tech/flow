import { describe, expect, it } from "vitest";
import { strictJsonSchema, stripNulls } from "@/lib/ai/structured";
import { PlanDraft, PlanPatch, PrdBrief } from "@/lib/schema/flow-plan";
import { flowDraft } from "./fixtures/flow-app";

type Node = Record<string, unknown>;

function* objects(node: unknown): Generator<Node> {
  if (Array.isArray(node)) for (const n of node) yield* objects(n);
  else if (node && typeof node === "object") {
    const o = node as Node;
    if (o.properties) yield o;
    for (const v of Object.values(o)) yield* objects(v);
  }
}

describe("strictJsonSchema (OpenAI strict mode)", () => {
  it.each([
    ["PlanDraft", PlanDraft],
    ["PlanPatch", PlanPatch],
    ["PrdBrief", PrdBrief],
  ] as const)("%s: every object requires all its keys and forbids extras", (_, schema) => {
    const json = strictJsonSchema(schema);
    expect(json).not.toHaveProperty("$schema");
    const all = [...objects(json)];
    expect(all.length).toBeGreaterThan(0);
    for (const o of all) {
      expect(o.required).toEqual(Object.keys(o.properties as Node));
      expect(o.additionalProperties).toBe(false);
    }
  });

  it("turns optional fields into nullable ones", () => {
    const json = strictJsonSchema(PlanDraft) as Node;
    const node = ((json.properties as Node).nodes as Node).items as Node;
    expect((node.properties as Node).group).toMatchObject({ anyOf: [expect.any(Object), { type: "null" }] });
    expect((node.properties as Node).label).toMatchObject({ type: "string" });
  });
});

describe("stripNulls", () => {
  it("removes null keys deeply so the real schema sees absent optionals", () => {
    const withNulls = {
      ...flowDraft,
      nodes: flowDraft.nodes.map((n) => ({ group: null, tech: null, ...n })),
      edges: flowDraft.edges.map((e) => ({ label: null, ...e })),
    };
    expect(PlanDraft.safeParse(withNulls).success).toBe(false);
    expect(PlanDraft.parse(stripNulls(withNulls))).toEqual(flowDraft);
  });
});

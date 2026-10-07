import { describe, expect, it } from "vitest";
import { toPlanInput } from "@/lib/plan/form";
import { TEMPLATES } from "@/lib/plan/templates";
import { PlanInput } from "@/lib/schema/flow-plan";
import { DEFAULT_MODELS, MODEL_INFO, ModelId } from "@/lib/schema/models";
import { ExtractRequest, PlanRequest } from "@/lib/schema/requests";

describe("templates", () => {
  it.each(TEMPLATES)("$name produces valid planner input", (template) => {
    const input = PlanInput.parse(toPlanInput(template.form));
    expect(input.features.length).toBeGreaterThanOrEqual(4);
    expect(input.flowDescription).not.toBe("");
  });

  it("has unique ids", () => {
    expect(new Set(TEMPLATES.map((t) => t.id)).size).toBe(TEMPLATES.length);
  });
});

describe("model allow-list", () => {
  it("describes every model and defaults to allowed ones", () => {
    expect(Object.keys(MODEL_INFO).sort()).toEqual([...ModelId.options].sort());
    expect(ModelId.safeParse(DEFAULT_MODELS.plan).success).toBe(true);
    expect(ModelId.safeParse(DEFAULT_MODELS.extract).success).toBe(true);
  });

  it("accepts allowed models on requests and rejects anything else", () => {
    const input = { features: ["a"] };
    expect(PlanRequest.safeParse({ mode: "create", input, model: "openai/gpt-5.5" }).success).toBe(true);
    expect(PlanRequest.safeParse({ mode: "create", input, model: "some/expensive-model" }).success).toBe(false);
    expect(PlanRequest.safeParse({ mode: "create", input, model: "anthropic/claude-sonnet-5.5" }).success).toBe(false);
    const prd = { format: "text", name: "p.md", text: "x" };
    expect(ExtractRequest.safeParse({ prd, model: "openai/gpt-5.4-mini" }).success).toBe(true);
    expect(ExtractRequest.safeParse({ prd, model: "nope" }).success).toBe(false);
  });
});

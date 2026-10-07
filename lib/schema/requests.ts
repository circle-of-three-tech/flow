import { z } from "zod";
import { FlowPlan, PlanInput, Slug } from "@/lib/schema/flow-plan";
import { ModelId } from "@/lib/schema/models";
import { PrdDocument } from "@/lib/schema/prd";

export const ExtractRequest = z.object({ prd: PrdDocument, model: ModelId.optional() });
export type ExtractRequest = z.infer<typeof ExtractRequest>;

export const PlanRequest = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("create"), input: PlanInput, model: ModelId.optional() }),
  z.object({
    mode: z.literal("patch"),
    plan: FlowPlan,
    instruction: z.string().trim().min(1).max(4000),
    selection: z.array(Slug).max(50).default([]),
    model: ModelId.optional(),
  }),
]);
export type PlanRequest = z.input<typeof PlanRequest>;

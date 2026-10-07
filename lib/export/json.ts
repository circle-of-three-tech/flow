import { FlowPlan } from "@/lib/schema/flow-plan";

export function toJson(plan: FlowPlan): string {
  return `${JSON.stringify(plan, null, 2)}\n`;
}

/** Throws a ZodError (or SyntaxError) when the file is not a valid FlowPlan. */
export function fromJson(text: string): FlowPlan {
  return FlowPlan.parse(JSON.parse(text));
}

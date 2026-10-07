import type { PlanIssue } from "@/lib/plan/validate-plan";
import type { FlowPlan } from "@/lib/schema/flow-plan";

/** One line of the NDJSON stream returned by POST /api/plan. */
export type PlanEvent =
  | { type: "progress"; title?: string; nodes: number; edges: number; stories: number }
  | { type: "repairing"; count: number }
  | { type: "done"; plan: FlowPlan; issues: PlanIssue[]; message: string }
  | { type: "error"; error: string };

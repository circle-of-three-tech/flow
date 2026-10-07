import { generateText, streamText, type LanguageModel, type ModelMessage } from "ai";
import { MODELS } from "@/lib/ai/models";
import { resolveModel } from "@/lib/ai/provider";
import {
  createPrompt,
  EXTRACT_SYSTEM,
  PATCHER_SYSTEM,
  patchPrompt,
  PLANNER_SYSTEM,
  repairPrompt,
} from "@/lib/ai/prompts";
import { structuredOutput } from "@/lib/ai/structured";
import { applyPatch } from "@/lib/plan/apply-patch";
import type { PlanEvent } from "@/lib/plan/events";
import { hasErrors, validatePlan } from "@/lib/plan/validate-plan";
import {
  PlanDraft,
  PlanPatch,
  PrdBrief,
  type FlowPlan,
  type PlanInput,
} from "@/lib/schema/flow-plan";
import type { PrdDocument } from "@/lib/schema/prd";

export type PlannerOptions = {
  model?: LanguageModel;
  abortSignal?: AbortSignal;
};

function userMessage(text: string, prd?: PrdDocument): ModelMessage {
  if (prd?.format !== "pdf") return { role: "user", content: text };
  return {
    role: "user",
    content: [
      { type: "text", text },
      { type: "file", mediaType: "application/pdf", data: prd.base64, filename: prd.name },
    ],
  };
}

export async function extractBrief(
  prd: PrdDocument,
  { model = MODELS.extract, abortSignal }: PlannerOptions = {},
): Promise<PrdBrief> {
  const text =
    prd.format === "text"
      ? `Extract the planning brief from this PRD.\n\n<prd name="${prd.name}">\n${prd.text}\n</prd>`
      : "Extract the planning brief from the attached PRD.";
  const { output } = await generateText({
    model: resolveModel(model),
    system: EXTRACT_SYSTEM,
    messages: [userMessage(text, prd)],
    output: structuredOutput(PrdBrief),
    abortSignal,
  });
  return output;
}

export async function* createPlan(
  input: PlanInput,
  { model = MODELS.plan, abortSignal }: PlannerOptions = {},
): AsyncGenerator<PlanEvent> {
  const result = streamText({
    model: resolveModel(model),
    system: PLANNER_SYSTEM,
    messages: [userMessage(createPrompt(input), input.prd)],
    output: structuredOutput(PlanDraft),
    abortSignal,
  });

  let last = "";
  for await (const partial of result.partialOutputStream) {
    const event: PlanEvent = {
      type: "progress",
      title: partial.title,
      nodes: partial.nodes?.length ?? 0,
      edges: partial.edges?.length ?? 0,
      stories: partial.userStories?.length ?? 0,
    };
    const key = JSON.stringify(event);
    if (key !== last) yield event;
    last = key;
  }

  const draft = await result.output;
  const plan: FlowPlan = { ...draft, id: crypto.randomUUID(), version: 1 };
  const message = `Planned ${plan.nodes.length} components and ${plan.userStories.length} user stories as a ${plan.designType} design.`;
  yield* finish(plan, message, { model, abortSignal });
}

export async function* patchPlan(
  plan: FlowPlan,
  instruction: string,
  selection: string[],
  { model = MODELS.plan, abortSignal }: PlannerOptions = {},
): AsyncGenerator<PlanEvent> {
  // Patches are small, so a non-streaming call is simpler and just as fast.
  const { output: patch } = await generateText({
    model: resolveModel(model),
    system: PATCHER_SYSTEM,
    prompt: patchPrompt(plan, instruction, selection),
    output: structuredOutput(PlanPatch),
    abortSignal,
  });
  yield* finish(applyPatch(plan, patch), patch.message, { model, abortSignal });
}

/** Validates, then spends at most one repair call (a patch, not a full regeneration) on errors. */
async function* finish(
  plan: FlowPlan,
  message: string,
  options: Required<Pick<PlannerOptions, "model">> & PlannerOptions,
): AsyncGenerator<PlanEvent> {
  let issues = validatePlan(plan);
  if (hasErrors(issues)) {
    yield { type: "repairing", count: issues.filter((i) => i.level === "error").length };
    try {
      const { output: fix } = await generateText({
        model: resolveModel(options.model),
        system: PATCHER_SYSTEM,
        prompt: repairPrompt(plan, issues),
        output: structuredOutput(PlanPatch),
        abortSignal: options.abortSignal,
      });
      // The repair belongs to the same user-visible version.
      plan = { ...applyPatch(plan, fix), version: plan.version };
      issues = validatePlan(plan);
    } catch (error) {
      if (options.abortSignal?.aborted) throw error;
      // A failed repair still leaves a usable plan; the remaining issues are shown to the user.
      console.error("Plan repair failed", error);
    }
  }
  yield { type: "done", plan, issues, message };
}

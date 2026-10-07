import { createPlan, patchPlan } from "@/lib/ai/planner";
import { PlanRequest } from "@/lib/schema/requests";
import { jsonError, ndjsonResponse } from "@/lib/server/responses";

export async function POST(request: Request): Promise<Response> {
  const parsed = PlanRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, parsed.error);

  const body = parsed.data;
  const options = { abortSignal: request.signal, ...(body.model ? { model: body.model } : {}) };
  const events =
    body.mode === "create"
      ? createPlan(body.input, options)
      : patchPlan(body.plan, body.instruction, body.selection, options);
  return ndjsonResponse(events);
}

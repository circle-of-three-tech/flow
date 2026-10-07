import type { PlanEvent } from "@/lib/plan/events";
import type { PrdBrief } from "@/lib/schema/flow-plan";
import type { ModelId } from "@/lib/schema/models";
import type { PrdDocument } from "@/lib/schema/prd";
import type { PlanRequest } from "@/lib/schema/requests";

async function errorFrom(response: Response): Promise<Error> {
  const body = (await response.json().catch(() => null)) as { error?: string } | null;
  return new Error(body?.error ?? `Request failed (${response.status})`);
}

export async function requestBrief(prd: PrdDocument, model?: ModelId, signal?: AbortSignal): Promise<PrdBrief> {
  const response = await fetch("/api/extract", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ prd, model }),
    signal,
  });
  if (!response.ok) throw await errorFrom(response);
  return ((await response.json()) as { brief: PrdBrief }).brief;
}

/** Reads the NDJSON event stream from /api/plan, calling onEvent for each line. */
export async function streamPlan(
  body: PlanRequest,
  onEvent: (event: PlanEvent) => void,
  signal?: AbortSignal,
): Promise<void> {
  const response = await fetch("/api/plan", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
    signal,
  });
  if (!response.ok || !response.body) throw await errorFrom(response);

  const reader = response.body.pipeThrough(new TextDecoderStream()).getReader();
  let buffer = "";
  for (;;) {
    const { value, done } = await reader.read();
    if (value) buffer += value;
    const lines = buffer.split("\n");
    buffer = done ? "" : (lines.pop() ?? "");
    for (const line of lines) {
      if (line.trim()) onEvent(JSON.parse(line) as PlanEvent);
    }
    if (done) return;
  }
}

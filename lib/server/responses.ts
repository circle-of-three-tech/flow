import { z } from "zod";
import type { PlanEvent } from "@/lib/plan/events";

export function describeError(error: unknown): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/incorrect api key|invalid_api_key/i.test(message)) {
    return "OpenAI rejected OPENAI_API_KEY. Check the key in .env (it starts with sk-) at platform.openai.com/api-keys.";
  }
  if (/insufficient_quota|exceeded your current quota/i.test(message)) {
    return "Your OpenAI account has no remaining quota. Add billing at platform.openai.com, or pick a cheaper model.";
  }
  if (/api key|unauthori[sz]ed|unauthenticated|authentication|\b401\b|oidc/i.test(message)) {
    return "No working AI key. Put your OpenAI key in .env as OPENAI_API_KEY=sk-… (or a Vercel AI Gateway key as AI_GATEWAY_API_KEY=vck_…) and restart the dev server.";
  }
  if (/free tier users do not have access/i.test(message)) {
    return "Your AI Gateway free tier can't use this model. Pick GPT-5 mini or GPT-4.1 mini in the model menu, or add paid credits in Vercel.";
  }
  if (error instanceof z.ZodError) return z.prettifyError(error);
  return message || "Something went wrong";
}

export function jsonError(status: number, error: unknown): Response {
  return Response.json({ error: describeError(error) }, { status });
}

/** Streams events as newline-delimited JSON; a thrown error becomes a final "error" event. */
export function ndjsonResponse(events: AsyncIterable<PlanEvent>): Response {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: PlanEvent) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      try {
        for await (const event of events) send(event);
      } catch (error) {
        console.error("Plan stream failed", error);
        try {
          send({ type: "error", error: describeError(error) });
        } catch {
          // The client already disconnected.
        }
      } finally {
        try {
          controller.close();
        } catch {
          // Already closed by a cancelled request.
        }
      }
    },
  });
  return new Response(stream, {
    headers: {
      "content-type": "application/x-ndjson; charset=utf-8",
      "cache-control": "no-store",
    },
  });
}

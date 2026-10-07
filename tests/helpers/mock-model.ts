import { simulateReadableStream } from "ai";
import { MockLanguageModelV4 } from "ai/test";

const usage = {
  inputTokens: { total: 10, noCache: 10, cacheRead: undefined, cacheWrite: undefined },
  outputTokens: { total: 20, text: 20, reasoning: undefined },
};

export type Script = {
  /** JSON value streamed for streamText calls. */
  stream?: unknown;
  /** JSON values (or raw strings) returned in order by generateText calls; the last one repeats. */
  generate: unknown[];
};

function text(value: unknown): string {
  return typeof value === "string" ? value : JSON.stringify(value);
}

/** A mock model whose responses come from `script`, read at call time so tests can swap it. */
export function scriptedModel(script: Script) {
  const calls: unknown[] = [];
  let generateIndex = 0;
  const model = new MockLanguageModelV4({
    doGenerate: async (options) => {
      calls.push(options.prompt);
      const value = script.generate[Math.min(generateIndex++, script.generate.length - 1)];
      return {
        content: [{ type: "text", text: text(value) }],
        finishReason: { unified: "stop", raw: undefined },
        usage,
        warnings: [],
      };
    },
    doStream: async (options) => {
      calls.push(options.prompt);
      const deltas = text(script.stream).match(/[\s\S]{1,40}/g) ?? [];
      return {
        stream: simulateReadableStream({
          chunks: [
            { type: "text-start" as const, id: "t1" },
            ...deltas.map((delta) => ({ type: "text-delta" as const, id: "t1", delta })),
            { type: "text-end" as const, id: "t1" },
            {
              type: "finish" as const,
              finishReason: { unified: "stop" as const, raw: undefined },
              logprobs: undefined,
              usage,
            },
          ],
        }),
      };
    },
  });
  return {
    model,
    calls,
    reset() {
      calls.length = 0;
      generateIndex = 0;
    },
  };
}

/** Shared by route tests through vi.mock("@/lib/ai/models"). */
export const routeScript: Script = { generate: [] };
export const routeModel = scriptedModel(routeScript);

import { z } from "zod";

// Allow-list of AI Gateway models the user can pick; the server rejects anything else.
// Project decision: ChatGPT (OpenAI) models only. See CLAUDE.md §3.
export const ModelId = z.enum(["openai/gpt-5-mini", "openai/gpt-4.1-mini", "openai/gpt-5.5", "openai/gpt-5.4-mini"]);
export type ModelId = z.infer<typeof ModelId>;

export const MODEL_INFO: Record<ModelId, { label: string; note: string }> = {
  "openai/gpt-5-mini": { label: "GPT-5 mini", note: "Good designs, low cost" },
  "openai/gpt-4.1-mini": { label: "GPT-4.1 mini", note: "Fastest, lowest cost" },
  "openai/gpt-5.5": { label: "GPT-5.5", note: "Best quality, higher cost" },
  "openai/gpt-5.4-mini": { label: "GPT-5.4 mini", note: "Fast, mid cost" },
};

// Defaults are low-cost ChatGPT models that also work on the AI Gateway free tier.
// Extraction is a reading task, so it uses the faster model.
export const DEFAULT_MODELS = {
  plan: "openai/gpt-5-mini",
  extract: "openai/gpt-4.1-mini",
} as const satisfies Record<string, ModelId>;

export type ModelSettings = { plan: ModelId; extract: ModelId };

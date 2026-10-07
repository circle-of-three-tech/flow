import { createOpenAI } from "@ai-sdk/openai";
import type { LanguageModel } from "ai";

/**
 * With OPENAI_API_KEY set, ChatGPT models are called directly (billed to that OpenAI account);
 * otherwise "openai/<model>" ids go through the Vercel AI Gateway (AI_GATEWAY_API_KEY).
 * Read per call so editing .env takes effect without a restart in dev.
 */
export function resolveModel(model: LanguageModel): LanguageModel {
  if (typeof model !== "string") return model;
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (apiKey && model.startsWith("openai/")) {
    return createOpenAI({ apiKey })(model.slice("openai/".length));
  }
  return model;
}

export function providerName(): "openai" | "gateway" {
  return process.env.OPENAI_API_KEY?.trim() ? "openai" : "gateway";
}

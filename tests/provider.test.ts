import { afterEach, describe, expect, it, vi } from "vitest";
import { providerName, resolveModel } from "@/lib/ai/provider";
import { describeError } from "@/lib/server/responses";

afterEach(() => vi.unstubAllEnvs());

describe("resolveModel", () => {
  it("uses the AI Gateway string when no OpenAI key is set", () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    expect(resolveModel("openai/gpt-5-mini")).toBe("openai/gpt-5-mini");
    expect(providerName()).toBe("gateway");
  });

  it("calls OpenAI directly when OPENAI_API_KEY is set, stripping the provider prefix", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const model = resolveModel("openai/gpt-5-mini");
    expect(typeof model).toBe("object");
    expect(model).toMatchObject({ provider: expect.stringContaining("openai"), modelId: "gpt-5-mini" });
    expect(providerName()).toBe("openai");
  });

  it("passes model objects (e.g. test mocks) through unchanged", () => {
    vi.stubEnv("OPENAI_API_KEY", "sk-test");
    const mock = { specificationVersion: "v4" } as unknown as Parameters<typeof resolveModel>[0];
    expect(resolveModel(mock)).toBe(mock);
  });
});

describe("describeError", () => {
  it("explains key problems in plain language", () => {
    expect(describeError(new Error("Unauthenticated request to AI Gateway."))).toContain("OPENAI_API_KEY=sk-");
    expect(describeError(new Error("Incorrect API key provided: sk-abc"))).toContain("OpenAI rejected OPENAI_API_KEY");
    expect(describeError(new Error("You exceeded your current quota"))).toContain("no remaining quota");
  });
});

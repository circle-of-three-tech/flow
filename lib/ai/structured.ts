import { jsonSchema, Output } from "ai";
import { z } from "zod";

type JsonNode = Record<string, unknown>;
type JSONSchema7 = Extract<Parameters<typeof jsonSchema>[0], { type?: unknown }>;

/**
 * OpenAI's strict structured output requires every property to be listed in `required`
 * and `additionalProperties: false`. Optional properties therefore become required-but-nullable.
 * Other providers accept this shape too.
 */
function makeStrict(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(makeStrict);
  if (!node || typeof node !== "object") return node;
  const out: JsonNode = {};
  for (const [key, value] of Object.entries(node as JsonNode)) {
    out[key] = key === "properties" ? value : makeStrict(value);
  }
  const properties = out.properties as Record<string, unknown> | undefined;
  if (properties && typeof properties === "object") {
    const required = new Set((out.required as string[] | undefined) ?? []);
    const strictProps: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(properties)) {
      const strict = makeStrict(value);
      strictProps[key] = required.has(key) ? strict : { anyOf: [strict, { type: "null" }] };
    }
    out.properties = strictProps;
    out.required = Object.keys(properties);
    out.additionalProperties = false;
  }
  return out;
}

export function strictJsonSchema(schema: z.ZodType): JSONSchema7 {
  const { $schema: _ignored, ...json } = z.toJSONSchema(schema, { target: "draft-7", io: "input" }) as JsonNode;
  return makeStrict(json) as JSONSchema7;
}

/** Drops null-valued object keys, turning the model's nulls back into absent optionals. */
export function stripNulls(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripNulls);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as JsonNode)
      .filter(([, v]) => v !== null)
      .map(([k, v]) => [k, stripNulls(v)]),
  );
}

/** Structured output that works across providers: strict schema out, real Zod validation in. */
export function structuredOutput<T>(schema: z.ZodType<T>) {
  return Output.object({
    schema: jsonSchema<T>(strictJsonSchema(schema), {
      validate: (value) => {
        const result = schema.safeParse(stripNulls(value));
        return result.success ? { success: true, value: result.data } : { success: false, error: result.error };
      },
    }),
  });
}

import { z } from "zod";

export const PRD_LIMITS = {
  // Base64 inflates by ~4/3; 3 MB keeps the request under Vercel's 4.5 MB body limit.
  maxPdfBytes: 3_000_000,
  maxTextChars: 200_000,
} as const;

export const PRD_ACCEPT = ".md,.markdown,.txt,.pdf,.docx";

/** A PRD ready to send to the server. DOCX is converted to text in the browser first. */
export const PrdDocument = z.discriminatedUnion("format", [
  z.object({
    format: z.literal("text"),
    name: z.string().min(1),
    text: z.string().min(1).max(PRD_LIMITS.maxTextChars),
  }),
  z.object({
    format: z.literal("pdf"),
    name: z.string().min(1),
    base64: z
      .string()
      .min(1)
      .max(Math.ceil(PRD_LIMITS.maxPdfBytes / 3) * 4),
  }),
]);
export type PrdDocument = z.infer<typeof PrdDocument>;

import { extractBrief } from "@/lib/ai/planner";
import { ExtractRequest } from "@/lib/schema/requests";
import { jsonError } from "@/lib/server/responses";

export async function POST(request: Request): Promise<Response> {
  const parsed = ExtractRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(400, parsed.error);

  const { prd, model } = parsed.data;
  try {
    const brief = await extractBrief(prd, { abortSignal: request.signal, ...(model ? { model } : {}) });
    return Response.json({ brief });
  } catch (error) {
    console.error("PRD extraction failed", error);
    return jsonError(502, error);
  }
}

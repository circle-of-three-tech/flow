import { classifyPrdFile, pdfPrd, textPrd, type PrdResult } from "@/lib/input/prd";
import { PRD_ACCEPT } from "@/lib/schema/prd";

const MAX_DOCX_BYTES = 20_000_000;

/** Browser only: turns an uploaded file into a PrdDocument (DOCX is converted to text here). */
export async function readPrdFile(file: File): Promise<PrdResult> {
  const kind = classifyPrdFile(file.name, file.type);
  if (!kind) return { ok: false, error: `${file.name} isn't supported. Upload one of: ${PRD_ACCEPT}` };
  if (kind === "text") return textPrd(file.name, await file.text());
  if (kind === "pdf") return pdfPrd(file.name, new Uint8Array(await file.arrayBuffer()));

  if (file.size > MAX_DOCX_BYTES) return { ok: false, error: `${file.name} is too large to convert` };
  try {
    const mammoth = await import("mammoth");
    const { value } = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return textPrd(file.name, value);
  } catch {
    return { ok: false, error: `${file.name} couldn't be read as a Word document` };
  }
}

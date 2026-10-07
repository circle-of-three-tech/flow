import { PRD_LIMITS, type PrdDocument } from "@/lib/schema/prd";

export type PrdFileKind = "text" | "pdf" | "docx";
export type PrdResult = { ok: true; prd: PrdDocument } | { ok: false; error: string };

const EXTENSIONS: Record<string, PrdFileKind> = {
  md: "text",
  markdown: "text",
  txt: "text",
  pdf: "pdf",
  docx: "docx",
};

const MEDIA_TYPES: Record<string, PrdFileKind> = {
  "text/markdown": "text",
  "text/plain": "text",
  "application/pdf": "pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
};

/** Browsers often report an empty or generic type for .md files, so the extension wins. */
export function classifyPrdFile(name: string, mediaType = ""): PrdFileKind | null {
  const ext = name.includes(".") ? (name.toLowerCase().split(".").pop() ?? "") : "";
  return EXTENSIONS[ext] ?? MEDIA_TYPES[mediaType] ?? null;
}

export function normalizePrdText(text: string): string {
  return text
    .replace(/^﻿/, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

/** For .md/.txt, and for .docx after browser-side conversion to text. */
export function textPrd(name: string, raw: string): PrdResult {
  const text = normalizePrdText(raw);
  if (!text) return { ok: false, error: `${name} is empty` };
  if (text.length > PRD_LIMITS.maxTextChars) {
    return {
      ok: false,
      error: `${name} has ${text.length.toLocaleString("en")} characters; the limit is ${PRD_LIMITS.maxTextChars.toLocaleString("en")}. Trim appendices or split the PRD.`,
    };
  }
  return { ok: true, prd: { format: "text", name, text } };
}

const PDF_MAGIC = [0x25, 0x50, 0x44, 0x46, 0x2d]; // "%PDF-"

export function pdfPrd(name: string, bytes: Uint8Array): PrdResult {
  if (!PDF_MAGIC.every((b, i) => bytes[i] === b)) {
    return { ok: false, error: `${name} is not a valid PDF` };
  }
  if (bytes.length > PRD_LIMITS.maxPdfBytes) {
    return {
      ok: false,
      error: `${name} is ${mb(bytes.length)}; the PDF limit is ${mb(PRD_LIMITS.maxPdfBytes)}. Export it as Markdown or text instead.`,
    };
  }
  return { ok: true, prd: { format: "pdf", name, base64: toBase64(bytes) } };
}

function mb(bytes: number): string {
  return `${(bytes / 1_000_000).toFixed(1)} MB`;
}

// Chunked so large files don't overflow the call stack in String.fromCharCode.
function toBase64(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return btoa(binary);
}

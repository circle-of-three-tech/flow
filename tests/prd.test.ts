import { describe, expect, it } from "vitest";
import { classifyPrdFile, normalizePrdText, pdfPrd, textPrd } from "@/lib/input/prd";
import { PRD_LIMITS, PrdDocument } from "@/lib/schema/prd";

describe("classifyPrdFile", () => {
  it("prefers the extension", () => {
    expect(classifyPrdFile("spec.MD", "")).toBe("text");
    expect(classifyPrdFile("spec.md", "application/octet-stream")).toBe("text");
    expect(classifyPrdFile("spec.pdf")).toBe("pdf");
    expect(classifyPrdFile("spec.docx")).toBe("docx");
  });

  it("falls back to the media type and rejects unknown files", () => {
    expect(classifyPrdFile("README", "text/plain")).toBe("text");
    expect(classifyPrdFile("deck.pptx", "")).toBeNull();
  });
});

describe("normalizePrdText", () => {
  it("strips BOM, CRLF, trailing spaces and extra blank lines", () => {
    expect(normalizePrdText("﻿# PRD  \r\n\r\n\r\n\r\nGoals\r\n")).toBe("# PRD\n\nGoals");
  });
});

describe("textPrd", () => {
  it("builds a valid text PRD", () => {
    const result = textPrd("prd.md", "# Shop\n\nUsers can check out.");
    expect(result.ok).toBe(true);
    if (result.ok) expect(PrdDocument.safeParse(result.prd).success).toBe(true);
  });

  it("rejects empty and oversized text", () => {
    expect(textPrd("empty.md", "  \n ").ok).toBe(false);
    expect(textPrd("big.md", "x".repeat(PRD_LIMITS.maxTextChars + 1)).ok).toBe(false);
  });
});

describe("pdfPrd", () => {
  const pdf = new TextEncoder().encode("%PDF-1.7 fake body");

  it("base64-encodes a PDF", () => {
    const result = pdfPrd("prd.pdf", pdf);
    expect(result.ok && result.prd.format === "pdf" && atob(result.prd.base64)).toBe("%PDF-1.7 fake body");
  });

  it("rejects non-PDF bytes and oversized files", () => {
    expect(pdfPrd("fake.pdf", new TextEncoder().encode("hello")).ok).toBe(false);
    const big = new Uint8Array(PRD_LIMITS.maxPdfBytes + 1);
    big.set(pdf);
    expect(pdfPrd("big.pdf", big).ok).toBe(false);
  });
});

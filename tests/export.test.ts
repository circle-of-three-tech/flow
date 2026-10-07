import { describe, expect, it } from "vitest";
import { fromJson, toJson } from "@/lib/export/json";
import { toMarkdown } from "@/lib/export/markdown";
import { toStoriesCsv } from "@/lib/export/stories-csv";
import { toMermaid } from "@/lib/render/to-mermaid";
import { makePlan } from "./fixtures/sample-plan";

describe("toMarkdown", () => {
  const plan = makePlan();
  const md = toMarkdown(plan);

  it("starts with the title and metadata", () => {
    expect(md.startsWith("# Shop checkout\n")).toBe(true);
    expect(md).toContain("**Design:** modular-monolith · **Diagram:** architecture · **Version:** 1");
  });

  it("embeds the Mermaid diagram", () => {
    expect(md).toContain(`\`\`\`mermaid\n${toMermaid(plan)}\n\`\`\``);
  });

  it("lists components, connections, flows, risks and questions", () => {
    expect(md).toContain('| Orders "API" | service | Node.js | Backend | Feature: checkout |');
    expect(md).toContain("| Orders \"API\" | Orders DB | data | — |");
    expect(md).toContain("2. **Orders \"API\"**: Creates order");
    expect(md).toContain("- Email provider outage");
    expect(md).toContain("- [ ] Can guests check out without an account?");
  });

  it("escapes pipes in table cells", () => {
    const out = toMarkdown(makePlan({ nodes: [{ id: "a", label: "A | B", kind: "service", rationale: "x" }] }));
    expect(out).toContain("| A \\| B | service |");
  });

  it("renders user stories by priority with traceability", () => {
    expect(md).toContain("## User stories");
    expect(md).toContain("### Guest checkout · Must have");
    expect(md).toContain("As a **shopper**, I want to pay without creating an account, so that I can buy quickly.");
    expect(md).toContain("- [ ] Receipt arrives within 5 minutes");
    expect(md).toContain('**ID:** `guest-checkout` · **Implemented by:** Web app, Orders "API", Orders DB · **Flow:** Checkout');

    const reversed = toMarkdown(makePlan({ userStories: [...plan.userStories].reverse() }));
    expect(reversed.indexOf("Guest checkout")).toBeLessThan(reversed.indexOf("Order receipt"));
  });

  it("omits empty sections", () => {
    const out = toMarkdown(makePlan({ risks: [], openQuestions: [], flows: [], userStories: [] }));
    expect(out).not.toContain("## Risks");
    expect(out).not.toContain("## Open questions");
    expect(out).not.toContain("## Flows");
    expect(out).not.toContain("## User stories");
  });
});

describe("toStoriesCsv", () => {
  const csv = toStoriesCsv(makePlan());
  const lines = csv.split("\r\n");

  it("writes a header and one record per story", () => {
    expect(lines[0]).toBe('"ID","Summary","Description","Acceptance Criteria","Priority","Components","Flow"');
    expect(csv).toContain('"guest-checkout","Guest checkout","As a shopper, I want to pay without creating an account, so that I can buy quickly."');
    expect(csv).toContain('"Must have","Web app, Orders ""API"", Orders DB","Checkout"');
  });

  it("keeps multi-line acceptance criteria inside one quoted field", () => {
    expect(csv).toContain('"• Checkout needs only email and payment details\n• Order is saved before payment confirmation"');
  });

  it("neutralises spreadsheet formulas", () => {
    const plan = makePlan();
    const [first] = plan.userStories;
    if (!first) throw new Error("fixture has stories");
    const out = toStoriesCsv(makePlan({ userStories: [{ ...first, title: "=HYPERLINK(1)" }] }));
    expect(out).toContain(`"'=HYPERLINK(1)"`);
  });
});

describe("json export", () => {
  it("round-trips a plan", () => {
    const plan = makePlan();
    expect(fromJson(toJson(plan))).toEqual(plan);
  });

  it("rejects invalid plans", () => {
    expect(() => fromJson(JSON.stringify({ title: "nope" }))).toThrow();
    expect(() => fromJson("not json")).toThrow();
  });
});

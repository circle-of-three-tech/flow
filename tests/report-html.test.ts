import { describe, expect, it } from "vitest";
import { escapeHtml, toReportHtml } from "@/lib/export/report-html";
import { nodeIdFromElementId } from "@/lib/render/to-mermaid";
import { makePlan } from "./fixtures/sample-plan";

describe("toReportHtml", () => {
  const html = toReportHtml(makePlan(), "<svg data-test></svg>");

  it("is a standalone document with the diagram embedded", () => {
    expect(html.startsWith("<!doctype html>")).toBe(true);
    expect(html).toContain("<figure><svg data-test></svg></figure>");
  });

  it("escapes plan text", () => {
    expect(html).toContain("Orders &quot;API&quot;");
    expect(toReportHtml(makePlan({ title: "<script>x</script>" }), "")).not.toContain("<script>x");
  });

  it("includes stories, components, flows and questions", () => {
    expect(html).toContain("Guest checkout <span class=\"tag\">Must have</span>");
    expect(html).toContain("<th>Component</th>");
    expect(html).toContain("<li><b>Web app</b>: Submits cart</li>");
    expect(html).toContain("☐ Can guests check out without an account?");
  });
});

describe("escapeHtml", () => {
  it("escapes the five HTML-significant characters", () => {
    expect(escapeHtml(`<a href="x">'&'</a>`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;&#39;&lt;/a&gt;");
  });
});

describe("nodeIdFromElementId", () => {
  it("recovers node ids from Mermaid element ids", () => {
    expect(nodeIdFromElementId("flow-mermaid-3-flowchart-n_orders_svc-2")).toBe("orders-svc");
    expect(nodeIdFromElementId("n_db-0")).toBe("db");
    expect(nodeIdFromElementId("flow-mermaid-3")).toBeNull();
  });
});

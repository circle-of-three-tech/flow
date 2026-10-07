import { describe, expect, it } from "vitest";
import { escapeLabel, mermaidId, toMermaid } from "@/lib/render/to-mermaid";
import { makePlan } from "./fixtures/sample-plan";

describe("escapeLabel", () => {
  it("encodes special characters in a single pass", () => {
    expect(escapeLabel('a "b" #1; <c> | d')).toBe("a #34;b#34; #35;1#59; #60;c#62; #124; d");
  });

  it("collapses whitespace and newlines", () => {
    expect(escapeLabel("  multi\n  line  ")).toBe("multi line");
  });
});

describe("mermaidId", () => {
  it("prefixes ids and replaces hyphens", () => {
    expect(mermaidId("orders-svc")).toBe("n_orders_svc");
    expect(mermaidId("end")).toBe("n_end");
    expect(mermaidId("3d")).toBe("n_3d");
  });
});

describe("toMermaid flowchart", () => {
  const out = toMermaid(makePlan());

  it("uses LR for architecture diagrams", () => {
    expect(out.split("\n")[0]).toBe("flowchart LR");
  });

  it("renders shapes by node kind", () => {
    expect(out).toContain('n_user(("Shopper"))');
    expect(out).toContain('n_web(["Web app"])');
    expect(out).toContain('n_db[("Orders DB")]');
    expect(out).toContain('n_email{{"Email provider"}}');
  });

  it("escapes quotes in labels", () => {
    expect(out).toContain('n_api["Orders #34;API#34;"]');
  });

  it("nests grouped nodes in a subgraph", () => {
    expect(out).toMatch(/subgraph g_backend\["Backend"\]\n(\s+n_\w+.*\n){3}\s+end/);
  });

  it("draws edge styles", () => {
    expect(out).toContain('n_web -->|"POST /orders"| n_api');
    expect(out).toContain("n_api ==> n_db");
    expect(out).toContain('n_api -.->|"order.created"| n_jobs');
  });

  it("skips edges to unknown nodes", () => {
    const plan = makePlan();
    plan.edges.push({ id: "bad", from: "api", to: "ghost", style: "sync" });
    expect(toMermaid(plan)).not.toContain("ghost");
  });

  it("honours a direction override and TD for user flows", () => {
    expect(toMermaid(makePlan(), { direction: "TD" })).toMatch(/^flowchart TD/);
    expect(toMermaid(makePlan({ diagramKind: "user-flow" }))).toMatch(/^flowchart TD/);
  });
});

describe("toMermaid other kinds", () => {
  it("renders sequence diagrams", () => {
    const out = toMermaid(makePlan({ diagramKind: "sequence" }));
    expect(out).toMatch(/^sequenceDiagram/);
    expect(out).toContain("actor n_user as Shopper");
    expect(out).toContain("n_web->>n_api: POST /orders");
    expect(out).toContain("n_api-)n_jobs: order.created");
  });

  it("renders state diagrams with an initial state", () => {
    const out = toMermaid(makePlan({ diagramKind: "state" }));
    expect(out).toMatch(/^stateDiagram-v2/);
    expect(out).toContain("[*] --> n_user");
    expect(out).toContain("n_web --> n_api : POST /orders");
  });

  it("renders ER diagrams", () => {
    const out = toMermaid(makePlan({ diagramKind: "erd" }));
    expect(out).toMatch(/^erDiagram/);
    expect(out).toContain('API ||--o{ DB : "relates to"');
  });
});

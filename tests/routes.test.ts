import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { POST as extract } from "@/app/api/extract/route";
import { POST as plan } from "@/app/api/plan/route";
import { textPrd } from "@/lib/input/prd";
import { EMPTY_PATCH } from "@/lib/plan/apply-patch";
import type { PlanEvent } from "@/lib/plan/events";
import { EMPTY_FORM, mergeBrief, toPlanInput } from "@/lib/plan/form";
import { toMarkdown } from "@/lib/export/markdown";
import { FlowPlan, PrdBrief } from "@/lib/schema/flow-plan";
import { flowBrief, flowDraft } from "./fixtures/flow-app";
import { routeModel, routeScript } from "./helpers/mock-model";

vi.mock("@/lib/ai/models", async () => {
  const { routeModel } = await import("./helpers/mock-model");
  return { MODELS: { plan: routeModel.model, extract: routeModel.model } };
});

const post = (body: unknown) =>
  new Request("http://localhost/api", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

async function events(response: Response): Promise<PlanEvent[]> {
  expect(response.headers.get("content-type")).toContain("application/x-ndjson");
  const text = await response.text();
  return text.trim().split("\n").map((line) => JSON.parse(line) as PlanEvent);
}

// The repo's own CLAUDE.md doubles as a realistic PRD.
const claudeMd = readFileSync(fileURLToPath(new URL("../CLAUDE.md", import.meta.url)), "utf8");

beforeEach(() => {
  routeModel.reset();
  routeScript.stream = undefined;
  routeScript.generate = [];
});

describe("CLAUDE.md as a PRD, end to end", () => {
  const prd = textPrd("CLAUDE.md", claudeMd);

  it("is accepted as a text PRD", () => {
    expect(prd.ok).toBe(true);
  });

  it("extracts a brief, then plans from the reviewed form", async () => {
    if (!prd.ok) throw new Error(prd.error);
    routeScript.generate = [flowBrief];

    const extractResponse = await extract(post({ prd: prd.prd }));
    expect(extractResponse.status).toBe(200);
    const { brief } = (await extractResponse.json()) as { brief: unknown };
    expect(PrdBrief.parse(brief)).toEqual(flowBrief);

    const sent = JSON.stringify(routeModel.calls[0]);
    expect(sent).toContain('<prd name=\\"CLAUDE.md\\">');
    expect(sent).toContain("Planning principles");

    routeScript.stream = flowDraft;
    const input = toPlanInput(mergeBrief(EMPTY_FORM, flowBrief));
    const stream = await events(await plan(post({ mode: "create", input })));
    const last = stream.at(-1);
    if (last?.type !== "done") throw new Error(JSON.stringify(last));

    const result = FlowPlan.parse(last.plan);
    expect(last.issues).toEqual([]);
    expect(result.userStories.map((s) => s.id)).toEqual(flowBrief.userStories.map((s) => s.id));
    // Planning from the brief must not resend the PRD.
    expect(JSON.stringify(routeModel.calls[1])).not.toContain("Planning principles");

    const markdown = toMarkdown(result);
    expect(markdown).toContain("## User stories");
    expect(markdown).toContain("```mermaid\nflowchart LR");
  });

  it("can plan directly from the PRD, skipping review", async () => {
    if (!prd.ok) throw new Error(prd.error);
    routeScript.stream = flowDraft;
    const stream = await events(
      await plan(post({ mode: "create", input: { prd: prd.prd, diagramKind: "user-flow" } })),
    );
    expect(stream.at(-1)?.type).toBe("done");
    expect(JSON.stringify(routeModel.calls[0])).toContain("Planning principles");
  });
});

describe("POST /api/plan", () => {
  it("patches an existing plan", async () => {
    routeScript.generate = [{ ...EMPTY_PATCH, message: "Removed exports.", removeNodes: ["exporter"] }];
    const current = { ...flowDraft, id: "p1", version: 1 };
    const stream = await events(
      await plan(post({ mode: "patch", plan: current, instruction: "Drop exports", selection: [] })),
    );
    const last = stream.at(-1);
    if (last?.type !== "done") throw new Error(JSON.stringify(last));
    expect(last.plan.nodes.some((n) => n.id === "exporter")).toBe(false);
    // The export story lost its only component-specific node, which the checks report.
    expect(last.plan.version).toBe(2);
  });

  it("rejects invalid requests with 400", async () => {
    expect((await plan(post({ mode: "create", input: {} }))).status).toBe(400);
    expect((await plan(post("not json"))).status).toBe(400);
    expect((await extract(post({ prd: { format: "text", name: "x", text: "" } }))).status).toBe(400);
  });

  it("turns model failures into an error event", async () => {
    routeScript.stream = "{ not valid json";
    const stream = await events(await plan(post({ mode: "create", input: { features: ["a"] } })));
    expect(stream.at(-1)?.type).toBe("error");
  });
});

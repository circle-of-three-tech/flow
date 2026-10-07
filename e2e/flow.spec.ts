import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { expect, test, type Locator, type Page } from "@playwright/test";
import { EMPTY_PATCH, applyPatch } from "../lib/plan/apply-patch";
import type { FlowPlan, PlanPatch } from "../lib/schema/flow-plan";
import { flowBrief, flowDraft } from "../tests/fixtures/flow-app";

const CLAUDE_MD = fileURLToPath(new URL("../CLAUDE.md", import.meta.url));
const plan: FlowPlan = { ...flowDraft, id: "e2e-plan", version: 1 };

type Seen = { extract: string[]; create: string[]; patch: number };

/** Stubs the AI routes so the UI runs without an AI Gateway key; records the models requested. */
async function mockApi(page: Page): Promise<Seen> {
  const seen: Seen = { extract: [], create: [], patch: 0 };
  await page.route("**/api/extract", async (route) => {
    const body = route.request().postDataJSON() as { prd: { name: string; text: string }; model: string };
    seen.extract.push(body.model);
    expect(body.prd.name).toBe("CLAUDE.md");
    expect(body.prd.text).toContain("Planning principles");
    await route.fulfill({ json: { brief: flowBrief } });
  });
  await page.route("**/api/plan", async (route) => {
    const body = route.request().postDataJSON() as { mode: string; plan?: FlowPlan; model: string };
    let lines: unknown[];
    if (body.mode === "create") {
      seen.create.push(body.model);
      lines = [
        { type: "progress", title: "Flow", nodes: 3, edges: 1, stories: 0 },
        { type: "done", plan, issues: [], message: "Planned 6 components and 4 user stories." },
      ];
    } else {
      seen.patch++;
      const patch: PlanPatch = {
        ...EMPTY_PATCH,
        message: "Added a cache.",
        upsertNodes: [{ id: "cache", label: "Plan cache", kind: "datastore", rationale: "refine-chat" }],
        upsertEdges: [{ id: "e6", from: "api", to: "cache", style: "data" }],
      };
      lines = [{ type: "done", plan: applyPatch(body.plan!, patch), issues: [], message: patch.message }];
    }
    await route.fulfill({
      contentType: "application/x-ndjson",
      body: lines.map((l) => JSON.stringify(l)).join("\n") + "\n",
    });
  });
  return seen;
}

const canvasNode = (page: Page, id: string) => page.locator(`.react-flow__node[data-id="${id}"]`);

async function drag(page: Page, from: Locator, to: { x: number; y: number }) {
  const box = (await from.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 12 });
  await page.mouse.up();
}

async function center(locator: Locator) {
  const box = (await locator.boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
}

test("CLAUDE.md as a PRD: upload, generate, edit on the canvas, export, restore", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => {
    console.error(e.stack);
    errors.push(e.message);
  });
  const seen = await mockApi(page);

  await page.goto("/");
  await expect(page.getByRole("heading", { name: "Plan your system" })).toBeVisible();

  // Upload → brief pre-fills the form (read with the default PRD model).
  await page.locator('input[type="file"][accept*=".md"]').setInputFiles(CLAUDE_MD);
  await expect(page.getByText(/Read CLAUDE\.md: 6 features, 4 user stories/)).toBeVisible();
  await expect(page.getByLabel("Features")).toHaveValue(/PRD upload/);
  await expect(page.getByLabel("System design")).toHaveValue("modular-monolith");
  expect(seen.extract).toEqual(["openai/gpt-4.1-mini"]);

  // Generate → the canvas shows the design.
  await page.getByRole("button", { name: "Generate design" }).click();
  const nodes = page.locator(".react-flow__node-component");
  const edges = page.locator(".react-flow__edge");
  await expect(nodes).toHaveCount(6);
  await expect(page.locator(".react-flow__node-boundary")).toHaveCount(1);
  await expect(edges).toHaveCount(5);
  expect(seen.create).toEqual(["openai/gpt-5-mini"]);

  // Select → chat context + inspector; rename; undo.
  await canvasNode(page, "api").click();
  const inspector = page.getByRole("complementary", { name: "Inspector" });
  await expect(inspector.getByLabel("Label")).toHaveValue("Plan API");
  await expect(page.getByRole("button", { name: /^Plan API/ })).toBeVisible();
  await inspector.getByLabel("Label").fill("Planner API");
  await inspector.getByLabel("Label").press("Enter");
  await expect(canvasNode(page, "api")).toContainText("Planner API");
  await page.getByRole("button", { name: "Undo" }).click();
  await expect(canvasNode(page, "api")).toContainText("Plan API");

  // Chat patch adds a node.
  await page.getByLabel("Message").fill("Add a cache next to this");
  await page.getByLabel("Message").press("Enter");
  await expect(nodes).toHaveCount(7);
  await expect(edges).toHaveCount(6);

  // Connect by dragging between handles.
  await drag(
    page,
    canvasNode(page, "web").locator(".react-flow__handle-right"),
    await center(canvasNode(page, "cache").locator(".react-flow__handle-left")),
  );
  await expect(edges).toHaveCount(7);

  // Palette: add, then delete with the keyboard.
  await page.getByRole("button", { name: "Add", exact: true }).click();
  await page.getByRole("button", { name: "Queue", exact: true }).click();
  await expect(nodes).toHaveCount(8);
  await expect(inspector.getByLabel("Label")).toHaveValue("Job queue");
  await canvasNode(page, "queue").click();
  await page.keyboard.press("Delete");
  await expect(nodes).toHaveCount(7);

  // Drag a node; the position is saved.
  const exporter = canvasNode(page, "exporter");
  const before = await center(exporter);
  await drag(page, exporter, { x: before.x + 60, y: before.y + 120 });
  const moved = await exporter.evaluate((el) => (el as HTMLElement).style.transform);

  // Mermaid view renders the same plan.
  await page.getByRole("tab", { name: "Mermaid" }).click();
  await expect(page.locator(".flow-diagram g.node")).toHaveCount(7);
  await page.getByRole("tab", { name: "Stories (4)" }).click();
  await expect(page.getByRole("heading", { name: "Design from a PRD" })).toBeVisible();
  await page.getByRole("tab", { name: "Canvas" }).click();

  // Exports.
  const exportAs = async (label: string) => {
    await page.locator("summary", { hasText: "Export" }).click();
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.getByRole("button", { name: label }).click(),
    ]);
    return readFileSync((await download.path())!);
  };
  const markdown = (await exportAs("Markdown Report with diagram")).toString();
  expect(markdown).toContain("```mermaid\nflowchart LR");
  expect(markdown).toContain("## User stories");
  const png = await exportAs("PNG image Diagram, 2×");
  expect(png.subarray(1, 4).toString()).toBe("PNG");
  const drawio = (await exportAs("draw.io Editable, keeps your layout")).toString();
  expect(drawio).toContain('<mxfile host="Flow"');
  expect(drawio.match(/vertex="1"/g)).toHaveLength(8); // 7 nodes + 1 group
  expect(drawio).toContain('source="n-web" target="n-cache"');
  const csv = (await exportAs("User stories CSV Jira, Linear, Sheets")).toString();
  expect(csv).toContain('"upload-prd","Design from a PRD"');

  // Reload restores the project, including the dragged position.
  await page.waitForTimeout(600);
  await page.reload();
  await expect(nodes).toHaveCount(7);
  await expect(canvasNode(page, "exporter")).toHaveCSS("transform", /matrix/);
  expect(await canvasNode(page, "exporter").evaluate((el) => (el as HTMLElement).style.transform)).toBe(moved);
  await expect(page.locator("header")).toContainText("/ Flow");

  await page.screenshot({ path: "test-results/flow-canvas.png" });
  expect(errors).toEqual([]);
});

test("templates fill the form and the model picker changes the requested model", async ({ page }) => {
  const seen = await mockApi(page);
  await page.goto("/");

  await page.getByRole("button", { name: /E-commerce store/ }).click();
  await expect(page.getByLabel("Features")).toHaveValue(/Product catalog/);
  await expect(page.getByText("Loaded the E-commerce store template")).toBeVisible();

  await page.locator("summary", { hasText: "GPT-5 mini" }).click();
  await page.getByLabel("Design model").selectOption("openai/gpt-5.5");
  await page.locator("summary", { hasText: "GPT-5.5" }).click();

  await page.getByRole("button", { name: "Generate design" }).click();
  await expect(page.locator(".react-flow__node-component")).toHaveCount(6);
  expect(seen.create).toEqual(["openai/gpt-5.5"]);

  // The choice survives a reload.
  await page.reload();
  await expect(page.locator("summary", { hasText: "GPT-5.5" })).toBeVisible();
});

test("rejects unsupported PRD files with a clear message", async ({ page }) => {
  await page.goto("/");
  await page.locator('input[type="file"][accept*=".md"]').setInputFiles({
    name: "deck.pptx",
    mimeType: "application/vnd.ms-powerpoint",
    buffer: Buffer.from("x"),
  });
  await expect(page.getByText("deck.pptx isn't supported")).toBeVisible();
});

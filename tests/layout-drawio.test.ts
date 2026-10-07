import { describe, expect, it } from "vitest";
import { uniqueSlug } from "@/components/canvas/kinds";
import { toDrawio } from "@/lib/export/drawio";
import { applySaved, autoLayout, GROUP_PADDING, resolveLayout } from "@/lib/render/layout";
import { makePlan } from "./fixtures/sample-plan";

describe("autoLayout", () => {
  it("places every node, nesting grouped nodes inside their group", async () => {
    const layout = await autoLayout(makePlan());
    expect(Object.keys(layout.nodes).sort()).toEqual(["api", "db", "email", "jobs", "user", "web"]);
    expect(layout.nodes.api?.parent).toBe("backend");
    expect(layout.nodes.user?.parent).toBeUndefined();

    const group = layout.groups.backend!;
    for (const id of ["api", "db", "jobs"]) {
      const n = layout.nodes[id]!;
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeGreaterThanOrEqual(GROUP_PADDING.top - 1);
      expect(n.x + n.width).toBeLessThanOrEqual(group.width);
      expect(n.y + n.height).toBeLessThanOrEqual(group.height);
    }
  });

  it("flows left to right for architecture and top to bottom for user flows", async () => {
    const lr = await autoLayout(makePlan());
    expect(lr.nodes.web!.x).toBeGreaterThan(lr.nodes.user!.x);
    const td = await autoLayout(makePlan({ diagramKind: "user-flow" }));
    expect(td.nodes.web!.y).toBeGreaterThan(td.nodes.user!.y);
  });

  it("tolerates dangling edges, self-loops and unknown groups", async () => {
    const plan = makePlan();
    plan.edges.push({ id: "x1", from: "api", to: "ghost", style: "sync" }, { id: "x2", from: "api", to: "api", style: "sync" });
    plan.nodes.push({ id: "lost", label: "Lost", kind: "service", group: "nowhere", rationale: "" });
    const layout = await autoLayout(plan);
    expect(layout.nodes.lost?.parent).toBeUndefined();
  });
});

describe("applySaved", () => {
  it("uses saved positions only while the node keeps its parent, and grows groups to fit", async () => {
    const auto = await autoLayout(makePlan());
    const layout = applySaved(auto, {
      user: { x: -500, y: 10 },
      api: { x: 900, y: 600, parent: "backend" },
      db: { x: 5, y: 5 }, // saved outside the group, but db is still grouped: ignored
    });
    expect(layout.nodes.user).toMatchObject({ x: -500, y: 10 });
    expect(layout.nodes.api).toMatchObject({ x: 900, y: 600 });
    expect(layout.nodes.db).toEqual(auto.nodes.db);
    const group = layout.groups.backend!;
    expect(group.width).toBeGreaterThanOrEqual(900 + layout.nodes.api!.width + GROUP_PADDING.side);
    expect(group.height).toBeGreaterThanOrEqual(600 + layout.nodes.api!.height + GROUP_PADDING.side);
  });

  it("moves groups by their saved key", async () => {
    const layout = await resolveLayout(makePlan(), { "group:backend": { x: 1234, y: 56 } });
    expect(layout.groups.backend).toMatchObject({ x: 1234, y: 56 });
  });
});

describe("toDrawio", () => {
  it("writes an mxfile with groups, shaped nodes and styled edges", async () => {
    const plan = makePlan();
    const xml = toDrawio(plan, await resolveLayout(plan));
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<mxfile host="Flow"')).toBe(true);
    expect(xml).toContain('<mxCell id="g-backend" value="Backend" style="swimlane;');
    expect(xml).toMatch(/<mxCell id="n-db" value="[^"]*Orders DB[^"]*" style="shape=cylinder3;[^"]*" vertex="1" parent="g-backend">/);
    expect(xml).toMatch(/<mxCell id="n-user" [^>]*style="shape=umlActor;[^"]*" vertex="1" parent="1">/);
    expect(xml).toMatch(/<mxCell id="e-e4" value="order.created" style="[^"]*dashed=1;" edge="1" parent="1" source="n-api" target="n-jobs">/);
    expect(xml).toMatch(/<mxCell id="e-e3" value="" style="[^"]*strokeWidth=2;"/);
    expect(xml.match(/vertex="1"/g)).toHaveLength(7);
    expect(xml.match(/edge="1"/g)).toHaveLength(5);
  });

  it("double-escapes labels: HTML inside an XML attribute", async () => {
    const plan = makePlan();
    const xml = toDrawio(plan, await resolveLayout(plan));
    // Orders "API" with tech Node.js → <b>Orders &quot;API&quot;</b><br>… → XML-escaped
    expect(xml).toContain("&lt;b&gt;Orders &amp;quot;API&amp;quot;&lt;/b&gt;&lt;br&gt;");
    expect(xml).not.toMatch(/value="[^"]*<b>/);
  });

  it("skips edges whose endpoints aren't laid out", async () => {
    const plan = makePlan();
    plan.edges.push({ id: "bad", from: "api", to: "ghost", style: "sync" });
    expect(toDrawio(plan, await resolveLayout(plan))).not.toContain("e-bad");
  });
});

describe("uniqueSlug", () => {
  it("returns the base or the first free numbered variant", () => {
    expect(uniqueSlug("service", [])).toBe("service");
    expect(uniqueSlug("service", ["service", "service-2"])).toBe("service-3");
  });
});

import { describe, expect, it } from "vitest";
import { EMPTY_FORM, mergeBrief, splitLines, toPlanInput } from "@/lib/plan/form";
import { PlanInput } from "@/lib/schema/flow-plan";
import { flowBrief } from "./fixtures/flow-app";

describe("splitLines", () => {
  it("strips bullets and numbering and drops blank lines", () => {
    expect(splitLines("- Auth\n\n* Billing\n• Teams\n1. Search\n2) Export\n  plain  ")).toEqual([
      "Auth",
      "Billing",
      "Teams",
      "Search",
      "Export",
      "plain",
    ]);
  });
});

describe("mergeBrief", () => {
  it("fills an empty form from the brief", () => {
    const form = mergeBrief(EMPTY_FORM, flowBrief);
    expect(form.designType).toBe("modular-monolith");
    expect(splitLines(form.features)).toEqual(flowBrief.features);
    expect(form.flowDescription).toBe(flowBrief.flowDescription);
    expect(form.userStories).toHaveLength(4);
  });

  it("keeps what the user already set and merges lists", () => {
    const form = mergeBrief(
      {
        ...EMPTY_FORM,
        designType: "serverless",
        diagramKind: "sequence",
        features: "Parameter form\nDark mode",
        constraints: "Budget under $50/month",
        userStories: [{ ...flowBrief.userStories[0]!, title: "Mine" }],
      },
      flowBrief,
    );
    expect(form.designType).toBe("serverless");
    expect(form.diagramKind).toBe("sequence");
    expect(form.constraints).toBe("Budget under $50/month");
    const features = splitLines(form.features);
    expect(features.slice(0, 2)).toEqual(["Parameter form", "Dark mode"]);
    expect(features.filter((f) => f === "Parameter form")).toHaveLength(1);
    expect(form.userStories).toHaveLength(4);
    expect(form.userStories[0]?.title).toBe("Mine");
  });
});

describe("toPlanInput", () => {
  it("produces valid planner input and appends chat text to the flow", () => {
    const input = PlanInput.parse(toPlanInput(mergeBrief(EMPTY_FORM, flowBrief), "Also add SSO"));
    expect(input.features).toHaveLength(6);
    expect(input.flowDescription.endsWith("\n\nAlso add SSO")).toBe(true);
    expect(input.prd).toBeUndefined();
  });
});

import type {
  DiagramKind,
  PlanInputRaw,
  PrdBrief,
  RequestedDesignType,
  UserStoryDraft,
} from "@/lib/schema/flow-plan";
import type { PrdDocument } from "@/lib/schema/prd";

/** The parameter form as the user edits it (features as one-per-line text). */
export type FormState = {
  designType: RequestedDesignType;
  diagramKind: DiagramKind;
  features: string;
  flowDescription: string;
  constraints: string;
  userStories: UserStoryDraft[];
};

export const EMPTY_FORM: FormState = {
  designType: "auto",
  diagramKind: "architecture",
  features: "",
  flowDescription: "",
  constraints: "",
  userStories: [],
};

export function splitLines(text: string): string[] {
  return text
    .split("\n")
    .map((line) => line.replace(/^\s*(?:[-*•]|\d+[.)])\s+/, "").trim())
    .filter(Boolean);
}

/**
 * Fills the form from a PRD brief. Anything the user already set wins (CLAUDE.md §1):
 * non-empty text stays, a non-auto design type stays, features and stories are merged.
 */
export function mergeBrief(form: FormState, brief: PrdBrief): FormState {
  const features = splitLines(form.features);
  const known = new Set(features.map((f) => f.toLowerCase()));
  const storyIds = new Set(form.userStories.map((s) => s.id));
  return {
    designType: form.designType === "auto" ? brief.designType : form.designType,
    diagramKind: form.diagramKind === "architecture" ? brief.diagramKind : form.diagramKind,
    features: [...features, ...brief.features.filter((f) => !known.has(f.toLowerCase()))].join("\n"),
    flowDescription: form.flowDescription.trim() || brief.flowDescription,
    constraints: form.constraints.trim() || brief.constraints,
    userStories: [...form.userStories, ...brief.userStories.filter((s) => !storyIds.has(s.id))],
  };
}

export function toPlanInput(form: FormState, extra = "", prd?: PrdDocument): PlanInputRaw {
  return {
    designType: form.designType,
    diagramKind: form.diagramKind,
    features: splitLines(form.features),
    flowDescription: [form.flowDescription.trim(), extra.trim()].filter(Boolean).join("\n\n"),
    constraints: form.constraints,
    userStories: form.userStories,
    prd,
  };
}

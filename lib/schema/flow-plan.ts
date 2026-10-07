import { z } from "zod";
import { PrdDocument } from "@/lib/schema/prd";

export const DESIGN_TYPES = [
  "monolith",
  "modular-monolith",
  "microservices",
  "serverless",
  "event-driven",
  "layered",
  "hexagonal",
  "cqrs",
  "client-server",
  "jamstack",
] as const;

export const DesignType = z.enum(DESIGN_TYPES);
export type DesignType = z.infer<typeof DesignType>;

/** What the user may request; "auto" lets the planner choose and justify a type. */
export const RequestedDesignType = z.enum([...DESIGN_TYPES, "auto"] as const);
export type RequestedDesignType = z.infer<typeof RequestedDesignType>;

export const DiagramKind = z.enum(["architecture", "user-flow", "sequence", "erd", "state"]);
export type DiagramKind = z.infer<typeof DiagramKind>;

export const NodeKind = z.enum([
  "client",
  "service",
  "function",
  "datastore",
  "queue",
  "external",
  "gateway",
  "actor",
  "decision",
  "step",
]);
export type NodeKind = z.infer<typeof NodeKind>;

export const EdgeStyle = z.enum(["sync", "async", "data"]);
export type EdgeStyle = z.infer<typeof EdgeStyle>;

// Stable slugs let patches target nodes across edits; no underscores so the Mermaid id mapping stays collision-free.
export const Slug = z
  .string()
  .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use a lowercase slug such as orders-svc");

export const FlowNode = z.object({
  id: Slug,
  label: z.string().min(1),
  kind: NodeKind,
  group: Slug.optional(),
  tech: z.string().optional(),
  rationale: z.string(),
});
export type FlowNode = z.infer<typeof FlowNode>;

export const FlowEdge = z.object({
  id: Slug,
  from: Slug,
  to: Slug,
  label: z.string().optional(),
  style: EdgeStyle,
});
export type FlowEdge = z.infer<typeof FlowEdge>;

export const FlowGroup = z.object({
  id: Slug,
  label: z.string().min(1),
});
export type FlowGroup = z.infer<typeof FlowGroup>;

export const FlowStep = z.object({
  node: Slug,
  action: z.string().min(1),
});
export type FlowStep = z.infer<typeof FlowStep>;

export const Flow = z.object({
  id: Slug,
  name: z.string().min(1),
  steps: z.array(FlowStep),
});
export type Flow = z.infer<typeof Flow>;

export const Priority = z.enum(["must", "should", "could", "wont"]);
export type Priority = z.infer<typeof Priority>;

/** A story before it is mapped onto the design (as extracted from a PRD or typed by the user). */
export const UserStoryDraft = z.object({
  id: Slug,
  title: z.string().min(1),
  persona: z.string().min(1),
  want: z.string().min(1),
  benefit: z.string().min(1),
  acceptanceCriteria: z.array(z.string().min(1)),
  priority: Priority,
});
export type UserStoryDraft = z.infer<typeof UserStoryDraft>;

export const UserStory = UserStoryDraft.extend({
  nodes: z.array(Slug), // components that implement the story
  flow: Slug.optional(),
});
export type UserStory = z.infer<typeof UserStory>;

export const FlowPlan = z.object({
  id: z.string().min(1),
  title: z.string().min(1),
  summary: z.string(),
  diagramKind: DiagramKind,
  designType: DesignType,
  rationale: z.string(),
  nodes: z.array(FlowNode),
  edges: z.array(FlowEdge),
  groups: z.array(FlowGroup),
  flows: z.array(Flow),
  userStories: z.array(UserStory),
  risks: z.array(z.string()),
  openQuestions: z.array(z.string()),
  version: z.number().int().min(0),
});
export type FlowPlan = z.infer<typeof FlowPlan>;

/** What the model produces for a new plan; the server assigns id and version. */
export const PlanDraft = FlowPlan.omit({ id: true, version: true });
export type PlanDraft = z.infer<typeof PlanDraft>;

// Flat upsert/remove lists rather than a union of ops: simpler JSON schema, so structured output is more reliable.
export const PlanPatch = z.object({
  message: z.string(),
  meta: FlowPlan.pick({
    title: true,
    summary: true,
    rationale: true,
    designType: true,
    diagramKind: true,
    risks: true,
    openQuestions: true,
  }).partial(),
  upsertNodes: z.array(FlowNode),
  removeNodes: z.array(Slug),
  upsertEdges: z.array(FlowEdge),
  removeEdges: z.array(Slug),
  upsertGroups: z.array(FlowGroup),
  removeGroups: z.array(Slug),
  upsertFlows: z.array(Flow),
  removeFlows: z.array(Slug),
  upsertStories: z.array(UserStory),
  removeStories: z.array(Slug),
});
export type PlanPatch = z.infer<typeof PlanPatch>;

/** What the extract step pulls out of a PRD; it pre-fills the parameter form for review. */
export const PrdBrief = z.object({
  title: z.string().min(1),
  summary: z.string(),
  designType: RequestedDesignType,
  diagramKind: DiagramKind,
  features: z.array(z.string().min(1)),
  flowDescription: z.string(),
  constraints: z.string(),
  personas: z.array(z.string().min(1)),
  userStories: z.array(UserStoryDraft),
  openQuestions: z.array(z.string()),
});
export type PrdBrief = z.infer<typeof PrdBrief>;

export const PlanInput = z
  .object({
    designType: RequestedDesignType.default("auto"),
    diagramKind: DiagramKind.default("architecture"),
    features: z.array(z.string().trim().min(1)).default([]),
    flowDescription: z.string().trim().default(""),
    constraints: z.string().trim().default(""),
    userStories: z.array(UserStoryDraft).default([]),
    // Only sent when the user skips brief review; otherwise the brief already carries the PRD's content.
    prd: PrdDocument.optional(),
  })
  .refine(
    (input) =>
      input.features.length > 0 ||
      input.flowDescription.length > 0 ||
      input.userStories.length > 0 ||
      input.prd !== undefined,
    {
      message: "Provide features, a flow description, user stories or a PRD",
      path: ["features"],
    },
  );
export type PlanInput = z.infer<typeof PlanInput>;
export type PlanInputRaw = z.input<typeof PlanInput>;

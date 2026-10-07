import type { PlanDraft, PrdBrief } from "@/lib/schema/flow-plan";

/** What a good extraction of this repo's CLAUDE.md (used as a PRD) looks like. */
export const flowBrief: PrdBrief = {
  title: "Flow",
  summary: "Chat-driven flowchart and architecture planning tool.",
  designType: "modular-monolith",
  diagramKind: "architecture",
  features: [
    "PRD upload (md, txt, pdf, docx)",
    "Parameter form",
    "Chat refinement with patches",
    "Diagram rendering",
    "Export to Markdown, PNG, SVG, PDF, JSON, CSV",
    "Local project persistence",
  ],
  flowDescription: "1. Upload a PRD\n2. Review the brief\n3. Generate a design\n4. Refine in chat\n5. Export",
  constraints: "No accounts, no server-side storage; request bodies under 4.5 MB",
  personas: ["product manager", "engineer"],
  userStories: [
    {
      id: "upload-prd",
      title: "Design from a PRD",
      persona: "product manager",
      want: "to upload my PRD and get a system design",
      benefit: "I don't have to restate requirements",
      acceptanceCriteria: ["Accepts md, txt, pdf and docx", "Shows the extracted brief before planning"],
      priority: "must",
    },
    {
      id: "refine-chat",
      title: "Refine in chat",
      persona: "engineer",
      want: "to change the design by describing the change",
      benefit: "iterating is fast",
      acceptanceCriteria: ["Existing node ids are kept", "Undo restores the previous version"],
      priority: "must",
    },
    {
      id: "export-design",
      title: "Export the design",
      persona: "engineer",
      want: "to export the design as Markdown or an image",
      benefit: "I can share it with my team",
      acceptanceCriteria: ["Markdown embeds the Mermaid diagram", "PNG is rendered at 2x"],
      priority: "should",
    },
    {
      id: "resume-project",
      title: "Resume a project",
      persona: "engineer",
      want: "my projects to be saved in the browser",
      benefit: "I can continue later",
      acceptanceCriteria: ["Reopening the app restores the last project"],
      priority: "should",
    },
  ],
  openQuestions: ["Should projects sync across devices later?"],
};

export const flowDraft: PlanDraft = {
  title: "Flow",
  summary: "A Next.js app that plans system designs with AI and renders them with Mermaid.",
  diagramKind: "architecture",
  designType: "modular-monolith",
  rationale: "One small team and no server-side storage: a single Next.js deployable is the simplest fit.",
  nodes: [
    { id: "user", label: "User", kind: "actor", rationale: "Product managers and engineers" },
    { id: "web", label: "Web app", kind: "client", tech: "Next.js + React", rationale: "All stories" },
    { id: "api", label: "Plan API", kind: "service", group: "server", tech: "Route handlers", rationale: "upload-prd, refine-chat" },
    { id: "gateway", label: "AI Gateway", kind: "external", rationale: "Model access for upload-prd and refine-chat" },
    { id: "browser-db", label: "IndexedDB", kind: "datastore", rationale: "resume-project" },
    { id: "exporter", label: "Exporters", kind: "function", tech: "Client-side", rationale: "export-design" },
  ],
  edges: [
    { id: "e1", from: "user", to: "web", label: "uses", style: "sync" },
    { id: "e2", from: "web", to: "api", label: "POST /api/plan", style: "sync" },
    { id: "e3", from: "api", to: "gateway", label: "structured output", style: "sync" },
    { id: "e4", from: "web", to: "browser-db", label: "autosave", style: "data" },
    { id: "e5", from: "web", to: "exporter", label: "export", style: "sync" },
  ],
  groups: [{ id: "server", label: "Server" }],
  flows: [
    {
      id: "prd-to-design",
      name: "PRD to design",
      steps: [
        { node: "web", action: "Uploads the PRD" },
        { node: "api", action: "Extracts the brief and plans" },
        { node: "gateway", action: "Runs the model" },
      ],
    },
  ],
  userStories: flowBrief.userStories.map((s) => ({
    ...s,
    nodes:
      s.id === "upload-prd" || s.id === "refine-chat"
        ? ["web", "api", "gateway"]
        : s.id === "export-design"
          ? ["web", "exporter"]
          : ["web", "browser-db"],
    ...(s.id === "upload-prd" ? { flow: "prd-to-design" } : {}),
  })),
  risks: ["AI Gateway outage blocks planning; existing projects stay viewable and exportable."],
  openQuestions: ["Should projects sync across devices later?"],
};

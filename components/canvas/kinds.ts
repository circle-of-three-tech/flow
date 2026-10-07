import type { NodeKind } from "@/lib/schema/flow-plan";

export const KIND_META: Record<NodeKind, { label: string; color: string; defaultLabel: string; slug: string }> = {
  actor: { label: "Actor", color: "#a855f7", defaultLabel: "User", slug: "user" },
  client: { label: "Client", color: "#8b5cf6", defaultLabel: "Web app", slug: "client" },
  gateway: { label: "Gateway", color: "#f59e0b", defaultLabel: "API gateway", slug: "gateway" },
  service: { label: "Service", color: "#4f7cff", defaultLabel: "New service", slug: "service" },
  function: { label: "Function", color: "#38bdf8", defaultLabel: "New function", slug: "function" },
  queue: { label: "Queue", color: "#eab308", defaultLabel: "Job queue", slug: "queue" },
  datastore: { label: "Datastore", color: "#22c55e", defaultLabel: "Database", slug: "database" },
  external: { label: "External", color: "#94a3b8", defaultLabel: "Third-party API", slug: "external" },
  step: { label: "Step", color: "#64748b", defaultLabel: "New step", slug: "step" },
  decision: { label: "Decision", color: "#f97316", defaultLabel: "Decision?", slug: "decision" },
};

export const PALETTE_KINDS: NodeKind[] = [
  "actor",
  "client",
  "gateway",
  "service",
  "function",
  "queue",
  "datastore",
  "external",
  "step",
  "decision",
];

/** First free slug of the form base, base-2, base-3… */
export function uniqueSlug(base: string, taken: Iterable<string>): string {
  const used = new Set(taken);
  if (!used.has(base)) return base;
  for (let i = 2; ; i++) if (!used.has(`${base}-${i}`)) return `${base}-${i}`;
}

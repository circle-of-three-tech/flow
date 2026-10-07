import type { FlowPlan } from "@/lib/schema/flow-plan";

export function makePlan(overrides: Partial<FlowPlan> = {}): FlowPlan {
  return {
    id: "shop",
    title: "Shop checkout",
    summary: "Modular monolith for a small online shop.",
    diagramKind: "architecture",
    designType: "modular-monolith",
    rationale: "One team and under 1k users: a single deployable keeps operations minimal.",
    nodes: [
      { id: "user", label: "Shopper", kind: "actor", rationale: "Places orders" },
      { id: "web", label: "Web app", kind: "client", tech: "Next.js", rationale: "Storefront and checkout UI" },
      { id: "api", label: 'Orders "API"', kind: "service", group: "backend", tech: "Node.js", rationale: "Feature: checkout" },
      { id: "db", label: "Orders DB", kind: "datastore", group: "backend", tech: "Postgres", rationale: "Owned by Orders API" },
      { id: "jobs", label: "Email queue", kind: "queue", group: "backend", rationale: "Email is slow and unreliable" },
      { id: "email", label: "Email provider", kind: "external", rationale: "Feature: order receipts" },
    ],
    edges: [
      { id: "e1", from: "user", to: "web", label: "browses", style: "sync" },
      { id: "e2", from: "web", to: "api", label: "POST /orders", style: "sync" },
      { id: "e3", from: "api", to: "db", style: "data" },
      { id: "e4", from: "api", to: "jobs", label: "order.created", style: "async" },
      { id: "e5", from: "jobs", to: "email", label: "send receipt", style: "async" },
    ],
    groups: [{ id: "backend", label: "Backend" }],
    flows: [
      {
        id: "checkout",
        name: "Checkout",
        steps: [
          { node: "web", action: "Submits cart" },
          { node: "api", action: "Creates order" },
          { node: "email", action: "Sends receipt" },
        ],
      },
    ],
    userStories: [
      {
        id: "guest-checkout",
        title: "Guest checkout",
        persona: "shopper",
        want: "to pay without creating an account",
        benefit: "I can buy quickly",
        acceptanceCriteria: ["Checkout needs only email and payment details", "Order is saved before payment confirmation"],
        priority: "must",
        nodes: ["web", "api", "db"],
        flow: "checkout",
      },
      {
        id: "order-receipt",
        title: "Order receipt",
        persona: "shopper",
        want: "an emailed receipt",
        benefit: "I have proof of purchase",
        acceptanceCriteria: ["Receipt arrives within 5 minutes", "A provider outage retries without duplicates"],
        priority: "should",
        nodes: ["jobs", "email"],
      },
    ],
    risks: ["Email provider outage delays receipts; the queue retries."],
    openQuestions: ["Can guests check out without an account?"],
    version: 1,
    ...overrides,
  };
}

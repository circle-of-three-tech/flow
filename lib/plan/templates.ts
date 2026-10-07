import type { FormState } from "@/lib/plan/form";

export type Template = {
  id: string;
  name: string;
  description: string;
  form: FormState;
};

// Starting points that fill the form. User stories are left for the planner to derive.
export const TEMPLATES: Template[] = [
  {
    id: "saas",
    name: "SaaS subscription app",
    description: "Sign-up, teams, billing and an admin area",
    form: {
      designType: "auto",
      diagramKind: "architecture",
      features: [
        "Email and Google sign-in",
        "Team workspaces with roles",
        "Subscription billing with free trial",
        "Usage dashboard",
        "Transactional email",
        "Admin panel",
      ].join("\n"),
      flowDescription:
        "1. Visitor signs up and verifies their email\n2. Creates a workspace and invites teammates\n3. Starts a 14-day trial\n4. Picks a plan and pays by card\n5. Uses the product; usage appears on the dashboard",
      constraints: "Up to 5k users in year one, 2 developers, low budget, GDPR",
      userStories: [],
    },
  },
  {
    id: "ecommerce",
    name: "E-commerce store",
    description: "Catalog, cart, checkout, orders and fulfilment",
    form: {
      designType: "auto",
      diagramKind: "architecture",
      features: [
        "Product catalog with search and filters",
        "Cart and guest checkout",
        "Card and wallet payments",
        "Order tracking and receipts",
        "Inventory management",
        "Discount codes",
      ].join("\n"),
      flowDescription:
        "1. Shopper searches and browses products\n2. Adds items to the cart\n3. Checks out as a guest or signed in\n4. Pays; the order is confirmed and stock is reserved\n5. Receives a receipt and shipping updates",
      constraints: "Seasonal traffic spikes of 10x, PCI compliance via a payment provider",
      userStories: [],
    },
  },
  {
    id: "chat",
    name: "Real-time chat app",
    description: "Direct and group messaging with presence",
    form: {
      designType: "event-driven",
      diagramKind: "architecture",
      features: [
        "Direct and group conversations",
        "Real-time delivery and typing indicators",
        "Online presence",
        "File and image sharing",
        "Push notifications",
        "Message search",
      ].join("\n"),
      flowDescription:
        "1. User signs in and sees their conversations\n2. Opens a conversation and sends a message\n3. Recipients online see it instantly; offline recipients get a push notification\n4. Users share an image, which is stored and previewed",
      constraints: "50k daily active users, messages delivered in under 300 ms",
      userStories: [],
    },
  },
  {
    id: "marketplace",
    name: "Two-sided marketplace",
    description: "Listings, booking, payouts and reviews",
    form: {
      designType: "auto",
      diagramKind: "architecture",
      features: [
        "Seller onboarding with identity checks",
        "Listings with photos and availability",
        "Search by location and date",
        "Booking with payment held until completion",
        "Seller payouts",
        "Reviews and ratings",
      ].join("\n"),
      flowDescription:
        "1. Seller onboards and creates a listing\n2. Buyer searches and books a slot\n3. Payment is held\n4. After completion, the seller is paid out\n5. Both sides leave reviews",
      constraints: "Marketplace payments must use a regulated provider; small team",
      userStories: [],
    },
  },
  {
    id: "internal-tool",
    name: "Internal admin tool",
    description: "CRUD over company data with approvals and audit",
    form: {
      designType: "modular-monolith",
      diagramKind: "architecture",
      features: [
        "Single sign-on with the company identity provider",
        "Searchable records with create, edit and delete",
        "Approval workflow for changes",
        "Audit log",
        "CSV import and export",
      ].join("\n"),
      flowDescription:
        "1. Employee signs in with SSO\n2. Finds a record and proposes a change\n3. A manager approves or rejects it\n4. The change is applied and written to the audit log",
      constraints: "200 internal users, must run inside the company cloud account",
      userStories: [],
    },
  },
  {
    id: "rag-assistant",
    name: "AI document assistant",
    description: "Upload documents and ask questions with citations",
    form: {
      designType: "auto",
      diagramKind: "architecture",
      features: [
        "Document upload (PDF, Word)",
        "Background ingestion and indexing",
        "Chat answers with citations",
        "Per-team document permissions",
        "Usage limits per plan",
      ].join("\n"),
      flowDescription:
        "1. User uploads documents\n2. Documents are chunked, embedded and indexed in the background\n3. User asks a question\n4. Relevant passages are retrieved and the model answers with citations",
      constraints: "Documents may contain confidential data; answers in under 5 seconds",
      userStories: [],
    },
  },
  {
    id: "onboarding-flow",
    name: "Onboarding user flow",
    description: "A user journey with decisions, not an architecture",
    form: {
      designType: "auto",
      diagramKind: "user-flow",
      features: ["Sign-up", "Email verification", "Profile setup", "Plan selection", "First project"].join("\n"),
      flowDescription:
        "1. User lands on the sign-up page\n2. Signs up with email or Google\n3. Email users verify; if the link expires they can resend it\n4. Completes their profile (can skip)\n5. Chooses free or paid; paid users go through checkout\n6. Creates their first project from a guided empty state",
      constraints: "",
      userStories: [],
    },
  },
];

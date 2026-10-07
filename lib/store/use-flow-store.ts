import { create } from "zustand";
import { applyPatch, EMPTY_PATCH } from "@/lib/plan/apply-patch";
import { EMPTY_FORM, mergeBrief, type FormState } from "@/lib/plan/form";
import { validatePlan, type PlanIssue } from "@/lib/plan/validate-plan";
import type { SavedPositions } from "@/lib/render/layout";
import type { FlowPlan, PlanPatch, PrdBrief } from "@/lib/schema/flow-plan";
import { DEFAULT_MODELS, ModelId, type ModelSettings } from "@/lib/schema/models";
import type { PrdDocument } from "@/lib/schema/prd";

const HISTORY_LIMIT = 50;

export type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  tone?: "error";
};

export type Project = {
  id: string;
  createdAt: number;
  updatedAt: number;
  form: FormState;
  prdName?: string;
  brief?: PrdBrief;
  plan?: FlowPlan;
  past: FlowPlan[];
  future: FlowPlan[];
  issues: PlanIssue[];
  chat: ChatMessage[];
  /** Canvas positions the user dragged; ignored once a regenerated plan has a new id. */
  layout?: { planId: string; positions: SavedPositions };
};

export type ProjectSummary = { id: string; title: string; updatedAt: number };

export type Busy = {
  kind: "reading" | "extracting" | "planning" | "patching" | "repairing";
  detail?: string;
} | null;

export type Notice = { tone: "error" | "info"; text: string } | null;

type FlowState = {
  project: Project;
  projects: ProjectSummary[];
  /** Kept in memory only: it can be megabytes and isn't needed once the brief exists. */
  prd?: PrdDocument;
  busy: Busy;
  notice: Notice;
  selection: string[];
  models: ModelSettings;

  setForm: (patch: Partial<FormState>) => void;
  setPrd: (prd: PrdDocument | undefined, name?: string) => void;
  applyBrief: (brief: PrdBrief) => void;
  commitPlan: (plan: FlowPlan, issues: PlanIssue[]) => void;
  /** A manual edit from the canvas or inspector: same patch path as chat, so it's validated and undoable. */
  editPlan: (patch: Partial<Omit<PlanPatch, "message">>) => void;
  savePositions: (planId: string, positions: SavedPositions) => void;
  resetLayout: () => void;
  setSelection: (ids: string[]) => void;
  setModels: (models: Partial<ModelSettings>) => void;
  loadModels: () => void;
  undo: () => void;
  redo: () => void;
  toggleSelection: (id: string) => void;
  clearSelection: () => void;
  pushChat: (role: ChatMessage["role"], text: string, tone?: ChatMessage["tone"]) => void;
  setBusy: (busy: Busy) => void;
  setNotice: (notice: Notice) => void;
  loadProject: (project: Project) => void;
  setProjects: (projects: ProjectSummary[]) => void;
};

export function newProject(): Project {
  const now = Date.now();
  return {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    form: EMPTY_FORM,
    past: [],
    future: [],
    issues: [],
    chat: [],
  };
}

export function projectTitle(project: Project): string {
  return project.plan?.title ?? project.brief?.title ?? "Untitled project";
}

const MODELS_KEY = "flow:models";

function readModels(): ModelSettings {
  try {
    const stored = JSON.parse(localStorage.getItem(MODELS_KEY) ?? "{}") as Record<string, unknown>;
    const plan = ModelId.safeParse(stored.plan);
    const extract = ModelId.safeParse(stored.extract);
    return {
      plan: plan.success ? plan.data : DEFAULT_MODELS.plan,
      extract: extract.success ? extract.data : DEFAULT_MODELS.extract,
    };
  } catch {
    return { ...DEFAULT_MODELS };
  }
}

export const useFlowStore = create<FlowState>()((set, get) => {
  const updateProject = (fn: (p: Project) => Partial<Project>) =>
    set((state) => ({ project: { ...state.project, ...fn(state.project), updatedAt: Date.now() } }));

  return {
    project: newProject(),
    projects: [],
    busy: null,
    notice: null,
    selection: [],
    // Defaults first so the static render matches; loadModels() reads the saved choice after mount.
    models: { ...DEFAULT_MODELS },

    setForm: (patch) => updateProject((p) => ({ form: { ...p.form, ...patch } })),

    setPrd: (prd, name) => {
      set({ prd });
      updateProject(() => ({ prdName: name, brief: undefined }));
    },

    applyBrief: (brief) => updateProject((p) => ({ brief, form: mergeBrief(p.form, brief) })),

    commitPlan: (plan, issues) => {
      updateProject((p) => ({
        plan,
        issues,
        past: p.plan ? [...p.past, p.plan].slice(-HISTORY_LIMIT) : p.past,
        future: [],
      }));
      set((state) => ({ selection: state.selection.filter((id) => plan.nodes.some((n) => n.id === id)) }));
    },

    editPlan: (patch) => {
      const plan = get().project.plan;
      if (!plan) return;
      const next = applyPatch(plan, { ...EMPTY_PATCH, ...patch });
      get().commitPlan(next, validatePlan(next));
    },

    savePositions: (planId, positions) =>
      updateProject((p) => ({
        layout: {
          planId,
          positions: { ...(p.layout?.planId === planId ? p.layout.positions : {}), ...positions },
        },
      })),

    resetLayout: () => updateProject(() => ({ layout: undefined })),

    setSelection: (ids) =>
      set((state) =>
        ids.length === state.selection.length && ids.every((id) => state.selection.includes(id))
          ? state
          : { selection: ids },
      ),

    setModels: (models) => {
      const next = { ...get().models, ...models };
      set({ models: next });
      try {
        localStorage.setItem(MODELS_KEY, JSON.stringify(next));
      } catch {
        // Storage blocked; the choice lasts for this session only.
      }
    },

    loadModels: () => set({ models: readModels() }),

    undo: () =>
      updateProject((p) => {
        const previous = p.past.at(-1);
        if (!previous) return {};
        return {
          plan: previous,
          issues: validatePlan(previous),
          past: p.past.slice(0, -1),
          future: p.plan ? [p.plan, ...p.future] : p.future,
        };
      }),

    redo: () =>
      updateProject((p) => {
        const [next, ...rest] = p.future;
        if (!next) return {};
        return {
          plan: next,
          issues: validatePlan(next),
          past: p.plan ? [...p.past, p.plan] : p.past,
          future: rest,
        };
      }),

    toggleSelection: (id) =>
      set((state) => ({
        selection: state.selection.includes(id)
          ? state.selection.filter((s) => s !== id)
          : [...state.selection, id],
      })),

    clearSelection: () => set({ selection: [] }),

    pushChat: (role, text, tone) =>
      updateProject((p) => ({ chat: [...p.chat, { id: crypto.randomUUID(), role, text, tone }] })),

    setBusy: (busy) => set({ busy }),
    setNotice: (notice) => set({ notice }),

    loadProject: (project) =>
      set({ project, prd: undefined, selection: [], notice: null, busy: null }),

    setProjects: (projects) => set({ projects }),
  };
});

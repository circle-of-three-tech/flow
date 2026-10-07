import { requestBrief, streamPlan } from "@/lib/client/api";
import { readPrdFile } from "@/lib/input/read-prd-file";
import type { PlanEvent } from "@/lib/plan/events";
import { toPlanInput } from "@/lib/plan/form";
import type { Template } from "@/lib/plan/templates";
import type { PlanIssue } from "@/lib/plan/validate-plan";
import { PlanInput } from "@/lib/schema/flow-plan";
import type { PlanRequest } from "@/lib/schema/requests";
import { useFlowStore, type Busy } from "@/lib/store/use-flow-store";

const state = () => useFlowStore.getState();

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function progressText(event: Extract<PlanEvent, { type: "progress" }>): string {
  const parts = [`${event.nodes} components`, `${event.edges} connections`, `${event.stories} stories`];
  return event.title ? `${event.title}: ${parts.join(", ")}` : parts.join(", ");
}

/** Reads the file, then extracts a brief that pre-fills the form for review. */
export async function uploadPrd(file: File): Promise<void> {
  const s = state();
  s.setNotice(null);
  s.setBusy({ kind: "reading", detail: file.name });
  const result = await readPrdFile(file);
  if (!result.ok) {
    s.setBusy(null);
    s.setNotice({ tone: "error", text: result.error });
    return;
  }
  s.setPrd(result.prd, file.name);
  s.setBusy({ kind: "extracting", detail: file.name });
  try {
    const brief = await requestBrief(result.prd, s.models.extract);
    state().applyBrief(brief);
    state().setNotice({
      tone: "info",
      text: `Read ${file.name}: ${brief.features.length} features, ${brief.userStories.length} user stories. Review the form, then generate.`,
    });
  } catch (error) {
    state().setNotice({ tone: "error", text: messageOf(error) });
  } finally {
    state().setBusy(null);
  }
}

async function runPlan(body: PlanRequest, kind: NonNullable<Busy>["kind"]): Promise<boolean> {
  const s = state();
  s.setBusy({ kind });
  let done = false;
  try {
    await streamPlan({ ...body, model: s.models.plan }, (event) => {
      if (event.type === "progress") state().setBusy({ kind, detail: progressText(event) });
      else if (event.type === "repairing") {
        state().setBusy({ kind: "repairing", detail: `Fixing ${event.count} problem${event.count === 1 ? "" : "s"}` });
      } else if (event.type === "done") {
        state().commitPlan(event.plan, event.issues);
        state().pushChat("assistant", event.message);
        done = true;
      } else if (event.type === "error") {
        throw new Error(event.error);
      }
    });
    if (!done) throw new Error("The planner stopped before finishing. Try again.");
    return true;
  } catch (error) {
    state().pushChat("assistant", messageOf(error), "error");
    state().setNotice({ tone: "error", text: messageOf(error) });
    return false;
  } finally {
    state().setBusy(null);
  }
}

/** Creates a plan from the form. `includePrd` sends the raw PRD, skipping brief review. */
export async function generate({ includePrd = false, extra = "" } = {}): Promise<boolean> {
  const s = state();
  s.setNotice(null);
  const parsed = PlanInput.safeParse(toPlanInput(s.project.form, extra, includePrd ? s.prd : undefined));
  if (!parsed.success) {
    s.setNotice({ tone: "error", text: "Add features, a user flow, user stories or a PRD first." });
    return false;
  }
  return runPlan({ mode: "create", input: parsed.data }, "planning");
}

/** Chat: patches the current plan, or creates one from the message if there is none yet. */
export async function sendChat(text: string): Promise<void> {
  const s = state();
  s.pushChat("user", text);
  const { plan } = s.project;
  if (!plan) {
    await generate({ extra: text });
    return;
  }
  await runPlan({ mode: "patch", plan, instruction: text, selection: s.selection }, "patching");
}

export function fixIssues(issues: PlanIssue[]): Promise<void> {
  return sendChat(`Fix these problems:\n${issues.map((i) => `- ${i.message}`).join("\n")}`);
}

/** Fills the form from a template, after confirming if it would overwrite the user's input. */
export function applyTemplate(template: Template): void {
  const s = state();
  const { form } = s.project;
  const hasInput = !!(form.features.trim() || form.flowDescription.trim() || form.constraints.trim() || form.userStories.length);
  if (hasInput && !confirm(`Replace the current form with the "${template.name}" template?`)) return;
  s.setForm(template.form);
  s.setNotice({ tone: "info", text: `Loaded the ${template.name} template. Adjust it, then generate.` });
}

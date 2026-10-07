"use client";

import { SparkIcon } from "@/components/icons";
import { Field, inputClass } from "@/components/ui";
import { MODEL_INFO, ModelId, type ModelSettings } from "@/lib/schema/models";
import { useFlowStore } from "@/lib/store/use-flow-store";

const ROLES: { key: keyof ModelSettings; label: string; hint: string }[] = [
  { key: "plan", label: "Design model", hint: "Plans and edits the design" },
  { key: "extract", label: "PRD reading model", hint: "Extracts the brief from uploads" },
];

export function ModelMenu() {
  const models = useFlowStore((s) => s.models);
  const setModels = useFlowStore((s) => s.setModels);
  const busy = useFlowStore((s) => !!s.busy);

  return (
    <details className="relative">
      <summary
        title={`Design model: ${MODEL_INFO[models.plan].label}`}
        className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-sm font-medium hover:bg-subtle [&::-webkit-details-marker]:hidden"
      >
        <SparkIcon /> <span className="hidden md:inline">{MODEL_INFO[models.plan].label}</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 space-y-4 rounded-xl border border-line bg-panel p-4 shadow-xl">
        {ROLES.map((role) => (
          <Field key={role.key} label={role.label} hint={role.hint}>
            <select
              className={inputClass}
              value={models[role.key]}
              disabled={busy}
              onChange={(e) => setModels({ [role.key]: e.target.value as ModelId })}
            >
              {ModelId.options.map((id) => (
                <option key={id} value={id}>
                  {MODEL_INFO[id].label}: {MODEL_INFO[id].note}
                </option>
              ))}
            </select>
          </Field>
        ))}
        <p className="text-xs text-muted">ChatGPT models, using your OpenAI key (or the Vercel AI Gateway). Your choice is saved in this browser.</p>
      </div>
    </details>
  );
}

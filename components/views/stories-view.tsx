"use client";

import { PRIORITY_LABEL } from "@/lib/export/stories-csv";
import type { Priority } from "@/lib/schema/flow-plan";
import { useFlowStore } from "@/lib/store/use-flow-store";

const ORDER: Priority[] = ["must", "should", "could", "wont"];
const TONE: Record<Priority, string> = {
  must: "bg-accent-soft text-accent",
  should: "bg-subtle text-fg",
  could: "bg-subtle text-muted",
  wont: "bg-subtle text-muted line-through",
};

export function StoriesView() {
  const plan = useFlowStore((s) => s.project.plan);
  const selection = useFlowStore((s) => s.selection);
  const setSelection = useFlowStore((s) => s.toggleSelection);

  if (!plan) return <p className="p-6 text-sm text-muted">Generate a design to see its user stories.</p>;
  if (!plan.userStories.length) return <p className="p-6 text-sm text-muted">This design has no user stories yet.</p>;

  const nodeLabel = new Map(plan.nodes.map((n) => [n.id, n.label]));
  const flowName = new Map(plan.flows.map((f) => [f.id, f.name]));

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-3xl space-y-6 p-6">
        {ORDER.map((priority) => {
          const stories = plan.userStories.filter((s) => s.priority === priority);
          if (!stories.length) return null;
          return (
            <section key={priority} className="space-y-3">
              <h2 className="text-sm font-semibold text-muted">
                {PRIORITY_LABEL[priority]} <span className="font-normal">({stories.length})</span>
              </h2>
              {stories.map((story) => (
                <article key={story.id} className="space-y-3 rounded-xl border border-line bg-panel p-4">
                  <header className="flex items-start justify-between gap-3">
                    <h3 className="font-medium">{story.title}</h3>
                    <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${TONE[priority]}`}>
                      {PRIORITY_LABEL[priority]}
                    </span>
                  </header>
                  <p className="text-sm">
                    As a <b>{story.persona}</b>, I want {story.want}, so that {story.benefit}.
                  </p>
                  {story.acceptanceCriteria.length > 0 && (
                    <ul className="list-disc space-y-1 pl-5 text-sm text-muted">
                      {story.acceptanceCriteria.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  )}
                  <footer className="flex flex-wrap items-center gap-1.5 text-xs">
                    {story.nodes.map((id) => (
                      <button
                        key={id}
                        type="button"
                        onClick={() => setSelection(id)}
                        title="Select in diagram"
                        className={`rounded-full border px-2 py-0.5 ${
                          selection.includes(id) ? "border-accent bg-accent-soft" : "border-line hover:border-accent"
                        }`}
                      >
                        {nodeLabel.get(id) ?? id}
                      </button>
                    ))}
                    {story.flow && <span className="text-muted">Flow: {flowName.get(story.flow) ?? story.flow}</span>}
                  </footer>
                </article>
              ))}
            </section>
          );
        })}
      </div>
    </div>
  );
}

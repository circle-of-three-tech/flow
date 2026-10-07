"use client";

import { useEffect, useState, type KeyboardEvent } from "react";
import { KIND_META, PALETTE_KINDS, uniqueSlug } from "@/components/canvas/kinds";
import { XIcon } from "@/components/icons";
import { Button, Field, inputClass } from "@/components/ui";
import { EdgeStyle, type FlowEdge, type FlowGroup, type FlowNode, type FlowPlan, type NodeKind } from "@/lib/schema/flow-plan";
import { useFlowStore } from "@/lib/store/use-flow-store";

export type InspectorTarget =
  | { type: "node"; id: string }
  | { type: "edge"; id: string }
  | { type: "group"; id: string }
  | { type: "many"; count: number };

const EDGE_STYLE_LABELS: Record<EdgeStyle, string> = {
  sync: "Synchronous call",
  async: "Async (event / job)",
  data: "Data read / write",
};

/** Text input that commits on blur or Enter, so typing doesn't create a version per keystroke. */
function CommitInput({
  value,
  onCommit,
  multiline,
  placeholder,
  required,
}: {
  value: string;
  onCommit: (value: string) => void;
  multiline?: boolean;
  placeholder?: string;
  required?: boolean;
}) {
  const [draft, setDraft] = useState(value);
  useEffect(() => setDraft(value), [value]);
  const commit = () => {
    const next = draft.trim();
    if (required && !next) return setDraft(value);
    if (next !== value) onCommit(next);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Enter" && !(multiline && e.shiftKey)) {
      e.preventDefault();
      (e.target as HTMLElement).blur();
    }
    if (e.key === "Escape") {
      setDraft(value);
      (e.target as HTMLElement).blur();
    }
  };
  return multiline ? (
    <textarea
      className={`${inputClass} min-h-16 resize-y`}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  ) : (
    <input
      className={inputClass}
      value={draft}
      placeholder={placeholder}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={onKeyDown}
    />
  );
}

function NodeInspector({ node, plan }: { node: FlowNode; plan: FlowPlan }) {
  const edit = useFlowStore((s) => s.editPlan);
  const update = (changes: Partial<FlowNode>) => {
    const next = { ...node, ...changes };
    if (!next.tech) delete next.tech;
    if (!next.group) delete next.group;
    edit({ upsertNodes: [next] });
  };
  const stories = plan.userStories.filter((s) => s.nodes.includes(node.id));

  return (
    <div className="space-y-3">
      <Field label="Label">
        <CommitInput value={node.label} required onCommit={(label) => update({ label })} />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Kind">
          <select className={inputClass} value={node.kind} onChange={(e) => update({ kind: e.target.value as NodeKind })}>
            {PALETTE_KINDS.map((k) => (
              <option key={k} value={k}>
                {KIND_META[k].label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Group">
          <select
            className={inputClass}
            value={node.group ?? ""}
            onChange={(e) => {
              if (e.target.value !== "__new") return update({ group: e.target.value || undefined });
              const label = prompt("Group name")?.trim();
              if (!label) return;
              const id = uniqueSlug(
                label.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "") || "group",
                plan.groups.map((g) => g.id),
              );
              edit({ upsertGroups: [{ id, label }], upsertNodes: [{ ...node, group: id }] });
            }}
          >
            <option value="">None</option>
            {plan.groups.map((g) => (
              <option key={g.id} value={g.id}>
                {g.label}
              </option>
            ))}
            <option value="__new">New group…</option>
          </select>
        </Field>
      </div>
      <Field label="Tech" hint="Optional">
        <CommitInput value={node.tech ?? ""} placeholder="e.g. Postgres (managed)" onCommit={(tech) => update({ tech })} />
      </Field>
      <Field label="Why it exists">
        <CommitInput
          value={node.rationale}
          multiline
          placeholder="The feature, story or constraint this serves"
          onCommit={(rationale) => update({ rationale })}
        />
      </Field>
      <div className="space-y-1">
        <p className="text-xs font-medium text-muted">User stories</p>
        {stories.length ? (
          <ul className="space-y-0.5 text-sm">
            {stories.map((s) => (
              <li key={s.id}>{s.title}</li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-warn">No story uses this component yet.</p>
        )}
      </div>
      <Button className="w-full text-danger" onClick={() => edit({ removeNodes: [node.id] })}>
        Delete component
      </Button>
    </div>
  );
}

function EdgeInspector({ edge, plan }: { edge: FlowEdge; plan: FlowPlan }) {
  const edit = useFlowStore((s) => s.editPlan);
  const label = (id: string) => plan.nodes.find((n) => n.id === id)?.label ?? id;
  const update = (changes: Partial<FlowEdge>) => {
    const next = { ...edge, ...changes };
    if (!next.label) delete next.label;
    edit({ upsertEdges: [next] });
  };
  return (
    <div className="space-y-3">
      <p className="text-sm">
        {label(edge.from)} <span className="text-muted">→</span> {label(edge.to)}
      </p>
      <Field label="Label">
        <CommitInput value={edge.label ?? ""} placeholder="e.g. POST /orders" onCommit={(l) => update({ label: l })} />
      </Field>
      <Field label="Type">
        <select className={inputClass} value={edge.style} onChange={(e) => update({ style: e.target.value as EdgeStyle })}>
          {EdgeStyle.options.map((s) => (
            <option key={s} value={s}>
              {EDGE_STYLE_LABELS[s]}
            </option>
          ))}
        </select>
      </Field>
      <Button
        className="w-full"
        onClick={() => edit({ upsertEdges: [{ ...edge, from: edge.to, to: edge.from }] })}
      >
        Reverse direction
      </Button>
      <Button className="w-full text-danger" onClick={() => edit({ removeEdges: [edge.id] })}>
        Delete connection
      </Button>
    </div>
  );
}

function GroupInspector({ group }: { group: FlowGroup }) {
  const edit = useFlowStore((s) => s.editPlan);
  return (
    <div className="space-y-3">
      <Field label="Group name">
        <CommitInput value={group.label} required onCommit={(label) => edit({ upsertGroups: [{ ...group, label }] })} />
      </Field>
      <Button className="w-full text-danger" onClick={() => edit({ removeGroups: [group.id] })}>
        Remove group (keeps its components)
      </Button>
    </div>
  );
}

export function Inspector({
  target,
  plan,
  onClose,
}: {
  target: InspectorTarget;
  plan: FlowPlan;
  onClose: () => void;
}) {
  let title = "";
  let body: React.ReactNode = null;
  if (target.type === "node") {
    const node = plan.nodes.find((n) => n.id === target.id);
    if (!node) return null;
    title = KIND_META[node.kind].label;
    body = <NodeInspector key={node.id} node={node} plan={plan} />;
  } else if (target.type === "edge") {
    const edge = plan.edges.find((e) => e.id === target.id);
    if (!edge) return null;
    title = "Connection";
    body = <EdgeInspector key={edge.id} edge={edge} plan={plan} />;
  } else if (target.type === "group") {
    const group = plan.groups.find((g) => g.id === target.id);
    if (!group) return null;
    title = "Group";
    body = <GroupInspector key={group.id} group={group} />;
  } else {
    title = `${target.count} selected`;
    body = (
      <p className="text-sm text-muted">
        Press Delete to remove them, or describe a change in chat. The selection is sent as context.
      </p>
    );
  }

  return (
    <aside
      aria-label="Inspector"
      className="absolute right-3 top-3 z-10 max-h-[calc(100%-1.5rem)] w-72 overflow-y-auto rounded-xl border border-line bg-panel p-4 shadow-xl"
    >
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold">{title}</h2>
        <button type="button" aria-label="Close inspector" onClick={onClose} className="rounded p-1 text-muted hover:bg-subtle hover:text-fg">
          <XIcon className="size-3.5" />
        </button>
      </header>
      {body}
    </aside>
  );
}

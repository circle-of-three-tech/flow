"use client";

import { useRef } from "react";
import { FolderIcon, PlusIcon, XIcon } from "@/components/icons";
import { deleteProject, loadProject } from "@/lib/store/persistence";
import { newProject, useFlowStore } from "@/lib/store/use-flow-store";

const dateFormat = new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" });

export function ProjectMenu() {
  const projects = useFlowStore((s) => s.projects);
  const currentId = useFlowStore((s) => s.project.id);
  const load = useFlowStore((s) => s.loadProject);
  const setProjects = useFlowStore((s) => s.setProjects);
  const busy = useFlowStore((s) => s.busy);
  const menu = useRef<HTMLDetailsElement>(null);
  const close = () => {
    if (menu.current) menu.current.open = false;
  };

  return (
    <details ref={menu} className="relative">
      <summary className="inline-flex h-9 cursor-pointer list-none items-center gap-1.5 rounded-lg border border-line bg-panel px-3 text-sm font-medium hover:bg-subtle [&::-webkit-details-marker]:hidden">
        <FolderIcon /> <span className="hidden sm:inline">Projects</span>
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-72 overflow-hidden rounded-xl border border-line bg-panel py-1 shadow-xl">
        <button
          type="button"
          disabled={!!busy}
          onClick={() => {
            load(newProject());
            close();
          }}
          className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-subtle disabled:opacity-45"
        >
          <PlusIcon /> New project
        </button>
        {projects.length > 0 && <div className="my-1 border-t border-line" />}
        <ul className="max-h-80 overflow-y-auto">
          {projects.map((p) => (
            <li key={p.id} className="group flex items-center hover:bg-subtle">
              <button
                type="button"
                disabled={!!busy}
                onClick={async () => {
                  const project = await loadProject(p.id);
                  if (project) load(project);
                  close();
                }}
                className="min-w-0 flex-1 px-3 py-2 text-left disabled:opacity-45"
              >
                <span className={`block truncate text-sm ${p.id === currentId ? "font-semibold text-accent" : ""}`}>
                  {p.title}
                </span>
                <span className="block text-xs text-muted">{dateFormat.format(p.updatedAt)}</span>
              </button>
              <button
                type="button"
                aria-label={`Delete ${p.title}`}
                className="mr-2 rounded p-1 text-muted opacity-0 hover:bg-panel hover:text-danger focus:opacity-100 group-hover:opacity-100"
                onClick={async () => {
                  if (!confirm(`Delete "${p.title}"? This can't be undone.`)) return;
                  setProjects(await deleteProject(p.id));
                  if (p.id === currentId) load(newProject());
                }}
              >
                <XIcon className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      </div>
    </details>
  );
}

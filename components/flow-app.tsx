"use client";

import { useEffect, useState } from "react";
import { ChatPanel } from "@/components/chat/chat-panel";
import { ExportMenu } from "@/components/header/export-menu";
import { ModelMenu } from "@/components/header/model-menu";
import { ProjectMenu } from "@/components/header/project-menu";
import { LogoIcon, RedoIcon, UndoIcon } from "@/components/icons";
import { SetupPanel } from "@/components/setup/setup-panel";
import { Button, Tabs } from "@/components/ui";
import { CanvasView } from "@/components/views/canvas-view";
import { MermaidView } from "@/components/views/diagram-view";
import { IssuesBar } from "@/components/views/issues-bar";
import { MarkdownView } from "@/components/views/markdown-view";
import { StoriesView } from "@/components/views/stories-view";
import {
  isBlank,
  listProjects,
  loadProject,
  readLastProjectId,
  saveProject,
  writeLastProjectId,
} from "@/lib/store/persistence";
import { projectTitle, useFlowStore } from "@/lib/store/use-flow-store";

/** Restores the last project, then autosaves to IndexedDB (debounced). */
function usePersistence() {
  useEffect(() => {
    let cancelled = false;
    useFlowStore.getState().loadModels();
    void (async () => {
      const { setProjects, loadProject: load } = useFlowStore.getState();
      setProjects(await listProjects());
      const lastId = readLastProjectId();
      const last = lastId ? await loadProject(lastId) : undefined;
      if (last && !cancelled && isBlank(useFlowStore.getState().project)) load(last);
    })();

    let timer: ReturnType<typeof setTimeout> | undefined;
    const unsubscribe = useFlowStore.subscribe((state, previous) => {
      if (state.project === previous.project) return;
      writeLastProjectId(state.project.id);
      if (isBlank(state.project)) return;
      clearTimeout(timer);
      const project = state.project;
      timer = setTimeout(async () => {
        const projects = await saveProject(project);
        if (projects.length) useFlowStore.getState().setProjects(projects);
      }, 400);
    });
    return () => {
      cancelled = true;
      clearTimeout(timer);
      unsubscribe();
    };
  }, []);
}

function useUndoShortcuts() {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest("input, textarea, select, [contenteditable]")) return;
      if (!(event.metaKey || event.ctrlKey) || event.key.toLowerCase() !== "z") return;
      const { undo, redo, busy } = useFlowStore.getState();
      if (busy) return;
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);
}

function Header() {
  const title = useFlowStore((s) => projectTitle(s.project));
  const canUndo = useFlowStore((s) => s.project.past.length > 0 && !s.busy);
  const canRedo = useFlowStore((s) => s.project.future.length > 0 && !s.busy);
  const undo = useFlowStore((s) => s.undo);
  const redo = useFlowStore((s) => s.redo);

  return (
    <header className="flex h-14 shrink-0 items-center gap-3 border-b border-line bg-panel px-4">
      <span className="flex items-center gap-2 font-semibold">
        <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-accent-fg">
          <LogoIcon className="size-4" />
        </span>
        Flow
      </span>
      <span className="hidden min-w-0 truncate text-sm text-muted sm:block">/ {title}</span>
      <div className="ml-auto flex items-center gap-1.5">
        <Button variant="ghost" aria-label="Undo" title="Undo (Ctrl+Z)" disabled={!canUndo} onClick={undo} className="w-9 px-0">
          <UndoIcon />
        </Button>
        <Button variant="ghost" aria-label="Redo" title="Redo (Ctrl+Shift+Z)" disabled={!canRedo} onClick={redo} className="w-9 px-0">
          <RedoIcon />
        </Button>
        <ModelMenu />
        <ProjectMenu />
        <ExportMenu />
      </div>
    </header>
  );
}

type SideTab = "setup" | "chat";
type View = "canvas" | "mermaid" | "stories" | "markdown";

export function FlowApp() {
  usePersistence();
  useUndoShortcuts();
  const [side, setSide] = useState<SideTab>("setup");
  const [view, setView] = useState<View>("canvas");
  const storyCount = useFlowStore((s) => s.project.plan?.userStories.length ?? 0);
  const projectId = useFlowStore((s) => s.project.id);
  const hasPlan = useFlowStore((s) => !!s.project.plan);

  // Opening a project lands on chat if it has a design, otherwise on setup.
  useEffect(() => {
    setSide(useFlowStore.getState().project.plan ? "chat" : "setup");
  }, [projectId]);

  return (
    <div className="flex h-dvh flex-col">
      <Header />
      <div className="flex min-h-0 flex-1 flex-col lg:flex-row">
        <aside className="flex h-[48dvh] min-h-0 shrink-0 flex-col border-b border-line bg-panel lg:h-auto lg:w-[400px] lg:border-b-0 lg:border-r">
          <div className="p-3 pb-0">
            <Tabs<SideTab>
              label="Panel"
              value={side}
              onChange={setSide}
              options={[
                { value: "setup", label: "Setup" },
                { value: "chat", label: "Chat" },
              ]}
            />
          </div>
          {side === "setup" ? <SetupPanel onGenerated={() => setSide("chat")} /> : <ChatPanel />}
        </aside>
        <main className="flex min-h-0 min-w-0 flex-1 flex-col">
          {hasPlan && (
            <div className="flex items-center gap-3 border-b border-line bg-panel px-4 py-2">
              <div className="w-full max-w-md">
                <Tabs<View>
                  label="View"
                  value={view}
                  onChange={setView}
                  options={[
                    { value: "canvas", label: "Canvas" },
                    { value: "mermaid", label: "Mermaid" },
                    { value: "stories", label: `Stories (${storyCount})` },
                    { value: "markdown", label: "Markdown" },
                  ]}
                />
              </div>
            </div>
          )}
          {!hasPlan || view === "canvas" ? (
            <CanvasView onShowMermaid={() => setView("mermaid")} />
          ) : view === "mermaid" ? (
            <MermaidView />
          ) : view === "stories" ? (
            <StoriesView />
          ) : (
            <MarkdownView />
          )}
          <IssuesBar />
        </main>
      </div>
    </div>
  );
}

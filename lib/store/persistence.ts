import { createStore, del, get, set, type UseStore } from "idb-keyval";
import { projectTitle, type Project, type ProjectSummary } from "@/lib/store/use-flow-store";

const INDEX_KEY = "index";
const LAST_KEY = "flow:last-project";

// IndexedDB can be missing or blocked (private windows, previews); every call degrades to a no-op.
let db: UseStore | undefined;
function store(): UseStore | undefined {
  if (!db && typeof indexedDB !== "undefined") db = createStore("flow", "projects");
  return db;
}

async function safely<T>(fn: (s: UseStore) => Promise<T>, fallback: T): Promise<T> {
  const s = store();
  if (!s) return fallback;
  try {
    return await fn(s);
  } catch (error) {
    console.warn("Project storage unavailable", error);
    return fallback;
  }
}

export function isBlank(project: Project): boolean {
  return !project.plan && !project.brief && project.chat.length === 0;
}

export function listProjects(): Promise<ProjectSummary[]> {
  return safely(async (s) => ((await get<ProjectSummary[]>(INDEX_KEY, s)) ?? []), []);
}

export function loadProject(id: string): Promise<Project | undefined> {
  return safely((s) => get<Project>(`p:${id}`, s), undefined);
}

export async function saveProject(project: Project): Promise<ProjectSummary[]> {
  return safely(async (s) => {
    await set(`p:${project.id}`, project, s);
    const index = ((await get<ProjectSummary[]>(INDEX_KEY, s)) ?? []).filter((p) => p.id !== project.id);
    const next = [{ id: project.id, title: projectTitle(project), updatedAt: project.updatedAt }, ...index];
    await set(INDEX_KEY, next, s);
    return next;
  }, []);
}

export async function deleteProject(id: string): Promise<ProjectSummary[]> {
  return safely(async (s) => {
    await del(`p:${id}`, s);
    const next = ((await get<ProjectSummary[]>(INDEX_KEY, s)) ?? []).filter((p) => p.id !== id);
    await set(INDEX_KEY, next, s);
    return next;
  }, []);
}

export function readLastProjectId(): string | null {
  try {
    return localStorage.getItem(LAST_KEY);
  } catch {
    return null;
  }
}

export function writeLastProjectId(id: string): void {
  try {
    localStorage.setItem(LAST_KEY, id);
  } catch {
    // Storage blocked; the app just opens a fresh project next time.
  }
}

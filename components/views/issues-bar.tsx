"use client";

import { AlertIcon } from "@/components/icons";
import { Button } from "@/components/ui";
import { fixIssues } from "@/lib/client/actions";
import { useFlowStore } from "@/lib/store/use-flow-store";

export function IssuesBar() {
  const issues = useFlowStore((s) => s.project.issues);
  const busy = useFlowStore((s) => s.busy);
  if (!issues.length) return null;

  const errors = issues.filter((i) => i.level === "error").length;
  const warnings = issues.length - errors;
  const summary = [
    errors && `${errors} error${errors === 1 ? "" : "s"}`,
    warnings && `${warnings} warning${warnings === 1 ? "" : "s"}`,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <details className="border-t border-line bg-panel">
      <summary className="flex cursor-pointer items-center gap-2 px-4 py-2 text-sm">
        <AlertIcon className={errors ? "text-danger" : "text-warn"} />
        <span className="font-medium">Design checks</span>
        <span className="text-muted">{summary}</span>
      </summary>
      <div className="max-h-48 space-y-2 overflow-y-auto px-4 pb-3">
        <ul className="space-y-1 text-sm">
          {issues.map((issue, i) => (
            <li key={`${issue.code}-${i}`} className="flex gap-2">
              <span className={`w-14 shrink-0 text-xs font-medium uppercase ${issue.level === "error" ? "text-danger" : "text-warn"}`}>
                {issue.level}
              </span>
              <span>{issue.message}</span>
            </li>
          ))}
        </ul>
        <Button disabled={!!busy} onClick={() => void fixIssues(issues)}>
          Ask Flow to fix these
        </Button>
      </div>
    </details>
  );
}

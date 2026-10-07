"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui";
import { toMarkdown } from "@/lib/export/markdown";
import { useFlowStore } from "@/lib/store/use-flow-store";

export function MarkdownView() {
  const plan = useFlowStore((s) => s.project.plan);
  const markdown = useMemo(() => (plan ? toMarkdown(plan) : ""), [plan]);
  const [copied, setCopied] = useState(false);

  if (!plan) return <p className="p-6 text-sm text-muted">Generate a design to see its Markdown report.</p>;

  return (
    <div className="relative min-h-0 flex-1">
      <pre className="absolute inset-0 overflow-auto whitespace-pre-wrap p-6 font-mono text-xs leading-relaxed">
        {markdown}
      </pre>
      <Button
        className="absolute right-4 top-4"
        onClick={async () => {
          await navigator.clipboard.writeText(markdown);
          setCopied(true);
          setTimeout(() => setCopied(false), 1500);
        }}
      >
        {copied ? "Copied" : "Copy"}
      </Button>
    </div>
  );
}

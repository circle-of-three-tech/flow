export type MermaidTheme = "default" | "dark";

let sequence = 0;
let queue: Promise<unknown> = Promise.resolve();

async function render(code: string, theme: MermaidTheme): Promise<string> {
  const { default: mermaid } = await import("mermaid");
  mermaid.initialize({
    startOnLoad: false,
    // Strict mode sanitizes labels, so the SVG is safe to inject.
    securityLevel: "strict",
    // SVG <text> instead of <foreignObject> HTML, so PNG export doesn't taint the canvas.
    htmlLabels: false,
    theme,
    fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif",
  });
  const { svg } = await mermaid.render(`flow-mermaid-${++sequence}`, code);
  return svg;
}

/** Browser only. Renders are serialized because mermaid.initialize is global state. */
export function renderSvg(code: string, theme: MermaidTheme = "default"): Promise<string> {
  const run = queue.then(() => render(code, theme));
  queue = run.catch(() => undefined);
  return run;
}

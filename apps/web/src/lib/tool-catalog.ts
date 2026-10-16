/** The interactive tools, in picker order. Shared by the tools page, the landing page and the navbar. */
export const toolCatalog = [
  {
    id: "computer",
    label: "Computer",
    blurb: "Type on a 1984 desk computer and watch the screen answer.",
    keywords: ["computer", "komputer", "keyboard", "crt", "screen", "layar"],
  },
  {
    id: "rocket",
    label: "Rocket",
    blurb: "Throttle the engines and read thrust, lift and height live.",
    keywords: ["rocket", "roket", "launch", "luncur", "thrust", "dorong", "space", "luar angkasa", "orbit"],
  },
  {
    id: "engine",
    label: "Engine",
    blurb: "A two-cylinder engine with pistons, valves and a live pressure graph.",
    keywords: ["engine", "mesin", "piston", "motor", "combustion", "pembakaran", "valve", "katup", "crank", "rpm"],
  },
  {
    id: "microscope-lab",
    label: "Microscope",
    blurb: "Swap lenses, focus and light a sample on a lab microscope.",
    keywords: ["microscope", "mikroskop", "lens", "lensa", "cell", "magnif", "perbesar", "focus", "fokus"],
  },
  {
    id: "typewriter",
    label: "Typewriter",
    blurb: "Follow one keystroke from key lever to typebar to paper.",
    keywords: ["typewriter", "mesin ketik", "ketik", "typebar", "ribbon", "pita", "carriage"],
  },
  {
    id: "printer",
    label: "3D printer",
    blurb: "Print an object layer by layer, then pull the printer apart.",
    keywords: ["3d", "printer", "print", "cetak", "fdm", "filament", "nozzle", "extruder", "layer"],
  },
] as const;

export type ToolId = (typeof toolCatalog)[number]["id"];

export const toolHref = (id: ToolId) => `/start?tool=${id}`;

/** The tool whose keywords best match what someone typed, or null when nothing fits. */
export function matchTool(query: string): ToolId | null {
  const text = query.toLocaleLowerCase();
  let best: { id: ToolId; score: number } | null = null;
  for (const tool of toolCatalog) {
    const score = tool.keywords.reduce((sum, keyword) => sum + (text.includes(keyword) ? keyword.length : 0), 0);
    if (score > 0 && (!best || score > best.score)) best = { id: tool.id, score };
  }
  return best?.id ?? null;
}

/** Opens the tool that fits a question and hands the question to the assistant there. */
export function askHref(question: string) {
  const text = question.trim().slice(0, 500);
  const params = new URLSearchParams();
  const tool = matchTool(text);
  if (tool) params.set("tool", tool);
  if (text) params.set("ask", text);
  return params.size ? `/start?${params}` : "/start";
}

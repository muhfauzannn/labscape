"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const figures = [
  { id: "microscope", label: "Microscope", hint: "Light path" },
  { id: "computer", label: "Computer", hint: "Type on the screen" },
  { id: "rocket", label: "Rocket", hint: "Launch simulation" },
  { id: "engine", label: "Engine", hint: "Four-stroke cycle" },
  { id: "microscope-lab", label: "Microscope lab", hint: "Parts and focus" },
] as const;

type FigureId = (typeof figures)[number]["id"];

const tools = {
  microscope: dynamic(() => import("./figures/microscope/figure").then((m) => m.MicroscopeFigure)),
  computer: dynamic(() => import("./figures/computer/art").then((m) => m.ComputerArt)),
  rocket: dynamic(() => import("./figures/rocket/art").then((m) => m.RocketArt)),
  engine: dynamic(() => import("./figures/engine/art").then((m) => m.EngineArt)),
  "microscope-lab": dynamic(() => import("./figures/microscope-lab/art").then((m) => m.MicroscopeArt)),
};

export function SvgTools() {
  const [selected, setSelected] = useState<FigureId>("microscope");
  const selectedTool = figures.find((figure) => figure.id === selected)!;
  const Tool = tools[selected];

  return (
    <div className="svg-tools-shell">
      <div className="svg-tools-heading">
        <div>
          <span className="svg-tools-kicker">TOOLS / SVG</span>
          <h1>SVG tools</h1>
          <p>Choose a figure and try it.</p>
        </div>
      </div>
      <nav className="svg-tools-list" aria-label="SVG tools">
        {figures.map((figure) => (
          <Button
            key={figure.id}
            type="button"
            variant={selected === figure.id ? "primary" : "secondary"}
            size="sm"
            aria-current={selected === figure.id ? "true" : undefined}
            onClick={() => setSelected(figure.id)}
          >
            {figure.label}
          </Button>
        ))}
      </nav>
      <section className="svg-tools-workspace" aria-labelledby="svg-tool-title">
        <div className="svg-tools-workspace-heading">
          <h2 id="svg-tool-title">{selectedTool.label}</h2>
          <span>{selectedTool.hint}</span>
        </div>
        <div className="svg-tools-figure" key={selected}>
          <Tool />
        </div>
      </section>
    </div>
  );
}

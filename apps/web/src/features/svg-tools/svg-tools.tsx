"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ChevronDown, SlidersHorizontal, X } from "lucide-react";

const figures = [
  { id: "microscope", label: "Light path" },
  { id: "computer", label: "Computer" },
  { id: "rocket", label: "Rocket" },
  { id: "engine", label: "Engine" },
  { id: "microscope-lab", label: "Microscope" },
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
  const [controlsOpen, setControlsOpen] = useState(false);
  const title = figures.find((figure) => figure.id === selected)!.label;
  const Tool = tools[selected];

  function selectFigure(id: FigureId) {
    setSelected(id);
    setControlsOpen(false);
    window.scrollTo(0, 0);
  }

  return (
    <div className="svg-tools-shell">
      <section className="svg-tools-workspace" aria-label={`${title} tool`}>
        <div id="svg-tools-figure-controls" className="svg-tools-figure" data-controls-open={controlsOpen} key={selected}>
          <Tool />
        </div>
      </section>
      <div className="svg-tools-dock" role="group" aria-label="SVG tool controls">
        <div className="svg-tools-picker">
          <span className="svg-tools-picker-label">Tool</span>
          <div className="svg-tools-picker-wrap">
            <select aria-label="Choose a tool" value={selected} onChange={(event) => selectFigure(event.target.value as FigureId)}>
              {figures.map((figure) => <option key={figure.id} value={figure.id}>{figure.label}</option>)}
            </select>
            <ChevronDown aria-hidden="true" size={15} />
          </div>
        </div>
        <span className="svg-tools-dock-rule" aria-hidden="true" />
        <button className="svg-tools-controls-toggle" type="button" aria-expanded={controlsOpen} aria-controls="svg-tools-figure-controls" onClick={() => setControlsOpen((open) => !open)}>
          {controlsOpen ? <X aria-hidden="true" size={17} /> : <SlidersHorizontal aria-hidden="true" size={17} />}
          <span>{controlsOpen ? "Close controls" : "Controls"}</span>
        </button>
      </div>
    </div>
  );
}

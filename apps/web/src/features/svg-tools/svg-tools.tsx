"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { Check, ChevronDown, SlidersHorizontal, X } from "lucide-react";
import { toolCatalog } from "@/lib/tool-catalog";
import { LiveAssistant } from "./live-assistant";

const figures = toolCatalog;

type FigureId = (typeof figures)[number]["id"];

const tools = {
  computer: dynamic(() => import("./figures/computer/art").then((m) => m.ComputerArt)),
  rocket: dynamic(() => import("./figures/rocket/art").then((m) => m.RocketArt)),
  engine: dynamic(() => import("./figures/engine/art").then((m) => m.EngineArt)),
  "microscope-lab": dynamic(() => import("./figures/microscope-lab/art").then((m) => m.MicroscopeArt)),
  printer: dynamic(() => import("./figures/printer/figure").then((m) => m.PrinterFigure)),
  typewriter: dynamic(() => import("./figures/typewriter/figure").then((m) => m.TypewriterFigure)),
};

export function SvgTools() {
  const requested = useSearchParams().get("tool");
  const [selected, setSelected] = useState<FigureId>(
    () => figures.find((figure) => figure.id === requested)?.id ?? "computer",
  );
  const [controlsOpen, setControlsOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const figureRootRef = useRef<HTMLDivElement>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const optionRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const typeahead = useRef("");
  const typeaheadTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const title = figures.find((figure) => figure.id === selected)!.label;
  const Tool = tools[selected];

  useEffect(() => {
    if (!pickerOpen) return;
    const selectedIndex = figures.findIndex((figure) => figure.id === selected);
    optionRefs.current[selectedIndex]?.focus();
  }, [pickerOpen, selected]);

  useEffect(() => {
    if (!pickerOpen) return;

    function closeOnOutsidePointer(event: PointerEvent) {
      if (!pickerRef.current?.contains(event.target as Node)) {
        setPickerOpen(false);
      }
    }

    document.addEventListener("pointerdown", closeOnOutsidePointer);
    return () => document.removeEventListener("pointerdown", closeOnOutsidePointer);
  }, [pickerOpen]);

  useEffect(
    () => () => {
      if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
    },
    [],
  );

  function selectFigure(id: FigureId) {
    setSelected(id);
    // Keep the address shareable: /start?tool=rocket opens the rocket.
    window.history.replaceState(null, "", `?tool=${id}`);
    setControlsOpen(false);
    setPickerOpen(false);
    window.scrollTo(0, 0);
    triggerRef.current?.focus();
  }

  function focusOption(index: number) {
    const wrappedIndex = (index + figures.length) % figures.length;
    optionRefs.current[wrappedIndex]?.focus();
  }

  function handlePickerKeyDown(
    event: KeyboardEvent<HTMLButtonElement>,
    index: number,
    id: FigureId,
  ) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      focusOption(index + 1);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      focusOption(index - 1);
    } else if (event.key === "Home") {
      event.preventDefault();
      focusOption(0);
    } else if (event.key === "End") {
      event.preventDefault();
      focusOption(figures.length - 1);
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      selectFigure(id);
    } else if (event.key === "Escape") {
      event.preventDefault();
      setPickerOpen(false);
      triggerRef.current?.focus();
    } else if (event.key === "Tab") {
      setPickerOpen(false);
    } else if (event.key.length === 1 && !event.altKey && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      typeahead.current += event.key.toLowerCase();
      if (typeaheadTimer.current) clearTimeout(typeaheadTimer.current);
      typeaheadTimer.current = setTimeout(() => {
        typeahead.current = "";
      }, 500);

      const match = figures.findIndex((figure) =>
        figure.label.toLowerCase().startsWith(typeahead.current),
      );
      if (match >= 0) focusOption(match);
    }
  }

  return (
    <div className="svg-tools-shell">
      <section className="svg-tools-workspace" aria-label={`${title} tool`}>
        <div ref={figureRootRef} id="svg-tools-figure-controls" className="svg-tools-figure" data-controls-open={controlsOpen} key={selected}>
          <Tool />
        </div>
      </section>
      <div className="svg-tools-dock" role="group" aria-label="SVG tool controls">
        <div className="svg-tools-picker">
          <span className="svg-tools-picker-label">Tool</span>
          <div className="svg-tools-picker-wrap" ref={pickerRef}>
            <button
              ref={triggerRef}
              className="svg-tools-picker-trigger"
              id="svg-tools-picker-trigger"
              type="button"
              aria-label={`Choose a tool. Current tool: ${title}`}
              aria-haspopup="menu"
              aria-expanded={pickerOpen}
              aria-controls="svg-tools-picker-menu"
              onClick={() => setPickerOpen((open) => !open)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                  event.preventDefault();
                  setPickerOpen(true);
                } else if (event.key === "Escape" && pickerOpen) {
                  event.preventDefault();
                  setPickerOpen(false);
                }
              }}
            >
              <span>{title}</span>
              <ChevronDown aria-hidden="true" size={15} />
            </button>
            <div
              className="svg-tools-picker-menu"
              id="svg-tools-picker-menu"
              role="menu"
              aria-labelledby="svg-tools-picker-trigger"
              aria-hidden={!pickerOpen}
              inert={!pickerOpen}
              data-open={pickerOpen}
            >
              {figures.map((figure, index) => (
                <button
                  key={figure.id}
                  ref={(node) => {
                    optionRefs.current[index] = node;
                  }}
                  className="svg-tools-picker-option"
                  type="button"
                  role="menuitemradio"
                  aria-checked={selected === figure.id}
                  tabIndex={selected === figure.id ? 0 : -1}
                  onClick={() => selectFigure(figure.id)}
                  onKeyDown={(event) =>
                    handlePickerKeyDown(event, index, figure.id)
                  }
                >
                  <span>{figure.label}</span>
                  {selected === figure.id && (
                    <Check aria-hidden="true" size={15} />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
        <span className="svg-tools-dock-rule" aria-hidden="true" />
        <button className="svg-tools-controls-toggle" type="button" aria-expanded={controlsOpen} aria-controls="svg-tools-figure-controls" onClick={() => setControlsOpen((open) => !open)}>
          {controlsOpen ? <X aria-hidden="true" size={17} /> : <SlidersHorizontal aria-hidden="true" size={17} />}
          <span>{controlsOpen ? "Close controls" : "Controls"}</span>
        </button>
      </div>
      <LiveAssistant toolId={selected} toolLabel={title} toolRoot={figureRootRef} />
    </div>
  );
}

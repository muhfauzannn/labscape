"use client";

import { Button } from "@/components/ui/button";
import * as React from "react";
import { crtPoseAt, energyAfter } from "./model";

interface ComputerModel {
  keys: string[];
  down: [number, number];
  screenMid: number;
  textX: number;
  maxChars: number;
}

const PHRASES = ["hello, world", "think out loud", "stay curious"];
const SHIFTED: Record<string, string> = {
  "!": "1", "@": "2", "#": "3", "$": "4", "%": "5", "^": "6", "&": "7", "*": "8", "(": "9", ")": "0",
  "_": "-", "+": "=", "{": "[", "}": "]", "|": "\\", ":": ";", '"': "'", "<": ",", ">": ".", "?": "/", "~": "`",
};

export function ComputerLive({ artwork, model }: { artwork: React.ReactNode; model: ComputerModel }) {
  const stageRef = React.useRef<HTMLDivElement>(null);
  const readoutRef = React.useRef<HTMLOutputElement>(null);
  const statusRef = React.useRef<HTMLSpanElement>(null);
  const actions = React.useRef<{ toggle(): void; demo(): void; clear(): void } | null>(null);
  const [powered, setPowered] = React.useState(true);
  const [theme, setTheme] = React.useState<"light" | "dark">("light");

  React.useEffect(() => {
    const stage = stageRef.current;
    if (!stage) return;
    const svg = stage.querySelector("svg");
    if (!svg) return;
    const text = svg.querySelector<SVGTextElement>('[data-part="text"]')!;
    const cursor = svg.querySelector<SVGRectElement>('[data-part="cursor"]')!;
    const crt = svg.querySelector<SVGGElement>('[data-part="crt"]')!;
    const beam = svg.querySelector<SVGPathElement>('[data-part="beam"]')!;
    const dot = svg.querySelector<SVGCircleElement>('[data-part="dot"]')!;
    const glass = svg.querySelector<SVGPathElement>(".pc-glass")!;
    const led = svg.querySelector<SVGGElement>('[data-part="led"]')!;
    const rockerOn = svg.querySelector<SVGGElement>('[data-rocker="on"]')!;
    const rockerOff = svg.querySelector<SVGGElement>('[data-rocker="off"]')!;
    const caps = model.keys.map((_, i) => svg.querySelector<SVGGElement>(`[data-key="${i}"]`)!);
    const keyStates = model.keys.map(() => ({ at: 0, held: 0 }));
    const active = new Set<number>();
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");
    let power = true, energy = 1, line = "", lastKey = "";
    let frame = 0, previous = 0, visible = false, touring = !still.matches;
    let phrase = 0, index = 0, wait = 1.6, erasing = false;
    let shift = false, capsLock = false;

    function write() {
      text.textContent = "> " + line;
      cursor.setAttribute("x", String(model.textX + text.getComputedTextLength() + 0.5));
      if (readoutRef.current) {
        readoutRef.current.textContent = power ? `ON · ${line.length.toString().padStart(2, "0")} / ${model.maxChars} CHARS${lastKey ? " · " + lastKey : ""}` : "OFF · PHOSPHOR AT REST";
      }
    }

    function drawCrt() {
      const { sx, sy, opacity, beam: beamAt, dot: dotAt } = crtPoseAt(energy);
      crt.setAttribute("transform", `translate(0 ${-model.screenMid}) scale(${Math.max(0.001, sx).toFixed(4)} ${Math.max(0.001, sy).toFixed(4)}) translate(0 ${model.screenMid})`);
      crt.style.opacity = String(opacity);
      beam.setAttribute("transform", `scale(${Math.max(0.001, sx).toFixed(4)} 1)`);
      beam.style.opacity = String(beamAt);
      dot.style.opacity = String(dotAt);
      glass.toggleAttribute("data-on", energy > 0.04);
      led.style.opacity = String(0.12 + energy * 0.88);
    }

    function press(code: string, hold = 0.09) {
      const i = model.keys.indexOf(code);
      if (i < 0) return;
      keyStates[i].held = hold;
      active.add(i);
      run();
    }

    function type(character: string) {
      const code = SHIFTED[character] || character.toLowerCase();
      if (!model.keys.includes(code)) return;
      press(code);
      if (SHIFTED[character] || character !== character.toLowerCase()) press("Shift", 0.14);
      if (!power) return;
      lastKey = character === " " ? "SPACE" : character.toUpperCase();
      if (line.length < model.maxChars) line += character;
      write();
    }

    function erase() {
      press("Backspace");
      if (!power) return;
      line = line.slice(0, -1);
      lastKey = "BACKSPACE";
      write();
    }

    function enter(code = "Enter") {
      press(code);
      if (!power) return;
      line = "";
      lastKey = "RETURN";
      write();
    }

    function setPower(next: boolean) {
      power = next;
      setPowered(next);
      rockerOn.style.display = power ? "" : "none";
      rockerOff.style.display = power ? "none" : "";
      stage!.dataset.power = power ? "on" : "off";
      if (statusRef.current) statusRef.current.textContent = power ? "Computer powered on." : "Computer powered off.";
      if (still.matches) { energy = power ? 1 : 0; drawCrt(); }
      write();
      run();
    }

    function tourStep(dt: number) {
      wait -= dt;
      if (wait > 0) return;
      if (!erasing && index < PHRASES[phrase].length) {
        type(PHRASES[phrase][index++]);
        wait = 0.1 + (index % 4) * 0.025;
      } else if (!erasing) {
        erasing = true;
        wait = 2.8;
      } else if (line.length) {
        erase();
        wait = 0.075;
      } else {
        phrase = (phrase + 1) % PHRASES.length;
        index = 0;
        erasing = false;
        lastKey = "";
        wait = 1;
        write();
      }
    }

    function tick(now: number) {
      const dt = previous ? Math.min((now - previous) / 1000, 1 / 30) : 1 / 60;
      previous = now;
      const calm = still.matches;
      if (touring && !calm) tourStep(dt);
      const target = power ? 1 : 0;
      energy = energyAfter(energy, power, dt, calm);
      drawCrt();
      for (const i of active) {
        const state = keyStates[i];
        state.held = Math.max(0, state.held - dt);
        const want = state.held > 0 ? 2.2 : 0;
        state.at = calm ? want : state.at + (want - state.at) * (1 - Math.exp(-dt / (want ? 0.025 : 0.07)));
        if (Math.abs(want - state.at) < 0.01) state.at = want;
        caps[i].setAttribute("transform", `translate(${(model.down[0] * state.at).toFixed(2)} ${(model.down[1] * state.at).toFixed(2)})`);
        caps[i].toggleAttribute("data-down", state.at > 0.6);
        if (!state.held && state.at === 0) active.delete(i);
      }
      frame = visible && (touring || active.size > 0 || energy !== target) ? requestAnimationFrame(tick) : 0;
    }

    function run() {
      if (frame || !visible) return;
      previous = 0;
      frame = requestAnimationFrame(tick);
    }

    const takeOver = () => { touring = false; };
    const onKey = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.key === "Tab") return;
      takeOver();
      if (event.key === "Escape") { event.preventDefault(); setPower(!power); }
      else if (event.key === "Backspace") { event.preventDefault(); erase(); }
      else if (event.key === "Enter") { event.preventDefault(); enter(event.code === "NumpadEnter" ? "NumpadEnter" : "Enter"); }
      else if (event.key === "Shift") press(event.code === "ShiftRight" ? "ShiftRight" : "Shift", 0.14);
      else if (event.key === "CapsLock") press("CapsLock");
      else if (event.key.length === 1) { event.preventDefault(); type(event.key); }
    };
    const onClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return;
      const cap = event.target.closest<SVGGElement>("[data-key]");
      if (cap) {
        takeOver();
        const code = model.keys[Number(cap.dataset.key)];
        if (code.length === 1) {
          const shifted = Object.entries(SHIFTED).find(([, base]) => base === code)?.[0];
          type(shift ? shifted || code.toUpperCase() : capsLock ? code.toUpperCase() : code);
          shift = false;
        } else if (code === "Backspace") erase();
        else if (code === "Enter" || code === "NumpadEnter") enter(code);
        else if (code === "CapsLock") { capsLock = !capsLock; press(code); }
        else if (code.startsWith("Shift")) { shift = !shift; press(code); }
        else press(code);
        stage!.focus({ preventScroll: true });
      } else if (event.target.closest('[data-part="computer"]')) {
        takeOver();
        setPower(!power);
        stage!.focus({ preventScroll: true });
      }
    };
    const observer = new IntersectionObserver((entries) => {
      visible = Boolean(entries.at(-1)?.isIntersecting);
      stage.dataset.inview = visible ? "true" : "false";
      if (visible) run();
      else { cancelAnimationFrame(frame); frame = 0; }
    }, { rootMargin: "80px 0px" });
    const onStillness = () => { if (still.matches) touring = false; run(); };
    actions.current = {
      toggle() { takeOver(); setPower(!power); },
      clear() { takeOver(); line = ""; lastKey = ""; write(); stage.focus({ preventScroll: true }); },
      demo() {
        touring = !still.matches;
        phrase = 0; index = 0; wait = 0.6; erasing = false; lastKey = "";
        line = still.matches ? PHRASES[0] : "";
        setPower(true); write(); run();
      },
    };
    observer.observe(stage);
    stage.addEventListener("keydown", onKey);
    svg.addEventListener("click", onClick);
    still.addEventListener("change", onStillness);
    write(); drawCrt();
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      stage.removeEventListener("keydown", onKey);
      svg.removeEventListener("click", onClick);
      still.removeEventListener("change", onStillness);
      actions.current = null;
    };
  }, [model]);

  return (
    <figure className="terminal iso" data-theme={theme} data-powered={powered}>
      <div className="terminal-card">
        <div className="terminal-card-top"><span>FIG. 02 <i /> PERSONAL COMPUTER</span><Button variant="secondary" type="button" onClick={() => setTheme(theme === "light" ? "dark" : "light")} aria-label={theme === "light" ? "Switch to night view" : "Switch to paper view"}>{theme === "light" ? "◐ NIGHT VIEW" : "◑ PAPER VIEW"}</Button></div>
        <div ref={stageRef} className="terminal-stage" tabIndex={0} role="group" aria-label="Interactive vintage computer. Type to write on its screen. Backspace erases, Return clears, Escape toggles power." aria-describedby="computer-hint" data-inview="false" data-power="on">
          {artwork}
          <span ref={statusRef} className="terminal-sr" aria-live="polite" />
        </div>
        <div className="terminal-card-bottom"><span id="computer-hint">CLICK A KEY, OR FOCUS & TYPE</span><output ref={readoutRef}>ON · 00 / 20 CHARS</output></div>
      </div>
      <figcaption className="terminal-caption">
        <div className="terminal-controls">
          <Button variant="primary" type="button" className="power-button" onClick={() => actions.current?.toggle()} aria-label={powered ? "Power off computer" : "Power on computer"}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 2v7M5.5 4.8a6.6 6.6 0 1 0 9 0" /></svg><span>POWER {powered ? "ON" : "OFF"}</span><i /></Button>
          <Button variant="secondary" type="button" className="text-button" onClick={() => actions.current?.demo()}>↻ Replay typing</Button>
          <Button variant="secondary" type="button" className="text-button" onClick={() => actions.current?.clear()}>Clear screen</Button>
        </div>
      </figcaption>
    </figure>
  );
}

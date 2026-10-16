"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { translateAlong, type Point3 } from "@/components/iso/iso-kit";
import {
  AMBIENT, LAYERS, LAYER_H, MAX_TEMP, MIN_EXTRUDE, OBJECTS, PLAY, flowAt, formatTime, heatStep, jobOf, maxFlow, pointAt,
  type Job, type Layer, type ObjectId,
} from "./model";
import { buildPrinter, currentD, EXPLODE, HX0, HY0, layersSvg, P, PARTS, spokesD, tubeD, type PartId } from "./geometry";

type Phase = "idle" | "heating" | "printing" | "paused" | "done";
interface Settings { speed: number; temp: number; object: ObjectId }
interface Commands { wake(): void; start(): void; pause(): void; reset(): void; explode(on: boolean): void; object(id: ObjectId): void }

const PARK: [number, number] = [196, 52];
const DEFAULTS: Settings = { speed: 80, temp: 210, object: "cube" };
const add = (a: Point3, b: Point3, s = 1): Point3 => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
const layerTime = (layer: Layer, speed: number, from = 0) => {
  let t = 0, skip = from;
  for (const m of layer.moves) {
    const len = Math.max(0, m.len - Math.max(0, skip));
    skip -= m.len;
    t += len / (speed * (m.extrude ? 1 : 2));
  }
  return t;
};

export function PrinterFigure() {
  const svg = React.useMemo(() => buildPrinter(), []);
  const stage = React.useRef<HTMLDivElement>(null);
  const readout = React.useRef<HTMLOutputElement>(null);
  const flowNote = React.useRef<HTMLParagraphElement>(null);
  const commands = React.useRef<Commands | null>(null);
  const settings = React.useRef<Settings>(DEFAULTS);
  const [ui, setUI] = React.useState<Settings>(DEFAULTS);
  const [phase, setPhase] = React.useState<Phase>("idle");
  const [exploded, setExploded] = React.useState(false);
  const [selected, setSelected] = React.useState<PartId | null>(null);
  const [isolate, setIsolate] = React.useState(false);

  function change<K extends keyof Settings>(key: K, value: Settings[K]) {
    settings.current = { ...settings.current, [key]: value };
    setUI(settings.current);
    if (key === "object") commands.current?.object(value as ObjectId);
    else commands.current?.wake();
  }

  React.useEffect(() => {
    const host = stage.current;
    if (!host) return;
    const q = <T extends Element = SVGElement>(sel: string) => host.querySelector<T>(sel)!;
    const qa = (sel: string) => Array.from(host.querySelectorAll<SVGElement>(sel));
    const groups = Object.fromEntries(Object.keys(EXPLODE).map((name) => [name, q(`[data-g="${name}"]`)]));
    const layersEl = q('[data-dyn="layers"]'), current = q('[data-dyn="current"]');
    const threads = qa('[data-dyn="thread"]'), beltA = q('[data-dyn="beltA"]'), beltB = q('[data-dyn="beltB"]'), beltX = q('[data-dyn="beltX"]');
    const spokes = q('[data-dyn="spokes"]'), fan = q('[data-dyn="fan"]'), gear = q('[data-dyn="gear"]');
    const tube = q('[data-dyn="tube"]'), tube2 = q('[data-dyn="tube2"]'), heater = q(".pr-heater");
    const screen1 = q('[data-dyn="screen1"]'), screen2 = q('[data-dyn="screen2"]');
    const still = window.matchMedia("(prefers-reduced-motion: reduce)");

    let job: Job = jobOf(settings.current.object);
    let state: Phase = "idle", k = 0, s = 0, temp = AMBIENT, filament = 0, fanAngle = 0, fanSpeed = 0;
    let head: [number, number] = [...PARK], locked = false, drop = 0, e = 0, eTarget = 0;
    let starved: number[] = [], drawnLayers = -1, frame = 0, last = 0, visible = true, lastText = 0;
    const sc = P.scale;

    const go = (next: Phase) => { state = next; setPhase(next); locked = false; run(); };

    function status() {
      const st = settings.current;
      const need = flowAt(st.speed), can = maxFlow(temp);
      if (flowNote.current) flowNote.current.textContent = `Flow needed ${need.toFixed(1)} mm³/s · the hotend can melt ${can.toFixed(1)} mm³/s at ${Math.round(temp)} °C`;
      const pct = Math.round(((k + (job.layers[k] ? s / job.layers[k].length : 0)) / LAYERS) * 100);
      let left = 0;
      if (job.layers[k]) { left = layerTime(job.layers[k], st.speed, s); for (let i = k + 1; i < LAYERS; i++) left += layerTime(job.layers[i], st.speed); }
      const t = `${Math.round(temp)} / ${state === "idle" || state === "done" ? "—" : st.temp} °C`;
      let text = "";
      if (state === "idle") text = `Ready · ${OBJECTS[st.object]} · ${LAYERS} layers · about ${formatTime(left)} at ${st.speed} mm/s · Nozzle ${Math.round(temp)} °C`;
      else if (state === "heating") text = `Heating the nozzle · ${t}`;
      else if (state === "done") text = `Finished ${OBJECTS[st.object]}${starved.some(Boolean) ? ` · ${starved.filter(Boolean).length} layers under-extruded` : ""} · Nozzle cooling ${Math.round(temp)} °C`;
      else {
        const warn = temp < MIN_EXTRUDE ? " · Too cold to extrude, waiting" : need > can ? " · Under-extruding: slow down or heat up" : "";
        text = `${state === "paused" ? "Paused" : "Printing"} · Layer ${Math.min(k + 1, LAYERS)} of ${LAYERS} · ${pct}% · ${t} · ${formatTime(left)} left${warn}`;
      }
      if (readout.current) readout.current.textContent = text;
      screen1.textContent = `${Math.round(temp)}°C`;
      screen2.textContent = state === "idle" ? "READY" : state === "heating" ? "HEATING" : state === "done" ? "DONE" : `L${Math.min(k + 1, LAYERS)}/${LAYERS} ${pct}%`;
    }

    function draw() {
      const ex = (name: string) => EXPLODE[name].map((v) => v * e) as Point3;
      const set = (name: string, motion: Point3 = [0, 0, 0]) => groups[name]?.setAttribute("transform", translateAlong(P, add(motion, ex(name))));
      for (const name of ["base", "zaxis", "top", "xymotors", "frontTop", "spool", "hotend", "nozzle", "carriage", "fan", "extruder"]) set(name);
      set("bed", [0, 0, -drop]);
      set("gantry", [0, head[1] - HY0, 0]);
      set("head", [head[0] - HX0, head[1] - HY0, 0]);
      if (drawnLayers !== k) { layersEl.innerHTML = layersSvg(job, Math.min(k, LAYERS), starved); drawnLayers = k; }
      current.setAttribute("d", state === "done" ? "" : currentD(job, k, s));
      for (const t of threads) t.style.strokeDashoffset = String(drop * sc * 1.6);
      beltA.style.strokeDashoffset = String((head[0] + head[1]) * sc);
      beltB.style.strokeDashoffset = String((head[0] - head[1]) * sc);
      beltX.style.strokeDashoffset = String(head[0] * sc);
      spokes.setAttribute("d", spokesD(-filament / 80));
      gear.setAttribute("transform", `rotate(${((filament / (Math.PI * 7.5)) * 360).toFixed(1)} 7 6)`);
      fan.setAttribute("transform", `rotate(${fanAngle.toFixed(1)} 11 10)`);
      const hz = 296 + EXPLODE.head[2] * e + EXPLODE.extruder[2] * e;
      const d = tubeD(head[0], head[1], hz, ex("spool"));
      tube.setAttribute("d", d); tube2.setAttribute("d", d);
      heater.style.setProperty("--heat", Math.max(0, Math.min(1, (temp - 60) / (MAX_TEMP - 60))).toFixed(3));
    }

    function tick(now: number) {
      const real = last ? Math.min((now - last) / 1000, 1 / 20) : 1 / 60;
      last = now;
      const dt = real * PLAY;
      const st = settings.current;
      const heating = state === "heating" || state === "printing" || state === "paused";
      temp = heatStep(temp, heating ? st.temp : AMBIENT, dt);
      if (state === "heating" && temp >= st.temp - 2) go("printing");

      let target: [number, number] = PARK;
      if (state === "printing" || state === "paused" || state === "heating") {
        const layer = job.layers[k];
        if (state === "printing" && locked && temp >= MIN_EXTRUDE && layer) {
          let budget = dt;
          while (budget > 0 && k < LAYERS) {
            const L = job.layers[k], at = pointAt(L, s), v = st.speed * (at.extrude ? 1 : 2);
            const step = Math.min(budget * v, L.length - s);
            if (at.extrude) { filament += (step * 0.45 * 0.2) / 2.405; if (flowAt(st.speed) > maxFlow(temp)) starved[k] = 1; }
            s += step; budget -= step / v;
            if (s >= L.length - 1e-6) { k++; s = 0; if (k >= LAYERS) { go("done"); break; } }
          }
        }
        if (k < LAYERS && job.layers[k]) target = pointAt(job.layers[k], s).p;
      }
      if (locked && (state === "printing" || state === "paused")) head = [...target];
      else {
        const a = 1 - Math.exp(-real / 0.12);
        head = [head[0] + (target[0] - head[0]) * a, head[1] + (target[1] - head[1]) * a];
        if (Math.hypot(target[0] - head[0], target[1] - head[1]) < 0.4 && state === "printing") locked = true;
      }
      const dropTarget = Math.min(k, LAYERS) * LAYER_H;
      drop += (dropTarget - drop) * (still.matches ? 1 : 1 - Math.exp(-real / 0.15));
      e += (eTarget - e) * (still.matches ? 1 : 1 - Math.exp(-real / 0.3));
      if (Math.abs(eTarget - e) < 0.001) e = eTarget;
      fanSpeed += ((state === "printing" ? 1 : 0) - fanSpeed) * (1 - Math.exp(-real / 0.6));
      fanAngle = (fanAngle + fanSpeed * real * 1400) % 360;
      draw();
      if (now - lastText > 120) { status(); lastText = now; }
      const settled = (state === "idle" || state === "done") && Math.abs(temp - AMBIENT) < 0.5 && Math.hypot(PARK[0] - head[0], PARK[1] - head[1]) < 0.05 && e === eTarget && Math.abs(drop - dropTarget) < 0.01 && fanSpeed < 0.01;
      frame = visible && !settled ? requestAnimationFrame(tick) : 0;
      if (settled) status();
    }
    function run() { if (!frame && visible) { last = 0; frame = requestAnimationFrame(tick); } }

    commands.current = {
      wake() { lastText = 0; run(); },
    start() {
        if (state === "paused") return go("printing");
        if (state === "idle" || state === "done") { if (state === "done") { k = 0; s = 0; starved = []; drawnLayers = -1; } go("heating"); }
      },
      pause() { if (state === "printing" || state === "heating") go("paused"); },
      reset() { k = 0; s = 0; starved = []; drawnLayers = -1; filament = filament % 1000; go("idle"); },
      explode(on) { eTarget = on ? 1 : 0; run(); },
      object(id) { job = jobOf(id); k = 0; s = 0; starved = []; drawnLayers = -1; go("idle"); },
    };

    const observer = new IntersectionObserver((entries) => {
      visible = Boolean(entries.at(-1)?.isIntersecting);
      if (visible) run(); else { cancelAnimationFrame(frame); frame = 0; }
    });
    observer.observe(host);
    draw(); status(); run();
    return () => { cancelAnimationFrame(frame); observer.disconnect(); commands.current = null; };
  }, []);

  React.useEffect(() => {
    const host = stage.current;
    if (!host) return;
    host.querySelectorAll("[data-part]").forEach((el) => el.classList.toggle("is-selected", el.getAttribute("data-part") === selected));
  }, [selected]);

  const onClick = (event: React.MouseEvent) => {
    const part = (event.target as Element).closest?.("[data-part]")?.getAttribute("data-part") as PartId | undefined;
    setSelected(part && part !== selected ? part : null);
  };

  const running = phase === "printing" || phase === "heating";

  return (
    <div className="pr" data-isolate={isolate && !!selected}>
      <div ref={stage} className="pr-stage" onClick={onClick} dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="pr-readout"><output ref={readout} aria-live="polite" /></div>
      {selected && <p className="pr-inspect"><strong>{PARTS[selected][0]}.</strong> {PARTS[selected][1]}</p>}

      <div className="pr-controls">
        <div className="pr-row">
          <Button variant="primary" type="button" onClick={() => commands.current?.start()} disabled={running}>{phase === "paused" ? "Resume" : phase === "done" ? "Print again" : "Start"}</Button>
          <Button variant="secondary" type="button" onClick={() => commands.current?.pause()} disabled={!running}>Pause</Button>
          <Button variant="secondary" type="button" onClick={() => commands.current?.reset()}>Reset</Button>
          <Button variant={exploded ? "primary" : "secondary"} type="button" onClick={() => { commands.current?.explode(!exploded); setExploded(!exploded); }}>{exploded ? "Assemble" : "Exploded view"}</Button>
        </div>
        <div className="pr-grid">
          <div>
            <h3>Object</h3>
            <div className="pr-chips">
              {(Object.keys(OBJECTS) as ObjectId[]).map((id) => (
                <button key={id} type="button" className="pr-chip" aria-pressed={ui.object === id} disabled={running} onClick={() => change("object", id)}>{OBJECTS[id]}</button>
              ))}
            </div>
            <label className="pr-slider">
              <span>Print speed <b>{ui.speed} mm/s</b></span>
              <input type="range" min={20} max={250} step={5} value={ui.speed} onChange={(ev) => change("speed", Number(ev.target.value))} />
            </label>
            <label className="pr-slider">
              <span>Nozzle temperature <b>{ui.temp} °C</b></span>
              <input type="range" min={170} max={MAX_TEMP} step={5} value={ui.temp} onChange={(ev) => change("temp", Number(ev.target.value))} />
            </label>
            <p ref={flowNote} className="pr-note" />
            <p className="pr-note">PLA flows above {MIN_EXTRUDE} °C. Faster printing needs more melted plastic per second, so it needs a hotter nozzle. Playback runs {PLAY}× real time.</p>
          </div>
          <div>
            <h3>Inspect a part</h3>
            <div className="pr-chips">
              {(Object.keys(PARTS) as PartId[]).map((id) => (
                <button key={id} type="button" className="pr-chip" aria-pressed={selected === id} onClick={() => setSelected(selected === id ? null : id)}>{PARTS[id][0]}</button>
              ))}
            </div>
            <label className="pr-check"><input type="checkbox" checked={isolate} onChange={(ev) => setIsolate(ev.target.checked)} /> Isolate the selected part</label>
          </div>
        </div>
      </div>
    </div>
  );
}

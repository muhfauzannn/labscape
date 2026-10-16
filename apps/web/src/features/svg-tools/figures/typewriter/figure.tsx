"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";

/* ---------- model ---------- */

const ROWS = ["1234567890-", "qwertyuiop", "asdfghjkl;", "zxcvbnm,./"];
const SHIFTED: Record<string, string> = { "1": "!", "2": "@", "3": "#", "4": "$", "5": "%", "6": "^", "7": "&", "8": "*", "9": "(", "0": ")", "-": "_", ";": ":", ",": "?", ".": ".", "/": "?" };
const BASE: Record<string, string> = Object.fromEntries(Object.entries(SHIFTED).filter(([b]) => b !== "." && b !== ",").map(([b, s]) => [s, b]));
const TYPEBARS = ROWS.join("").split("");
const MAX_COL = 34, BELL_COL = 28, MAX_LINE = 24, CW = 6, LH = 12;
const STRIKE = 0.2; // seconds per stroke at 1×
const PRINT_AT = 0.47, ESCAPE_AT = 0.6;

const PARTS = {
  keyboard: ["Keys", "Each key sits on a stem. Pressing it pushes the key lever down — about 12 mm of travel at the keytop."],
  keylever: ["Key levers", "Long levers pivoting on a fulcrum rod at the back. The key end goes down, and the lug near the back pulls the sublever."],
  springs: ["Return springs", "A spring under every key lever and every typebar pulls the whole chain back once you let go."],
  sublever: ["Sublever (bellcrank)", "Turns the downward pull of the key lever into a forward push on the link that drives the typebar heel."],
  typebar: ["Typebars", "One bar per key, fanned in a basket. The link flicks the bar up around its pivot so the type slug hits the platen."],
  segment: ["Segment", "The slotted arc that holds the typebar pivots. Shift lowers it so the upper-case slug lands on the paper."],
  universal: ["Universal bar", "Every typebar heel pushes this bar on its way up. It rocks the escapement dogs: that's how any key moves the carriage."],
  escapement: ["Escapement", "A star wheel and two dogs. When the key rises, the dogs let the wheel turn one tooth, and the carriage moves one letter left."],
  mainspring: ["Mainspring drum", "A coiled spring that always pulls the carriage left. The escapement only decides when it can move."],
  ribbon: ["Ink ribbon", "A cloth band soaked in ink, wound between two spools. It moves on a little after every letter so it doesn't wear through in one spot."],
  vibrator: ["Ribbon vibrator", "Lifts the ribbon into the print point just before the slug arrives, then drops it so you can see what you typed."],
  platen: ["Platen", "The hard rubber roller the slug strikes against. Turning it feeds the paper up one line."],
  paper: ["Paper", "Wrapped round the platen. The slug presses the ribbon into it, leaving the letter in ink."],
  carriage: ["Carriage", "Carries the platen and paper across the machine on a rack. It moves past a fixed print point."],
  returnlever: ["Carriage return lever", "Pushing it turns the platen one line, then you push the carriage back to the left margin, winding up the mainspring."],
  feedknob: ["Platen knob", "Turns the platen by hand to feed paper in or out, line by line."],
  bell: ["Margin bell", "Rings six letters before the right margin so you know to finish the word."],
  casing: ["Casing", "The pressed-steel body. Switch on see-through case to look inside."],
} as const;
type PartId = keyof typeof PARTS;

const CHAIN = [
  ["Key goes down", "keyboard"],
  ["Key lever pulls the sublever", "keylever"],
  ["Typebar swings up", "typebar"],
  ["Vibrator lifts ribbon, slug strikes", "vibrator"],
  ["Escapement frees one tooth, carriage steps", "escapement"],
  ["Springs return everything", "springs"],
] as const;

interface Strike { ch: string; bar: number; row: number; t: number; shift: boolean; printed: boolean; escaped: boolean }
type Op = { kind: "char"; ch: string; shift: boolean } | { kind: "space" | "back" | "ret" | "feed" | "unfeed" };
interface Mech {
  strikes: Strike[]; queue: Op[]; busy: number;
  col: number; line: number; carriage: number; lineAnim: number; esc: number; escAnim: number; spool: number;
  page: string[][]; paperIn: number; paperTarget: number; seg: number; shiftHeld: boolean; shiftOnce: boolean;
  backT: number; retT: number; feedT: number; bellT: number; spaceT: number;
  explode: number; explodeTarget: number; lockFlash: number;
}

const ease = (x: number) => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };
const span = (u: number, a: number, b: number) => Math.max(0, Math.min(1, (u - a) / (b - a)));
const keyOf = (u: number) => u < 0.2 ? ease(u / 0.2) : u < 0.47 ? 1 : 1 - ease(span(u, 0.47, 0.8));
const swingOf = (u: number) => u < 0.09 ? 0 : u < 0.47 ? span(u, 0.09, 0.47) ** 2 : 1 - ease(span(u, 0.47, 0.88));
const vibOf = (u: number) => u < 0.26 ? 0 : u < 0.47 ? ease(span(u, 0.26, 0.47)) : 1 - ease(span(u, 0.47, 0.76));
const pulse = (t: number, len: number) => t <= 0 ? 0 : Math.sin(Math.min(1, t / len) * Math.PI);

function newMech(): Mech {
  return {
    strikes: [], queue: [], busy: 0, col: 0, line: 2, carriage: 0, lineAnim: 2, esc: 0, escAnim: 0, spool: 0,
    page: Array.from({ length: MAX_LINE }, () => []), paperIn: 1, paperTarget: 1, seg: 0, shiftHeld: false, shiftOnce: false,
    backT: 0, retT: 0, feedT: 0, bellT: 0, spaceT: 0, explode: 0, explodeTarget: 0, lockFlash: 0,
  };
}

function step(m: Mech, dt: number) {
  const k = (tau: number) => 1 - Math.exp(-dt / tau);
  // strikes
  const last = m.strikes.at(-1);
  m.busy = Math.max(0, m.busy - dt);
  if (m.queue.length && !m.busy && (!last || last.t / STRIKE >= ESCAPE_AT)) {
    const q = m.queue.shift()!;
    if (q.kind === "char") {
      const base = BASE[q.ch] ?? q.ch.toLowerCase();
      m.strikes.push({ ch: q.ch, bar: TYPEBARS.indexOf(base), row: ROWS.findIndex((r) => r.includes(base)), t: 0, shift: q.shift, printed: false, escaped: false });
    } else if (q.kind === "space") {
      m.spaceT = 0.0001; m.busy = STRIKE * 0.5;
      if (m.col < MAX_COL) { m.col++; m.esc++; if (m.col === BELL_COL) m.bellT = 0.0001; } else m.lockFlash = 0.6;
    } else if (q.kind === "back") { m.backT = 0.0001; m.busy = STRIKE * 0.5; if (m.col > 0) { m.col--; m.esc--; } }
    else if (q.kind === "ret") { m.retT = 0.0001; m.busy = 0.3; m.col = 0; if (m.line < MAX_LINE - 1) m.line++; }
    else { m.feedT = 0.0001; m.busy = 0.12; m.line = Math.max(0, Math.min(MAX_LINE - 1, m.line + (q.kind === "feed" ? 1 : -1))); }
  }
  for (const s of m.strikes) {
    s.t += dt;
    const u = s.t / STRIKE;
    if (!s.printed && u >= PRINT_AT) {
      s.printed = true;
      if (m.col >= MAX_COL) m.lockFlash = 0.6;
      else if (m.paperIn > 0.95 && m.line < MAX_LINE) m.page[m.line][m.col] = (m.page[m.line][m.col] ?? "") + s.ch;
    }
    if (!s.escaped && u >= ESCAPE_AT) {
      s.escaped = true;
      if (m.col < MAX_COL) { m.col++; m.esc++; m.spool++; if (m.col === BELL_COL) m.bellT = 0.0001; }
    }
  }
  m.strikes = m.strikes.filter((s) => s.t < STRIKE);
  const wantShift = m.shiftHeld || m.shiftOnce || (m.strikes.at(-1)?.shift ?? false);
  m.seg += ((wantShift ? 1 : 0) - m.seg) * k(0.035);
  m.carriage += (m.col - m.carriage) * k(m.retT > 0 ? 0.09 : 0.025);
  m.lineAnim += (m.line - m.lineAnim) * k(0.05);
  m.escAnim += (m.esc - m.escAnim) * k(0.02);
  m.paperIn += (m.paperTarget - m.paperIn) * k(0.25);
  m.explode += (m.explodeTarget - m.explode) * k(0.22);
  for (const key of ["backT", "retT", "feedT", "bellT", "spaceT"] as const) if (m[key] > 0) m[key] = m[key] + dt > 0.5 ? 0 : m[key] + dt;
  m.lockFlash = Math.max(0, m.lockFlash - dt);
  return m.strikes.length > 0 || m.queue.length > 0 || m.busy > 0 || Math.abs(m.col - m.carriage) > 0.002 || Math.abs(m.line - m.lineAnim) > 0.002 ||
    Math.abs(m.esc - m.escAnim) > 0.002 || Math.abs(m.paperTarget - m.paperIn) > 0.002 || Math.abs(m.explodeTarget - m.explode) > 0.002 ||
    Math.abs((wantShift ? 1 : 0) - m.seg) > 0.002 || m.backT + m.retT + m.feedT + m.bellT + m.spaceT + m.lockFlash > 0;
}

const snapshot = (m: Mech): Mech => ({ ...m, strikes: m.strikes.map((s) => ({ ...s })), queue: [...m.queue], page: m.page.map((l) => [...l]) });

/* ---------- drawing helpers ---------- */

const f = (n: number) => n.toFixed(1);
const pol = (cx: number, cy: number, r: number, deg: number): [number, number] => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)];
function gear(cx: number, cy: number, r: number, teeth: number, rot: number) {
  let d = "";
  for (let i = 0; i < teeth * 2; i++) {
    const a = rot + (i * 180) / teeth, rr = i % 2 ? r * 0.82 : r;
    const [x1, y1] = pol(cx, cy, rr, a), [x2, y2] = pol(cx, cy, rr, a + 180 / teeth);
    d += `${i ? "L" : "M"}${f(x1)} ${f(y1)}L${f(x2)} ${f(y2)}`;
  }
  return d + "Z";
}
function zigzag(x1: number, y1: number, x2: number, y2: number, n = 9, w = 4) {
  const dx = x2 - x1, dy = y2 - y1, len = Math.hypot(dx, dy) || 1, nx = -dy / len, ny = dx / len;
  let d = `M${f(x1)} ${f(y1)}`;
  for (let i = 1; i < n; i++) { const t = i / n, s = i % 2 ? w : -w; d += `L${f(x1 + dx * t + nx * s)} ${f(y1 + dy * t + ny * s)}`; }
  return d + `L${f(x2)} ${f(y2)}`;
}
function spiral(cx: number, cy: number, r: number, turns: number, rot: number) {
  let d = "";
  for (let i = 0; i <= turns * 24; i++) { const a = rot + (i / 24) * 360, rr = 3 + ((r - 3) * i) / (turns * 24); const [x, y] = pol(cx, cy, rr, a); d += `${i ? "L" : "M"}${f(x)} ${f(y)}`; }
  return d;
}

/* ---------- component ---------- */

export function TypewriterFigure() {
  const mech = React.useRef<Mech>(newMech());
  const [m, setPose] = React.useState<Mech>(newMech);
  const [selected, setSelected] = React.useState<PartId | null>(null);
  const [isolate, setIsolate] = React.useState(false);
  const [glass, setGlass] = React.useState(true);
  const [slow, setSlow] = React.useState(false);
  const [exploded, setExploded] = React.useState(false);
  const raf = React.useRef(0);
  const speedRef = React.useRef(1);

  const kick = React.useCallback(() => {
    if (raf.current) return;
    let prev = 0;
    const loop = (now: number) => {
      const dt = prev ? Math.min((now - prev) / 1000, 1 / 30) : 1 / 60;
      prev = now;
      const busy = step(mech.current, dt * speedRef.current);
      setPose(snapshot(mech.current));
      raf.current = busy ? requestAnimationFrame(loop) : 0;
    };
    raf.current = requestAnimationFrame(loop);
  }, []);

  const act = React.useMemo(() => ({
    type(ch: string, shift: boolean) {
      const m = mech.current;
      if (m.queue.length > 40) return;
      if (ch === " ") m.queue.push({ kind: "space" });
      else {
        let c = ch;
        if (m.shiftOnce && !shift) { c = SHIFTED[ch] ?? ch.toUpperCase(); shift = true; m.shiftOnce = false; }
        const base = BASE[c] ?? c.toLowerCase();
        if (!TYPEBARS.includes(base)) return;
        m.queue.push({ kind: "char", ch: c, shift });
      }
      kick();
    },
    back() { mech.current.queue.push({ kind: "back" }); kick(); },
    ret() { mech.current.queue.push({ kind: "ret" }); kick(); },
    feed(dir = 1) { mech.current.queue.push({ kind: dir > 0 ? "feed" : "unfeed" }); kick(); },
    shift(held: boolean) { mech.current.shiftHeld = held; kick(); },
    shiftOnce() { mech.current.shiftOnce = !mech.current.shiftOnce; kick(); },
    paper() {
      const m = mech.current;
      if (m.paperTarget > 0.5) m.paperTarget = 0;
      else { m.paperTarget = 1; m.page = Array.from({ length: MAX_LINE }, () => []); m.line = 2; m.col = 0; }
      kick();
    },
    clear() { const m = mech.current; m.page = Array.from({ length: MAX_LINE }, () => []); m.line = 2; m.col = 0; kick(); },
    demo() { const text = "The quick brown fox jumps."; for (const ch of text) act.type(ch, ch !== ch.toLowerCase()); act.ret(); },
  }), [kick]);

  React.useEffect(() => { speedRef.current = slow ? 0.08 : 1; }, [slow]);
  React.useEffect(() => { mech.current.explodeTarget = exploded ? 1 : 0; kick(); }, [exploded, kick]);

  React.useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      const t = e.target instanceof HTMLElement ? e.target : null;
      if (e.metaKey || e.ctrlKey || e.altKey || t?.closest("input, textarea, select, [role=menu], .svg-tools-dock")) return;
      if (e.key === "Shift") { act.shift(true); return; }
      if (e.key === "Backspace") { e.preventDefault(); act.back(); }
      else if (e.key === "Enter") { if (t?.tagName === "BUTTON") return; e.preventDefault(); act.ret(); }
      else if (e.key === "ArrowUp") { e.preventDefault(); act.feed(-1); }
      else if (e.key === "ArrowDown") { e.preventDefault(); act.feed(1); }
      else if (e.key.length === 1) {
        if (e.key === " " && t?.tagName === "BUTTON") return;
        e.preventDefault();
        act.type(e.key, e.shiftKey);
      }
    };
    const onUp = (e: KeyboardEvent) => { if (e.key === "Shift") act.shift(false); };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => { window.removeEventListener("keydown", onDown); window.removeEventListener("keyup", onUp); cancelAnimationFrame(raf.current); raf.current = 0; };
  }, [act]);

  /* ---------- derive the pose ---------- */
  const e = ease(m.explode);
  const lead = m.strikes.at(-1);
  const leadU = lead ? lead.t / STRIKE : -1;
  const vib = m.strikes.reduce((v, s) => Math.max(v, vibOf(s.t / STRIKE)), 0);
  const uni = m.strikes.reduce((v, s) => Math.max(v, swingOf(s.t / STRIKE)), 0) + pulse(m.spaceT, 0.12) * 0.8;
  const dogRock = m.strikes.reduce((v, s) => Math.max(v, keyOf(s.t / STRIKE)), 0) + pulse(m.spaceT, 0.12);
  const chainStep = !lead ? -1 : leadU < 0.2 ? 0 : leadU < 0.3 ? 1 : leadU < 0.47 ? 2 : leadU < 0.55 ? 3 : leadU < 0.72 ? 4 : 5;
  const seg = m.seg;
  const retPush = pulse(m.retT, 0.35);
  const bellSwing = Math.sin(m.bellT * 60) * pulse(m.bellT, 0.5);

  const P = (id: PartId) => ({
    "data-part": id,
    className: `tw-part${selected === id ? " is-selected" : ""}`,
    opacity: isolate && selected && selected !== id ? 0.07 : 1,
    onClick: (ev: React.MouseEvent) => { ev.stopPropagation(); setSelected(id); },
  });

  /* front elevation */
  const PX = 450, PY = 150;
  const carX = -m.carriage * CW;
  const segDrop = seg * 6;
  const exCar = -62 * e, exKb = 22 * e, exRib = -26 * e, exEsc = 60 * e, exMain = -60 * e, exBasket = 10 * e, exCase = 0;
  const barsFront = TYPEBARS.map((ch, i) => {
    const a = 22 + (i * (180 - 44)) / (TYPEBARS.length - 1);
    const [x0, y0] = pol(PX, PY + segDrop + exBasket, 118, a);
    const [rx, ry] = pol(PX, PY + segDrop + exBasket, 74, a);
    const sw = m.strikes.filter((s) => s.bar === i).reduce((v, s) => Math.max(v, swingOf(s.t / STRIKE)), 0);
    const tx = rx + (PX - rx) * sw, ty = ry + (PY + 2 - ry) * sw;
    return { i, ch, x0, y0, tx, ty, sw };
  });

  const pageTop = PY + 2 - (m.lineAnim + 1) * LH + (1 - m.paperIn) * 170;
  const kbKeys: { x: number; y: number; label: string; code: string; r?: number }[] = [];
  ROWS.forEach((row, r) => row.split("").forEach((ch, i) => kbKeys.push({ x: PX - ((row.length - 1) * 22) / 2 + i * 22 + r * 5, y: 296 + r * 20, label: ch.toUpperCase(), code: ch })));
  kbKeys.push({ x: PX + 140, y: 296, label: "←", code: "Backspace" }, { x: PX - 128, y: 356, label: "⇧", code: "Shift" }, { x: PX + 140, y: 356, label: "⇧", code: "Shift" }, { x: PX + 135, y: 336, label: "↵", code: "Return" });
  const pressedFront = (code: string) => {
    if (code === "Backspace") return pulse(m.backT, 0.15);
    if (code === "Shift") return seg;
    if (code === "Return") return retPush;
    return m.strikes.filter((s) => (BASE[s.ch] ?? s.ch.toLowerCase()) === code).reduce((v, s) => Math.max(v, keyOf(s.t / STRIKE)), 0);
  };
  const clickKey = (code: string) => {
    if (code === "Backspace") act.back();
    else if (code === "Shift") act.shiftOnce();
    else if (code === "Return") act.ret();
    else act.type(code, false);
  };

  /* side section */
  const exKeysS = { x: -28 * e, y: 26 * e }, exSub = { x: 0, y: 30 * e }, exBar = { x: -26 * e, y: -26 * e }, exPlat = { x: 64 * e, y: -46 * e }, exCaseS = { y: 10 * e };
  const keyRows = [3, 2, 1, 0].map((r, i) => ({ r, kx: 128 + i * 46, ky: 588 - i * 15 }));
  const rowDepth = (r: number) => m.strikes.filter((s) => s.row === r).reduce((v, s) => Math.max(v, keyOf(s.t / STRIKE)), 0) + (r === 3 ? pulse(m.spaceT, 0.12) * 0.6 : 0);
  const fulcrum: [number, number] = [560, 664];
  const leadKey = lead ? keyOf(leadU) : 0;
  const swing = lead ? swingOf(leadU) : 0;
  const pivot: [number, number] = [620 + exBar.x, 526 + seg * 9 + exBar.y];
  const platen: [number, number] = [694 + exPlat.x, 440 + exPlat.y];
  const hit: [number, number] = [platen[0] - 30, platen[1] + 4];
  const L = 88;
  const aRest = 166, aHit = (Math.atan2(hit[1] - pivot[1], hit[0] - pivot[0]) * 180) / Math.PI + 360;
  const aBar = aRest + (aHit - aRest) * swing;
  const tip = pol(pivot[0], pivot[1], L, aBar);
  const heel = pol(pivot[0], pivot[1], 14, aBar + 180 - 30);
  const subPivot: [number, number] = [520 + exSub.x, 610 + exSub.y];
  const subRot = -leadKey * 16;
  const subTop = pol(subPivot[0], subPivot[1], 26, -70 + subRot);
  const subLow = pol(subPivot[0], subPivot[1], 22, 150 + subRot);
  const vibY = 474 - vib * 24 + exPlat.y * 0.5;
  const vibF = PY + 16 - vib * 20;

  const lines = m.page.map((cells, l) => ({ l, cells })).filter(({ cells }) => cells.length);

  return (
    <div className="tw" data-glass={glass} data-isolate={isolate && !!selected}>
      <div className="tw-stage" onClick={() => setSelected(null)}>
        <svg className="tw-svg" viewBox="0 0 900 720" role="img" aria-label="Interactive mechanical typewriter. Type on your keyboard or click the keys.">
          <defs>
            <clipPath id="tw-paper-clip"><rect x="0" y="-200" width="900" height={PY + 12 + 200} /></clipPath>
            <pattern id="tw-hatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><line x1="0" y1="0" x2="0" y2="5" className="tw-hatch" /></pattern>
          </defs>

          <text x="24" y="28" className="tw-label">FRONT ELEVATION</text>
          <text x="24" y="420" className="tw-label">SECTION A–A · ONE KEY</text>
          <line x1="24" y1="400" x2="876" y2="400" className="tw-rule" />

          {/* ===== FRONT: internals behind the case ===== */}
          <g {...P("mainspring")} transform={`translate(${exMain} 0)`}>
            <circle cx="196" cy="226" r="24" className="tw-solid" />
            <path d={spiral(196, 226, 21, 4, -m.carriage * 22)} className="tw-thin" />
            <circle cx="196" cy="226" r="3" className="tw-dot" />
          </g>
          <line x1={196 + exMain} y1={202} x2={380 + carX} y2={174 + exCar} className="tw-band" />

          <g {...P("segment")} transform={`translate(0 ${segDrop + exBasket})`}>
            <path d={`M${pol(PX, PY, 126, 16).join(" ")}A126 126 0 0 1 ${pol(PX, PY, 126, 164).join(" ")}L${pol(PX, PY, 110, 164).join(" ")}A110 110 0 0 0 ${pol(PX, PY, 110, 16).join(" ")}Z`} className="tw-solid" />
            {barsFront.map((b) => <circle key={b.i} cx={pol(PX, PY, 118, 22 + (b.i * 136) / (TYPEBARS.length - 1))[0]} cy={pol(PX, PY, 118, 22 + (b.i * 136) / (TYPEBARS.length - 1))[1]} r="1.3" className="tw-dot" />)}
          </g>
          <g {...P("typebar")}>
            {barsFront.map((b) => (
              <g key={b.i} className={b.sw > 0.01 ? "tw-live" : undefined}>
                <line x1={f(b.x0)} y1={f(b.y0)} x2={f(b.tx)} y2={f(b.ty)} className="tw-bar" />
                <rect x={f(b.tx - 2.2)} y={f(b.ty - 2.2)} width="4.4" height="4.4" rx="0.8" className="tw-slug" />
              </g>
            ))}
          </g>
          <g {...P("universal")} transform={`translate(0 ${uni * 3 + exBasket + segDrop * 0.2})`}>
            <rect x="372" y="270" width="156" height="5" rx="2" className="tw-solid" />
            <line x1="528" y1="272" x2="676" y2="250" className="tw-link" />
          </g>
          <g {...P("escapement")} transform={`translate(${exEsc} 0)`}>
            <path d={gear(700, 222, 19, 20, (m.escAnim * 18) % 360)} className="tw-solid" />
            <circle cx="700" cy="222" r="4" className="tw-solid" />
            <line x1="700" y1="222" x2="700" y2="190" className="tw-shaft" />
            <path d={gear(700, 188, 8, 10, -(m.escAnim * 36) % 360)} className="tw-solid" />
            <g transform={`rotate(${dogRock * 9} 680 246)`}>
              <path d="M664 246L696 246L700 240L704 246" className="tw-link" />
              <circle cx="680" cy="246" r="2" className="tw-dot" />
            </g>
          </g>

          {/* casing */}
          <g {...P("casing")} transform={`translate(0 ${exCase})`}>
            <path d="M138 188L762 188Q772 188 776 198L812 380Q814 392 802 392L98 392Q86 392 88 380L124 198Q128 188 138 188Z" className="tw-case" />
            <path d="M150 200L750 200" className="tw-thin" />
            <rect x="404" y="376" width="92" height="9" rx="2" className="tw-plate" />
            {[[132, 200], [768, 200], [98, 382], [802, 382]].map(([x, y]) => <circle key={`${x}${y}`} cx={x} cy={y} r="1.6" className="tw-dot" />)}
          </g>

          {/* ribbon on the top deck */}
          <g {...P("ribbon")} transform={`translate(0 ${exRib})`}>
            {[300, 600].map((x, i) => (
              <g key={x}>
                <circle cx={x} cy="206" r="20" className="tw-solid" />
                <circle cx={x} cy="206" r={14 + (i ? 1 : -1) * Math.min(4, m.spool * 0.04)} className="tw-ink-roll" />
                {[0, 120, 240].map((a) => { const [x2, y2] = pol(x, 206, 7, a + m.spool * 8); return <line key={a} x1={x} y1="206" x2={f(x2)} y2={f(y2)} className="tw-thin" />; })}
                <circle cx={x} cy="206" r="2" className="tw-dot" />
              </g>
            ))}
            <path d={`M300 186L${PX - 12} ${f(vibF)}M${PX + 12} ${f(vibF)}L600 186`} className="tw-ribbon" />
          </g>
          <g {...P("vibrator")} transform={`translate(0 ${exRib})`}>
            <rect x={PX - 12} y={f(vibF - 6)} width="24" height="12" rx="2" className="tw-vib" />
            <rect x={PX - 12} y={f(vibF - 2)} width="24" height="4" className="tw-ribbon-cut" />
          </g>

          {/* carriage, platen and paper */}
          <g transform={`translate(${carX} ${exCar})`}>
            <g {...P("paper")} clipPath="url(#tw-paper-clip)">
              <rect x={PX - 16} y={pageTop - 4} width={MAX_COL * CW + 32} height={MAX_LINE * LH + 20} className="tw-paper" />
              {lines.map(({ l, cells }) => {
                const y = pageTop + (l + 1) * LH - 2;
                const extra = Math.max(...Array.from(cells, (c) => (c ?? "").length));
                return Array.from({ length: Math.max(1, extra) }, (_, layer) => (
                  <text key={`${l}-${layer}`} x={PX} y={y} className="tw-type" textLength={cells.length * CW} lengthAdjust="spacing" xmlSpace="preserve">
                    {Array.from(cells, (c) => (c ?? " ")[layer] ?? " ").join("")}
                  </text>
                ));
              })}
            </g>
            <g {...P("platen")}>
              <rect x="388" y={PY - 8} width="336" height="20" rx="9" className="tw-platen" />
              {Array.from({ length: 13 }, (_, i) => <line key={i} x1={400 + i * 26} y1={PY - 6} x2={400 + i * 26} y2={PY + 10} className="tw-faint" />)}
            </g>
            <g {...P("feedknob")} onClick={(ev) => { ev.stopPropagation(); setSelected("feedknob"); act.feed(1); }}>
              {[376, 736].map((x) => (
                <g key={x}>
                  <circle cx={x} cy={PY + 2} r="13" className="tw-knob" />
                  {Array.from({ length: 8 }, (_, i) => { const [a, b] = pol(x, PY + 2, 13, i * 45 + m.lineAnim * 30); const [c, d] = pol(x, PY + 2, 9, i * 45 + m.lineAnim * 30); return <line key={i} x1={f(a)} y1={f(b)} x2={f(c)} y2={f(d)} className="tw-thin" />; })}
                  <circle cx={x} cy={PY + 2} r="2.4" className="tw-dot" />
                </g>
              ))}
            </g>
            <g {...P("carriage")}>
              <rect x="380" y={PY + 14} width="364" height="14" rx="3" className="tw-solid" />
              <path d={Array.from({ length: 60 }, (_, i) => `M${384 + i * 6} ${PY + 28}L${387 + i * 6} ${PY + 32}L${390 + i * 6} ${PY + 28}`).join("")} className="tw-thin" />
              {[392, 732].map((x) => <circle key={x} cx={x} cy={PY + 21} r="1.6" className="tw-dot" />)}
            </g>
            <g {...P("returnlever")} transform={`rotate(${-retPush * 18} 388 ${PY - 4})`} onClick={(ev) => { ev.stopPropagation(); setSelected("returnlever"); act.ret(); }}>
              <path d={`M392 ${PY - 4}L360 ${PY - 30}L330 ${PY - 32}`} className="tw-lever" />
              <circle cx="330" cy={PY - 32} r="5" className="tw-knob" />
            </g>
          </g>
          <g {...P("carriage")}>
            <line x1="110" y1={PY + 36 + exCar * 0.4} x2="790" y2={PY + 36 + exCar * 0.4} className="tw-rail" />
          </g>
          <g {...P("bell")} transform={`translate(${exEsc * 0.5} ${exCar * 0.4})`}>
            <path d="M770 176A14 14 0 0 1 798 176Z" className="tw-solid" />
            <g transform={`rotate(${bellSwing * 30} 760 196)`}><line x1="760" y1="196" x2="772" y2="178" className="tw-link" /><circle cx="772" cy="178" r="2" className="tw-dot" /></g>
          </g>

          {/* print point marker */}
          <path d={`M${PX - 4} ${PY + 44 + exCar * 0.4}L${PX} ${PY + 38 + exCar * 0.4}L${PX + 4} ${PY + 44 + exCar * 0.4}Z`} className="tw-marker" />

          {/* keyboard */}
          <g {...P("keyboard")} transform={`translate(0 ${exKb + exCase * 0.4})`}>
            {kbKeys.map((k, i) => {
              const d = pressedFront(k.code);
              return (
                <g key={i} className={`tw-key${d > 0.3 ? " is-down" : ""}`} onClick={(ev) => { ev.stopPropagation(); setSelected("keyboard"); clickKey(k.code); }}>
                  <circle cx={k.x} cy={k.y + 2.2} r="8.6" className="tw-key-skirt" />
                  <circle cx={k.x} cy={k.y + d * 2} r="8.6" className="tw-key-top" />
                  <text x={k.x} y={k.y + d * 2 + 3} className="tw-key-label">{k.label}</text>
                </g>
              );
            })}
            <g className={`tw-key${m.spaceT ? " is-down" : ""}`} onClick={(ev) => { ev.stopPropagation(); setSelected("keyboard"); act.type(" ", false); }}>
              <rect x={PX - 90} y={374 + pulse(m.spaceT, 0.12) * 2} width="180" height="9" rx="4.5" className="tw-key-top" />
            </g>
          </g>

          {/* ===== SECTION A–A ===== */}
          <g {...P("casing")} transform={`translate(0 ${exCaseS.y})`}>
            <path d="M84 680L96 610Q100 596 114 594L300 556L640 500Q760 490 770 520L790 680Z" className="tw-case-s" />
            <line x1="70" y1="690" x2="820" y2="690" className="tw-rule" />
          </g>

          {/* return springs under the key levers */}
          <g {...P("springs")}>
            {keyRows.map(({ r, kx }) => { const x = kx + 120, ky = 640 - (r * 4) + rowDepth(r) * 8 * (1 - (x - kx) / (fulcrum[0] - kx)); return <path key={r} d={zigzag(x + exKeysS.x, ky + exKeysS.y, x + exKeysS.x, 684 + exKeysS.y)} className="tw-spring" />; })}
            <path d={zigzag(pivot[0] - 10, pivot[1] + 8, pivot[0] - 54, pivot[1] + 26 - swing * 6, 10, 3)} className="tw-spring" />
          </g>

          {/* key levers */}
          <g {...P("keylever")} transform={`translate(${exKeysS.x} ${exKeysS.y})`}>
            {keyRows.map(({ r, kx, ky }) => { const d = rowDepth(r) * 10; return <line key={r} x1={kx} y1={ky + 34 + d} x2={fulcrum[0]} y2={fulcrum[1] - r * 4} className={`tw-lever${d > 0.5 ? " tw-live" : ""}`} />; })}
            <circle cx={fulcrum[0]} cy={fulcrum[1] - 6} r="5" className="tw-solid" />
            <circle cx={fulcrum[0]} cy={fulcrum[1] - 6} r="1.6" className="tw-dot" />
          </g>
          <g {...P("keyboard")} transform={`translate(${exKeysS.x} ${exKeysS.y})`}>
            {keyRows.map(({ r, kx, ky }) => { const d = rowDepth(r) * 10; return (
              <g key={r} className="tw-key" transform={`translate(0 ${d})`}>
                <line x1={kx} y1={ky + 8} x2={kx} y2={ky + 34} className="tw-shaft" />
                <rect x={kx - 13} y={ky} width="26" height="7" rx="3" className="tw-key-top" />
              </g>
            ); })}
          </g>

          {/* link from key lever to sublever */}
          {(() => { const r = lead?.row ?? 1; const kx = 128 + (3 - r) * 46, ky = 588 - (3 - r) * 15, t = (470 - kx) / (fulcrum[0] - kx); const ly = (ky + 34 + rowDepth(r) * 10) * (1 - t) + (fulcrum[1] - r * 4) * t;
            return <line {...P("sublever")} x1={470 + exKeysS.x} y1={ly + exKeysS.y} x2={subLow[0]} y2={subLow[1]} className="tw-link tw-part" />; })()}
          <g {...P("sublever")}>
            <path d={`M${f(subLow[0])} ${f(subLow[1])}L${subPivot[0]} ${subPivot[1]}L${f(subTop[0])} ${f(subTop[1])}`} className="tw-lever" />
            <circle cx={subPivot[0]} cy={subPivot[1]} r="4" className="tw-solid" />
            <line x1={subTop[0]} y1={subTop[1]} x2={heel[0]} y2={heel[1]} className="tw-link" />
          </g>

          <g {...P("segment")} transform={`translate(${exBar.x} ${exBar.y + seg * 9})`}>
            <path d="M592 512L640 512L640 540L592 540Z" className="tw-solid" fill="url(#tw-hatch)" />
          </g>
          <g {...P("typebar")}>
            <line x1={pivot[0]} y1={pivot[1]} x2={tip[0]} y2={tip[1]} className="tw-bar-s" />
            <line x1={pivot[0]} y1={pivot[1]} x2={heel[0]} y2={heel[1]} className="tw-bar-s" />
            <circle cx={pivot[0]} cy={pivot[1]} r="3.4" className="tw-solid" />
            <g transform={`translate(${f(tip[0])} ${f(tip[1])}) rotate(${aBar + 90})`}>
              <rect x="-4" y="-6" width="8" height="12" rx="1.5" className="tw-slug" />
              <text x="0" y={seg > 0.5 ? -1 : 5} className="tw-slug-glyph">{lead ? lead.ch : "a"}</text>
            </g>
          </g>

          <g {...P("vibrator")}>
            <rect x={hit[0] - 4} y={vibY - 6} width="4" height="16" className="tw-vib" />
          </g>
          <g {...P("ribbon")}>
            <circle cx={630 + exPlat.x * 0.5} cy={exPlat.y * 0.5 + 452} r="8" className="tw-solid" />
            <line x1={630 + exPlat.x * 0.5} y1={exPlat.y * 0.5 + 444} x2={hit[0] - 2} y2={vibY} className="tw-ribbon" />
          </g>

          <g transform={`translate(${exPlat.x} ${exPlat.y})`}>
            <g {...P("carriage")}>
              <rect x="652" y="474" width="100" height="12" rx="3" className="tw-solid" />
              <circle cx="664" cy="492" r="4" className="tw-solid" />
              <circle cx="740" cy="492" r="4" className="tw-solid" />
            </g>
            <g {...P("paper")}>
              <path d="M730 470A32 32 0 1 0 700 410L708 362" className="tw-paper-s" />
            </g>
            <g {...P("platen")}>
              <circle cx="694" cy="440" r="28" className="tw-platen" />
              {Array.from({ length: 6 }, (_, i) => { const [x, y] = pol(694, 440, 18, i * 60 + m.lineAnim * 30); return <line key={i} x1="694" y1="440" x2={f(x)} y2={f(y)} className="tw-faint" />; })}
              <circle cx="694" cy="440" r="3" className="tw-dot" />
            </g>
            <circle cx="712" cy="404" r="4" className="tw-solid" />
          </g>

          {/* impact flash at the print point */}
          {lead && leadU > PRINT_AT - 0.03 && leadU < PRINT_AT + 0.12 && <circle cx={hit[0]} cy={hit[1]} r="5" className="tw-flash" />}
        </svg>
      </div>

      <div className="tw-readout">
        <output>
          {m.lockFlash > 0 ? "Right margin reached. Press Return." : m.paperIn < 0.5 ? "No paper. Insert paper in Controls." : selected ? `${PARTS[selected][0]}: ${PARTS[selected][1]}` : `Line ${m.line - 1} · Column ${m.col + 1}${seg > 0.5 ? " · Shift" : ""} · Type on your keyboard`}
        </output>
      </div>

      <div className="tw-controls">
        <div className="tw-controls-row">
          <Button variant={exploded ? "primary" : "secondary"} type="button" onClick={() => setExploded((v) => !v)}>{exploded ? "Put it back together" : "Exploded view"}</Button>
          <Button variant={glass ? "primary" : "secondary"} type="button" onClick={() => setGlass((v) => !v)}>See-through case</Button>
          <Button variant={slow ? "primary" : "secondary"} type="button" onClick={() => setSlow((v) => !v)}>Slow motion</Button>
          <Button variant="secondary" type="button" onClick={act.paper}>{m.paperTarget > 0.5 ? "Remove paper" : "Insert paper"}</Button>
          <Button variant="secondary" type="button" onClick={() => act.feed(1)}>Feed paper</Button>
          <Button variant="secondary" type="button" onClick={act.ret}>Carriage return</Button>
          <Button variant="secondary" type="button" onClick={act.clear}>Clear page</Button>
          <Button variant="secondary" type="button" onClick={act.demo}>Type a demo</Button>
        </div>
        <div className="tw-controls-grid">
          <div>
            <h3>Inspect a part</h3>
            <div className="tw-chips">
              {(Object.keys(PARTS) as PartId[]).map((id) => (
                <button key={id} type="button" className="tw-chip" aria-pressed={selected === id} onClick={() => setSelected(selected === id ? null : id)}>{PARTS[id][0]}</button>
              ))}
            </div>
            <label className="tw-check"><input type="checkbox" checked={isolate} onChange={(ev) => setIsolate(ev.target.checked)} /> Isolate the selected part</label>
            {selected && <p className="tw-note"><strong>{PARTS[selected][0]}.</strong> {PARTS[selected][1]}</p>}
          </div>
          <div>
            <h3>What one key press does</h3>
            <ol className="tw-chain">
              {CHAIN.map(([text, part], i) => (
                <li key={text} data-active={chainStep === i}>
                  <button type="button" onClick={() => setSelected(part as PartId)}>{text}</button>
                </li>
              ))}
            </ol>
            <p className="tw-note">Turn on slow motion and press a key to follow the chain. Backspace moves the carriage back one space without erasing, like the real machine, so typing again overstrikes.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

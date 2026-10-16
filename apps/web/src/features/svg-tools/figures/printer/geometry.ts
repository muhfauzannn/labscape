import {
  cylinder, extrude, figureSvg, fitProjection, iso, lineSvg, dotsSvg, pathOf, segment, sideMatrix, slabOf, solidSvg,
  type Plan, type Point3, type Projection, type SolidStyle, type Flat,
} from "@/components/iso/iso-kit";
import { LAYER_H, type Job, type Pt } from "./model";

export const W = 900, H = 660;
export const NZ = 250; // nozzle tip height
export const Z0 = NZ - LAYER_H; // build sheet top
export const HX0 = 120, HY0 = 120, GY0 = HY0 - 17;
export const SPOOL: Point3 = [285, 120, 150];

export const PARTS = {
  base: ["Base & electronics", "Mainboard, stepper drivers and power supply. The screen on the front shows the live nozzle temperature and layer."],
  frame: ["Frame", "Aluminium extrusions that hold the motion system square and stiff, so every layer lands on the one below."],
  zaxis: ["Z axis", "Two motors turn 8 mm lead screws. After each layer they lower the bed by exactly one layer height."],
  bed: ["Heated bed", "An aluminium plate with a PEI sheet, held at 60 °C for PLA so the first layer sticks. It carries the print down as it grows."],
  xymotors: ["XY motors", "CoreXY: both motors turning the same way move the head in X, opposite ways move it in Y."],
  belts: ["GT2 belts", "2 mm tooth pitch on a 20-tooth pulley: each 1/16 microstep moves the belt 0.0125 mm."],
  gantry: ["Gantry", "The X beam. It rides the Y rails front to back and carries the print head along its rail."],
  carriage: ["Toolhead carriage", "Runs on the X rail's bearing block and carries the extruder, hotend and cooling fan together."],
  extruder: ["Extruder", "A motor-driven gear bites the 1.75 mm filament and pushes it into the hotend. It turns only while plastic is being laid."],
  hotend: ["Hotend", "A heater cartridge and thermistor hold the melt zone at the set temperature. The finned heatsink stops heat creeping upward."],
  nozzle: ["Nozzle", "0.4 mm brass. Melted plastic leaves as a 0.45 mm line, laid 0.2 mm thick."],
  fan: ["Part-cooling fan", "Blows on fresh plastic so each layer sets before the next one lands on it."],
  spool: ["Filament spool", "1 kg of 1.75 mm PLA. It turns as the extruder pulls filament off it."],
  ptfe: ["PTFE tube", "A slippery guide tube that leads filament from the spool to the extruder as the head moves."],
  object: ["The print", "Built one 0.2 mm layer at a time: outer wall first, then a 45° infill that changes direction every layer."],
} as const;
export type PartId = keyof typeof PARTS;

/** How far each assembly moves in the exploded view (world units). */
export const EXPLODE: Record<string, Point3> = {
  base: [0, 0, -70], zaxis: [0, -46, -20], bed: [0, 0, -28], top: [0, 0, 74], xymotors: [0, 0, 110], gantry: [0, 0, 48],
  head: [0, 0, 26], hotend: [0, 0, 6], nozzle: [0, 0, -16], carriage: [0, 0, 34], fan: [0, 42, 34], extruder: [0, 0, 70],
  spool: [74, 0, 0], frontTop: [0, 0, 74],
};

export const P: Projection = fitProjection(
  [[-10, -10, -76], [340, -10, -76], [-10, 250, -76], [340, 250, 0], [-10, -10, 440], [340, 250, 440], [-10, 250, 300], [340, -50, 300]],
  W, H, { pad: 18 },
);

type Opts = SolidStyle;
const slab = (plan: Partial<Plan> & { x: number; y: number; w: number; d: number }, z: number, h: number, opts: Opts = {}, bevel = 0.8) =>
  solidSvg(slabOf({ r: 1, ...plan }, z, h, P, 8, bevel), opts);
const cyl = (cx: number, cy: number, r: number, z: number, h: number, opts: Opts = {}) => solidSvg(cylinder(cx, cy, r, z, h, P, 28, 0.4), opts);
const line = (a: Point3, b: Point3, tone: "hi" | "mid" | "lo" | "faint" = "lo", cls?: string) => lineSvg(segment(a, b, P), { tone, className: cls });
const dots = (pts: Point3[], size = 0.55) => dotsSvg(pts.map((p) => iso(p, P)), { size, tone: "mid" });
const g = (attrs: string, ...children: string[]) => `<g ${attrs}>${children.join("")}</g>`;
const f = (n: number) => (Math.round(n * 10) / 10).toString();

/** A disc in the plane x = const (the spool flanges face +x). */
export function discX(x: number, cy: number, cz: number, r: number, n = 48): Flat[] {
  return Array.from({ length: n }, (_, i) => { const a = (i / n) * Math.PI * 2; return iso([x, cy + Math.cos(a) * r, cz + Math.sin(a) * r], P); });
}
function hull(pts: Flat[]): Flat[] {
  const s = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: Flat, a: Flat, b: Flat) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo: Flat[] = [], up: Flat[] = [];
  for (const p of s) { while (lo.length >= 2 && cross(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (const p of [...s].reverse()) { while (up.length >= 2 && cross(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return [...lo.slice(0, -1), ...up.slice(0, -1)];
}
const drumX = (x0: number, x1: number, r: number, cls: string) => {
  const [, cy, cz] = SPOOL;
  return `<path class="${cls}" d="${pathOf(hull([...discX(x0, cy, cz, r), ...discX(x1, cy, cz, r)]), true)}"/>`;
};
const flange = (x: number, r: number, cls = "pr-flange") => `<path class="${cls}" d="${pathOf(discX(x, SPOOL[1], SPOOL[2], r), true)}"/>`;

/** Spokes on the front flange, turned by the filament pulled off the spool. */
export function spokesD(angle: number) {
  const [, cy, cz] = SPOOL, x = 300.6;
  let d = "";
  for (let i = 0; i < 6; i++) {
    const a = angle + (i * Math.PI) / 3;
    d += segment([x, cy + Math.cos(a) * 16, cz + Math.sin(a) * 16], [x, cy + Math.cos(a) * 46, cz + Math.sin(a) * 46], P);
  }
  return d;
}

/** The PTFE tube from the spool to the extruder inlet, which follows the head. */
export function tubeD(hx: number, hy: number, hz: number, spoolShift: Point3) {
  const start: Point3 = [SPOOL[0] - 6 + spoolShift[0], SPOOL[1] + spoolShift[1], SPOOL[2] + 46 + spoolShift[2]];
  const a: Point3 = [262 + spoolShift[0] * 0.6, 120, 318];
  const b: Point3 = [hx + 10, hy, hz + 54];
  const end: Point3 = [hx, hy, hz + 36];
  const pts: Flat[] = [];
  const bez = (p0: Point3, p1: Point3, p2: Point3, p3: Point3) => {
    for (let i = 0; i <= 24; i++) {
      const t = i / 24, u = 1 - t;
      pts.push(iso([0, 1, 2].map((k) => u * u * u * p0[k] + 3 * u * u * t * p1[k] + 3 * u * t * t * p2[k] + t * t * t * p3[k]) as Point3, P));
    }
  };
  bez(start, a, b, end);
  return pathOf(pts);
}

/** Completed layers as stacked solids; under-extruded layers are drawn starved. */
export function layersSvg(job: Job, upTo: number, starved: number[]) {
  const convex = job.id === "cube" || job.id === "pyramid" || job.id === "vase";
  let out = "";
  for (let k = 0; k < upTo; k++) {
    const paths = extrude(job.layers[k].ring as [number, number][], Z0 + k * LAYER_H, LAYER_H, P, { convex });
    out += solidSvg(paths, { tone: "hi", crease: "none", className: starved[k] ? "pr-plastic pr-starved" : "pr-plastic" });
  }
  return out;
}

/** The current layer, drawn as hot extruded line up to where the nozzle is. */
export function currentD(job: Job, k: number, s: number) {
  const layer = job.layers[k];
  if (!layer) return "";
  const z = Z0 + (k + 1) * LAYER_H;
  let left = s, d = "";
  for (const m of layer.moves) {
    if (left <= 0) break;
    const t = Math.min(1, left / (m.len || 1));
    if (m.extrude) {
      const b: Pt = [m.a[0] + (m.b[0] - m.a[0]) * t, m.a[1] + (m.b[1] - m.a[1]) * t];
      d += pathOf([iso([m.a[0], m.a[1], z], P), iso([b[0], b[1], z], P)]);
    }
    left -= m.len;
  }
  return d;
}

export function buildPrinter() {
  const parts: string[] = [];
  const push = (s: string) => parts.push(s);

  /* ---- base ---- */
  const screen = sideMatrix([150, 248], 40, P, "left");
  const vents = sideMatrix([248, 214], 34, P, "right");
  push(g(`data-g="base" data-part="base"`,
    slab({ x: -8, y: -8, w: 256, d: 256, r: 8 }, 6, 40, { tone: "mid", halo: true }, 1.4),
    ...[[2, 2], [238, 2], [2, 238], [238, 238]].map(([x, y]) => cyl(x, y, 7, 0, 6, { tone: "lo" })),
    line([-8, 248, 12], [248, 248, 12], "faint"), line([248, 248, 12], [248, -8, 12], "faint"),
    `<g transform="${screen}"><rect class="pr-screen" x="0" y="0" width="64" height="24" rx="2"/><text class="pr-screen-text" x="4" y="9" data-dyn="screen1">24°C</text><text class="pr-screen-text" x="4" y="19" data-dyn="screen2">READY</text></g>`,
    `<g transform="${sideMatrix([28, 248], 30, P, "left")}"><rect class="pr-plate" x="0" y="0" width="34" height="12" rx="1"/><path class="iso-line" data-tone="lo" d="M4 4H30M4 7H24M4 10H27"/></g>`,
    `<g transform="${vents}">${Array.from({ length: 9 }, (_, i) => `<rect class="pr-vent" x="${i * 9}" y="0" width="5" height="18" rx="2.5"/>`).join("")}</g>`,
    `<g transform="${sideMatrix([212, 248], 26, P, "left")}"><circle class="pr-knob" cx="8" cy="0" r="6"/><circle class="pr-dot" cx="8" cy="0" r="1"/></g>`,
    dots([[0, 248, 42], [240, 248, 42], [248, 0, 42], [248, 240, 42]]),
  ));

  /* ---- Z axis (behind the bed) ---- */
  const screw = (x: number) => [
    slab({ x: x - 17, y: -2, w: 34, d: 34, r: 2 }, 46, 36, { tone: "mid" }, 1),
    line([x - 17, 32, 70], [x + 17, 32, 70], "faint"),
    cyl(x, 15, 3, 82, 206, { tone: "mid" }),
    `<path class="pr-thread" data-dyn="thread" d="${segment([x + 2.2, 17.2, 84], [x + 2.2, 17.2, 286], P)}"/>`,
    slab({ x: x - 8, y: 3, w: 16, d: 22, r: 1 }, 284, 8, { tone: "lo" }),
  ].join("");
  push(g(`data-g="zaxis" data-part="zaxis"`, screw(61), screw(179)));

  /* ---- frame posts at the back and sides ---- */
  const post = (x: number, y: number) => slab({ x, y, w: 12, d: 12, r: 1 }, 46, 254, { tone: "mid" }, 0.8) + dots([[x + 6, y + 12, 52], [x + 12, y + 6, 52]]);
  push(g(`data-g="frame" data-part="frame"`, post(0, 0), post(228, 0), post(0, 228)));

  /* ---- bed, sheet and the print ---- */
  const arm = (x: number) => cyl(x, 15, 7, 232, 14, { tone: "mid" }) + slab({ x: x - 9, y: 18, w: 18, d: 14 }, 236, 8, { tone: "mid" });
  push(g(`data-g="bed"`,
    g(`data-part="bed"`,
      arm(61), arm(179),
      slab({ x: 26, y: 26, w: 188, d: 188, r: 4 }, 236, 10, { tone: "mid" }, 1.2),
      slab({ x: 29, y: 29, w: 182, d: 182, r: 3 }, 246, 2, { tone: "lo" }, 0.4),
      dotsSvg(Array.from({ length: 81 }, (_, i) => iso([40 + (i % 9) * 20, 40 + Math.floor(i / 9) * 20, Z0], P)), { size: 0.35, tone: "faint" }),
      dots([[30, 30, 246], [210, 30, 246], [30, 210, 246], [210, 210, 246]]),
      `<g transform="${sideMatrix([150, 214], 244, P, "left")}"><rect class="pr-plate" x="0" y="0" width="30" height="5" rx="1"/></g>`,
    ),
    `<g data-part="object"><g data-dyn="layers"></g><path class="pr-hot" data-dyn="current" d=""/></g>`,
  ));

  /* ---- top frame at the back, motors, rails, belts ---- */
  const motor = (x: number, y: number) => slab({ x, y, w: 30, d: 30, r: 2 }, 300, 30, { tone: "mid" }, 1.2) + line([x, y + 30, 312], [x + 30, y + 30, 312], "faint") + cyl(x + 15, y + 15, 4, 330, 4, { tone: "lo" }) + dots([[x + 4, y + 4, 330], [x + 26, y + 4, 330], [x + 4, y + 26, 330], [x + 26, y + 26, 330]], 0.5);
  push(g(`data-g="top"`,
    g(`data-part="frame"`, slab({ x: 0, y: 0, w: 240, d: 12, r: 1 }, 288, 12, { tone: "mid" }), slab({ x: 0, y: 0, w: 12, d: 240, r: 1 }, 288, 12, { tone: "mid" })),
    g(`data-part="gantry"`, slab({ x: 14, y: 14, w: 6, d: 212 }, 280, 4, { tone: "lo" }, 0.3), slab({ x: 220, y: 14, w: 6, d: 212 }, 280, 4, { tone: "lo" }, 0.3)),
    g(`data-part="belts"`,
      cyl(17, 224, 4, 286, 6, { tone: "lo" }), cyl(223, 224, 4, 286, 6, { tone: "lo" }),
      `<path class="pr-belt" data-dyn="beltA" d="${segment([17, 16, 290], [17, 224, 290], P)}"/>`,
      `<path class="pr-belt" data-dyn="beltB" d="${segment([223, 16, 290], [223, 224, 290], P)}"/>`,
    ),
  ));
  push(g(`data-g="xymotors" data-part="xymotors"`, motor(-2, -2), motor(212, -2)));

  /* ---- gantry ---- */
  push(g(`data-g="gantry" data-part="gantry"`,
    slab({ x: 12, y: GY0 - 12, w: 12, d: 24, r: 1 }, 278, 14, { tone: "mid" }),
    slab({ x: 20, y: GY0 - 6, w: 200, d: 12, r: 1 }, 276, 12, { tone: "mid" }, 1),
    slab({ x: 22, y: GY0 + 6, w: 196, d: 2, r: 0 }, 279, 5, { tone: "lo" }, 0),
    slab({ x: 216, y: GY0 - 12, w: 12, d: 24, r: 1 }, 278, 14, { tone: "mid" }),
    `<path class="pr-belt" data-dyn="beltX" d="${segment([24, GY0, 288.4], [216, GY0, 288.4], P)}"/>`,
    dots([[18, GY0 + 12, 285], [222, GY0 + 12, 285]]),
  ));

  /* ---- print head ---- */
  const hx = HX0, hy = HY0;
  const fin = (z: number) => lineSvg(pathOf(Array.from({ length: 13 }, (_, i) => { const a = Math.PI * (-0.25 + i / 12); return iso([hx + Math.cos(a) * 6.5, hy + Math.sin(a) * 6.5, z], P); })), { tone: "lo" });
  push(g(`data-g="head"`,
    g(`data-g="nozzle" data-part="nozzle"`, cyl(hx, hy, 1.4, NZ, 2, { tone: "hi" }), cyl(hx, hy, 3.4, NZ + 2, 2.4, { tone: "hi" })),
    g(`data-g="hotend" data-part="hotend"`,
      slab({ x: hx - 8, y: hy - 6, w: 16, d: 12, r: 1 }, NZ + 4.4, 8, { tone: "hi", className: "pr-heater" }, 0.6),
      `<g transform="${sideMatrix([hx - 8, hy + 6], NZ + 11, P, "left")}"><circle class="pr-dot" cx="4" cy="3.5" r="1.4"/><path class="iso-line" data-tone="lo" d="M9 1.5H15M9 5.5H15"/></g>`,
      cyl(hx, hy, 6.5, NZ + 12.4, 13, { tone: "mid" }), fin(NZ + 15.5), fin(NZ + 18.5), fin(NZ + 21.5),
    ),
    g(`data-g="carriage" data-part="carriage"`,
      slab({ x: hx - 14, y: hy - 17, w: 28, d: 5, r: 1 }, 276, 14, { tone: "lo" }),
      slab({ x: hx - 16, y: hy - 12, w: 32, d: 25, r: 3 }, 272, 26, { tone: "hi" }, 1.2),
      dots([[hx - 12, hy + 13, 294], [hx + 12, hy + 13, 294], [hx + 16, hy - 8, 294], [hx + 16, hy + 9, 294]]),
    ),
    g(`data-g="fan" data-part="fan"`,
      `<g transform="${sideMatrix([hx - 11, hy + 13], 294, P, "left")}"><rect class="pr-fan-box" x="0" y="0" width="22" height="20" rx="2"/><circle class="pr-fan-ring" cx="11" cy="10" r="8"/><g data-dyn="fan"><path class="pr-blade" d="M11 10L11 3.4A6.6 6.6 0 0 1 16.7 6.7ZM11 10L16.7 13.3A6.6 6.6 0 0 1 11 16.6ZM11 10L5.3 13.3A6.6 6.6 0 0 1 5.3 6.7Z"/></g><circle class="pr-dot" cx="11" cy="10" r="1.6"/></g>`,
    ),
    g(`data-g="extruder" data-part="extruder"`,
      slab({ x: hx - 12, y: hy - 10, w: 24, d: 20, r: 2 }, 298, 18, { tone: "hi" }, 1),
      `<g transform="${sideMatrix([hx + 12, hy + 7], 313, P, "right")}"><circle class="pr-gear-ring" cx="7" cy="6" r="5.4"/><g data-dyn="gear"><path class="pr-gear" d="${gearD(7, 6, 4.6, 12)}"/></g><circle class="pr-dot" cx="7" cy="6" r="1"/></g>`,
      slab({ x: hx - 12, y: hy - 10, w: 24, d: 20, r: 2 }, 316, 10, { tone: "mid" }, 0.8),
      line([hx - 12, hy + 10, 321], [hx + 12, hy + 10, 321], "faint"),
      cyl(hx, hy, 2.8, 326, 6, { tone: "lo" }),
    ),
  ));

  /* ---- front of the frame ---- */
  push(g(`data-g="frontTop" data-part="frame"`,
    slab({ x: 228, y: 0, w: 12, d: 240, r: 1 }, 288, 12, { tone: "mid" }),
    slab({ x: 0, y: 228, w: 240, d: 12, r: 1 }, 288, 12, { tone: "mid" }),
    dots([[234, 240, 294], [6, 240, 294], [240, 6, 294], [240, 234, 294]]),
  ));
  push(g(`data-g="frontPost" data-part="frame"`, post(228, 228)));

  /* ---- spool on its stand ---- */
  const [, cy, cz] = SPOOL;
  push(g(`data-g="spool" data-part="spool"`,
    slab({ x: 252, y: 86, w: 74, d: 68, r: 4 }, 0, 6, { tone: "lo", halo: true }, 0.8),
    slab({ x: 258, y: 116, w: 8, d: 8, r: 1 }, 6, cz - 2, { tone: "mid" }),
    flange(270, 52), drumX(270.2, 299.8, 44, "pr-filament"),
    `<path class="pr-filament-lines" d="${[0.25, 0.5, 0.75].map((t) => pathOf(discX(270 + 30 * t, cy, cz, 44).slice(12, 37))).join("")}"/>`,
    flange(300, 52), flange(300.4, 14, "pr-hub"),
    `<path class="pr-spoke" data-dyn="spokes" d="${spokesD(0)}"/>`,
    slab({ x: 308, y: 116, w: 8, d: 8, r: 1 }, 6, cz - 2, { tone: "mid" }),
    cyl(312, 120, 5, cz - 8, 12, { tone: "lo" }),
    lineSvg(segment([262, cy, cz], [312, cy, cz], P), { tone: "mid", className: "pr-axle" }),
  ));
  push(g(`data-g="ptfe" data-part="ptfe"`, `<path class="pr-tube-o" data-dyn="tube"/><path class="pr-tube" data-dyn="tube2"/>`));

  return figureSvg({ width: W, height: H, label: "An isometric FDM 3D printer: a cube frame with a bed that lowers on two lead screws, a print head on a belt-driven gantry, and a filament spool on a stand feeding a PTFE tube.", body: parts, className: "pr-svg" });
}

function gearD(cx: number, cy: number, r: number, teeth: number) {
  let d = "";
  for (let i = 0; i < teeth * 2; i++) {
    const a = (i * Math.PI) / teeth, rr = i % 2 ? r * 0.78 : r;
    const p = [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr], q = [cx + Math.cos(a + Math.PI / teeth) * rr, cy + Math.sin(a + Math.PI / teeth) * rr];
    d += `${i ? "L" : "M"}${f(p[0])} ${f(p[1])}L${f(q[0])} ${f(q[1])}`;
  }
  return d + "Z";
}

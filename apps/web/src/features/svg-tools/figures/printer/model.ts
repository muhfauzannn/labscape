/** The print job: toolpaths per layer, heater and hotend flow. Every number the figure shows comes from here. */

export type Pt = [number, number];
export interface Move { a: Pt; b: Pt; extrude: boolean; len: number }
export interface Layer { ring: Pt[]; moves: Move[]; length: number }
export interface Job { id: ObjectId; layers: Layer[] }

export const CENTER: Pt = [120, 120];
export const LAYERS = 30;
export const LAYER_H = 2; // world units (mm) per drawn layer
export const LINE_W = 0.45; // mm extrusion width
export const PLAY = 6; // playback: simulated seconds per real second
export const AMBIENT = 24;
export const MIN_EXTRUDE = 185; // PLA: below this the plastic won't flow
export const MAX_TEMP = 260;
export const HEAT_TAU = 7; // s, heater first-order time constant

export const OBJECTS = {
  cube: "Calibration cube",
  vase: "Spiral vase",
  pyramid: "Pyramid",
  twist: "Twisted tower",
  gear: "Gear",
} as const;
export type ObjectId = keyof typeof OBJECTS;

const circle = (r: (a: number) => number, n = 48, rot = 0): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = rot + (i / n) * Math.PI * 2;
    const rr = r(a);
    return [CENTER[0] + Math.cos(a) * rr, CENTER[1] + Math.sin(a) * rr];
  });
const square = (half: number, rot = 0): Pt[] => {
  const pts: Pt[] = [];
  for (let i = 0; i < 4; i++) {
    const a = rot + Math.PI / 4 + (i * Math.PI) / 2;
    const r = half * Math.SQRT2;
    pts.push([CENTER[0] + Math.cos(a) * r, CENTER[1] + Math.sin(a) * r]);
  }
  return pts;
};

function ringOf(id: ObjectId, k: number): Pt[] {
  const t = k / (LAYERS - 1);
  switch (id) {
    case "cube": return square(26);
    case "vase": return circle(() => 20 + 9 * Math.sin(t * Math.PI * 1.15) + 3 * t);
    case "pyramid": return square(34 * (1 - t) + 3);
    case "twist": return circle((a) => 24 + 5 * Math.cos(4 * a), 64, t * 1.2);
    case "gear": return circle((a) => (Math.cos(12 * a) > 0.2 ? 32 : 26), 96);
  }
}

/** Horizontal scanlines of a polygon, for infill. */
function scan(ring: Pt[], y: number): number[] {
  const xs: number[] = [];
  for (let i = 0; i < ring.length; i++) {
    const [ax, ay] = ring[i], [bx, by] = ring[(i + 1) % ring.length];
    if ((ay <= y && by > y) || (by <= y && ay > y)) xs.push(ax + ((y - ay) / (by - ay)) * (bx - ax));
  }
  return xs.sort((a, b) => a - b);
}

const rot = ([x, y]: Pt, a: number): Pt => {
  const c = Math.cos(a), s = Math.sin(a), dx = x - CENTER[0], dy = y - CENTER[1];
  return [CENTER[0] + dx * c - dy * s, CENTER[1] + dx * s + dy * c];
};

function layerOf(id: ObjectId, k: number): Layer {
  const ring = ringOf(id, k);
  const moves: Move[] = [];
  const push = (a: Pt, b: Pt, extrude: boolean) => moves.push({ a, b, extrude, len: Math.hypot(b[0] - a[0], b[1] - a[1]) });
  for (let i = 0; i < ring.length; i++) push(ring[i], ring[(i + 1) % ring.length], true);
  // Solid objects get a 45° infill that alternates direction each layer; the vase is a single wall.
  if (id !== "vase") {
    const angle = (k % 2 ? 1 : -1) * Math.PI / 4;
    const local = ring.map((p) => rot(p, -angle));
    const ys = local.map((p) => p[1]);
    const lo = Math.min(...ys), hi = Math.max(...ys);
    let at: Pt = ring[0], flip = false;
    for (let y = lo + 4; y < hi - 2; y += 7) {
      const xs = scan(local, y);
      for (let j = 0; j + 1 < xs.length; j += 2) {
        const x0 = xs[j] + 1.2, x1 = xs[j + 1] - 1.2;
        if (x1 <= x0) continue;
        let a = rot([x0, y], angle), b = rot([x1, y], angle);
        if (flip) [a, b] = [b, a];
        push(at, a, false);
        push(a, b, true);
        at = b;
      }
      flip = !flip;
    }
    push(at, ring[0], false);
  }
  return { ring, moves, length: moves.reduce((s, m) => s + m.len, 0) };
}

export const jobOf = (id: ObjectId): Job => ({ id, layers: Array.from({ length: LAYERS }, (_, k) => layerOf(id, k)) });

/** Where the nozzle is, s mm into a layer. */
export function pointAt(layer: Layer, s: number): { p: Pt; index: number; extrude: boolean } {
  let left = s;
  for (let i = 0; i < layer.moves.length; i++) {
    const m = layer.moves[i];
    if (left <= m.len || i === layer.moves.length - 1) {
      const t = m.len ? Math.min(1, left / m.len) : 1;
      return { p: [m.a[0] + (m.b[0] - m.a[0]) * t, m.a[1] + (m.b[1] - m.a[1]) * t], index: i, extrude: m.extrude };
    }
    left -= m.len;
  }
  return { p: layer.moves[0].a, index: 0, extrude: false };
}

/** Volumetric flow the hotend can melt at a given temperature, mm³/s (a typical 40 W V6-class hotend). */
export const maxFlow = (temp: number) => Math.max(0, 0.32 * (temp - 175));
/** Flow the job asks for at a given print speed, mm³/s (0.45 mm line × 0.2 mm layer). */
export const flowAt = (speed: number) => speed * LINE_W * 0.2;

export const heatStep = (temp: number, target: number, dt: number) => target + (temp - target) * Math.exp(-dt / HEAT_TAU);

export function formatTime(seconds: number) {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : m ? `${m} min ${String(s % 60).padStart(2, "0")} s` : `${s} s`;
}

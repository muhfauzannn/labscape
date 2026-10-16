import {
  boxCorners,
  cameraOf,
  corners,
  cylinder,
  fitProjection,
  iso,
  pathOf,
  planOutline,
  ring,
  segment,
  slabOf,
  type Flat,
  type Plan,
  type Point3,
  type Projection,
  type SolidPaths,
} from "@/components/iso/iso-kit";

export const WIDTH = 900;
export const HEIGHT = 590;

export const BASE_PLAN: Plan = { x: -112, y: -68, w: 224, d: 136, r: 15 };
export const STAGE_PLAN: Plan = { x: -60, y: -34, w: 120, d: 72, r: 5 };
export const TUBE_A: Point3 = [10, -9, 125];
export const TUBE_B: Point3 = [56, -9, 195];
export const EYE_A: Point3 = [52, -9, 189];
export const EYE_B: Point3 = [65, -9, 209];

const ARM_PROFILE: Array<[number, number]> = [
  [-89, 8], [-60, 8], [-45, 21], [-36, 45], [-35, 81],
  [-24, 101], [-5, 114], [13, 122], [27, 132], [29, 143],
  [19, 149], [2, 140], [-18, 129], [-42, 109], [-53, 88],
  [-55, 55], [-65, 35], [-83, 24],
];

const fitPoints: Point3[] = [
  ...boxCorners(BASE_PLAN, -22, 4),
  ...boxCorners(STAGE_PLAN, 55, 70),
  [-92, -48, 0], [-92, -48, 150], [34, -48, 152],
  [-64, 48, 38], [-46, 48, 78], [72, 53, 58],
  [0, 0, 12], [0, 0, 111], [69, -9, 216],
  TUBE_A, TUBE_B, EYE_A, EYE_B,
  [0, 0, 43], [0, 0, 60], [0, 0, 75],
];

export const P: Projection = fitProjection(fitPoints, WIDTH, HEIGHT, {
  pad: 50,
  azimuth: 54,
  elevation: 31,
});

export const at = (point: Point3): Flat => iso(point, P);
export const worldPath = (points: Point3[], closed = false) => pathOf(points.map(at), closed);
export const worldSegment = (a: Point3, b: Point3) => segment(a, b, P);

function normalize([x, y, z]: Point3): Point3 {
  const length = Math.hypot(x, y, z) || 1;
  return [x / length, y / length, z / length];
}

function cross(a: Point3, b: Point3): Point3 {
  return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
}

function add(a: Point3, b: Point3): Point3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function scale(a: Point3, n: number): Point3 {
  return [a[0] * n, a[1] * n, a[2] * n];
}

function sub(a: Point3, b: Point3): Point3 {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function dot(a: Point3, b: Point3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

const closedWorld = (points: Point3[]) => worldPath(points, true);

/** A shaded cylindrical solid whose axis may be vertical, horizontal, or inclined. */
export function axialCylinder(a: Point3, b: Point3, radius: number, facets = 40): SolidPaths {
  const axis = normalize(sub(b, a));
  const seed: Point3 = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize(cross(axis, seed));
  const v = normalize(cross(axis, u));
  const ringAt = (origin: Point3) => Array.from({ length: facets }, (_, index) => {
    const angle = (index / facets) * Math.PI * 2;
    return add(origin, add(scale(u, Math.cos(angle) * radius), scale(v, Math.sin(angle) * radius)));
  });
  const start = ringAt(a);
  const end = ringAt(b);
  const capA = closedWorld(start);
  const capB = closedWorld(end);
  const buckets = Array.from({ length: 4 }, () => [] as string[]);
  const faces: string[] = [];
  const { sinA, cosA, sinE, cosE } = cameraOf(P);
  const light = normalize([-sinA, cosA, 0.6]);

  for (let index = 0; index < facets; index++) {
    const next = (index + 1) % facets;
    const face = closedWorld([start[index], start[next], end[next], end[index]]);
    faces.push(face);
    const midAngle = ((index + 0.5) / facets) * Math.PI * 2;
    const normal = normalize(add(scale(u, Math.cos(midAngle)), scale(v, Math.sin(midAngle))));
    const lit = (dot(normal, light) + 1) / 2;
    const shade = Math.max(0, Math.min(3, Math.floor(lit * 4)));
    buckets[shade].push(face);
  }

  const view = normalize([cosE * cosA, cosE * sinA, sinE]);
  const towardB = dot(axis, view) > 0;
  const farCap = towardB ? capA : capB;
  const frontCap = towardB ? capB : capA;
  const capShade = buckets[1];
  capShade.push(farCap);
  const rimA = worldPath([...start, start[0]]);
  const rimB = worldPath([...end, end[0]]);
  const side1 = worldPath([start[0], end[0]]);
  const side2 = worldPath([start[Math.floor(facets / 2)], end[Math.floor(facets / 2)]]);

  return {
    fill: [...faces, capA, capB].join(""),
    outline: `${rimA}${rimB}${side1}${side2}`,
    crease: `${side1}${side2}`,
    top: frontCap,
    shades: buckets.map((bucket) => bucket.join("")),
    seamless: true,
  };
}

/** A thick cast profile for the microscope arm, extruded across its depth. */
function sidePrism(profile: Array<[number, number]>, yBack: number, yFront: number): SolidPaths {
  const back = profile.map(([x, z]) => at([x, yBack, z]));
  const front = profile.map(([x, z]) => at([x, yFront, z]));
  const frontPath = pathOf(front, true);
  const backPath = pathOf(back, true);
  const sideBuckets = Array.from({ length: 4 }, () => [] as string[]);
  const sides: string[] = [];
  const { sinA, cosA, sinE, cosE } = cameraOf(P);
  const view = normalize([cosE * cosA, cosE * sinA, sinE]);
  for (let index = 0; index < profile.length; index++) {
    const next = (index + 1) % profile.length;
    const quad = [back[index], back[next], front[next], front[index]];
    const d = pathOf(quad, true);
    sides.push(d);
    const [x1, z1] = profile[index];
    const [x2, z2] = profile[next];
    const normal = normalize([z2 - z1, 0, x1 - x2]);
    const amount = (dot(normal, view) + 1) / 2;
    sideBuckets[Math.max(0, Math.min(3, Math.floor(amount * 4)))].push(d);
  }
  const seams: string[] = [];
  for (let index = 0; index < profile.length; index += 3) {
    seams.push(pathOf([back[index], front[index]]));
  }
  return {
    fill: `${backPath}${frontPath}${sides.join("")}`,
    outline: `${backPath}${frontPath}${seams.join("")}`,
    crease: seams.join(""),
    top: frontPath,
    shades: sideBuckets.map((bucket) => bucket.join("")),
  };
}

export function axisSurfacePoint(a: Point3, b: Point3, radius: number, t: number, angle: number): Point3 {
  const axis = normalize(sub(b, a));
  const seed: Point3 = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize(cross(axis, seed));
  const v = normalize(cross(axis, u));
  const center = add(a, scale(sub(b, a), t));
  return add(center, add(scale(u, Math.cos(angle) * radius), scale(v, Math.sin(angle) * radius)));
}

export function axisKnurls(a: Point3, b: Point3, radius: number, count: number): string[] {
  const axis = normalize(sub(b, a));
  const { sinA, cosA } = cameraOf(P);
  const view: Point3 = [cosA, sinA, 0.28];
  const seed: Point3 = Math.abs(axis[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const u = normalize(cross(axis, seed));
  const v = normalize(cross(axis, u));
  const facingAngle = Math.atan2(dot(view, v), dot(view, u));
  const lines: string[] = [];
  for (let index = 0; index < count; index++) {
    const angle = facingAngle - Math.PI * 0.46 + (index / Math.max(1, count - 1)) * Math.PI * 0.92;
    const p1 = axisSurfacePoint(a, b, radius, 0.12, angle);
    const p2 = axisSurfacePoint(a, b, radius, 0.88, angle);
    lines.push(worldPath([p1, p2]));
  }
  return lines;
}

export function axisWindow(a: Point3, b: Point3, radius: number, from: number, to: number, width: number): string {
  const axis = normalize(sub(b, a));
  const view: Point3 = [Math.cos((P.azimuth ?? 45) * Math.PI / 180), Math.sin((P.azimuth ?? 45) * Math.PI / 180), 0];
  const radial = normalize(sub(view, scale(axis, dot(view, axis))));
  const tangent = normalize(cross(axis, radial));
  const atT = (t: number, side: number) => add(add(add(a, scale(sub(b, a), t)), scale(radial, radius + 0.22)), scale(tangent, side * width));
  return closedWorld([atT(from, -1), atT(to, -1), atT(to, 1), atT(from, 1)]);
}

export const BASE = slabOf(BASE_PLAN, -14, 14, P, 12, 1.8);
export const BASE_GROOVE = planOutline({ ...BASE_PLAN, x: BASE_PLAN.x + 5, y: BASE_PLAN.y + 5, w: BASE_PLAN.w - 10, d: BASE_PLAN.d - 10, r: 10 }, 0.35, P, 8);
export const FEET = corners(BASE_PLAN, 19).map(([x, y]) => ({
  flange: cylinder(x, y, 8.5, -21.5, 2, P, 32, 0.5),
  pad: cylinder(x, y, 6.4, -24.5, 3, P, 32, 0.6),
  ring: ring(x, y, 4.5, -21.5, P, 28),
}));
export const BASE_SCREWS = corners(BASE_PLAN, 10).map(([x, y]) => at([x, y, 0.4]));
export const BASE_LABEL = slabOf({ x: -86, y: 34, w: 44, d: 13, r: 2 }, 0.2, 0.9, P, 6, 0.3);
export const BASE_LABEL_LINE = planOutline({ x: -84, y: 36, w: 40, d: 9, r: 1.4 }, 1.1, P, 6);
export const BASE_LABEL_RULES = [
  worldSegment([-80, 38, 1.2], [-67, 38, 1.2]),
  worldSegment([-80, 41, 1.2], [-53, 41, 1.2]),
  worldSegment([-80, 44, 1.2], [-72, 44, 1.2]),
];

export const LAMP_WELL = cylinder(0, 0, 21, 0.4, 1.4, P, 48, 0.7);
export const LAMP_BEZEL = cylinder(0, 0, 16, 1.8, 3.4, P, 48, 0.6);
export const LAMP_DIFFUSER = cylinder(0, 0, 12, 5.2, 0.8, P, 48);
export const LAMP_RING = ring(0, 0, 9.4, 6.1, P, 48);
export const LAMP_ROCKER = slabOf({ x: 73, y: -42, w: 19, d: 12, r: 4 }, 0.3, 3.4, P, 8, 0.7);
export const LAMP_STATUS = cylinder(80, -35, 2.1, 3.8, 1.1, P, 24, 0.3);
export const CORD: [string, Flat, Flat] = [
  worldPath([[95, -43, -3], [101, -44, -4], [105, -45, -8], [110, -45, -9]].map(([x, y, z]) => [x, y, z] as Point3)),
  at([95, -43, -3]), at([110, -45, -9]),
];

export const ARM = sidePrism(ARM_PROFILE, -43, -22);
export const ARM_SEAM = worldPath([
  [-77, -22, 20], [-61, -22, 31], [-51, -22, 54], [-49, -22, 82], [-37, -22, 103], [-17, -22, 119], [9, -22, 137], [19, -22, 138],
]);
export const ARM_RIBS = [
  axialCylinder([-69, -20, 27], [-44, -20, 83], 2.2, 20),
  axialCylinder([-64, -19, 23], [-39, -19, 79], 1.4, 20),
];
export const ARM_GUSSETS = [
  slabOf({ x: -76, y: -25, w: 26, d: 16, r: 3 }, 6, 9, P, 8, 0.8),
  slabOf({ x: -60, y: -22, w: 20, d: 16, r: 2 }, 20, 5, P, 8, 0.6),
];
export const HINGE_BOSS = cylinder(-43, -9, 12, 35, 12, P, 48, 1);
export const HINGE_CAP = cylinder(-43, 4, 7, 40, 3, P, 40, 0.6);
export const HINGE_RING = ring(-43, 4, 5.1, 43, P, 40);
export const HINGE_LOCK = cylinder(-43, 12, 2.5, 42, 2.4, P, 24, 0.4);

export const STAGE = slabOf(STAGE_PLAN, 55, 7, P, 12, 1.2);
export const STAGE_INSET = planOutline({ ...STAGE_PLAN, x: STAGE_PLAN.x + 4, y: STAGE_PLAN.y + 4, w: STAGE_PLAN.w - 8, d: STAGE_PLAN.d - 8, r: 3 }, 62, P, 8);
export const STAGE_RAILS = [
  slabOf({ x: -51, y: -42, w: 102, d: 5, r: 1.5 }, 52, 4, P, 6, 0.4),
  slabOf({ x: -51, y: 35, w: 102, d: 5, r: 1.5 }, 52, 4, P, 6, 0.4),
  slabOf({ x: -63, y: -30, w: 5, d: 64, r: 1.5 }, 53, 4, P, 6, 0.4),
  slabOf({ x: 58, y: -30, w: 5, d: 64, r: 1.5 }, 53, 4, P, 6, 0.4),
];
export const STAGE_STOP_BLOCKS = [
  slabOf({ x: -57, y: -42, w: 8, d: 8, r: 1.5 }, 56, 4, P, 6, 0.4),
  slabOf({ x: 49, y: 34, w: 8, d: 8, r: 1.5 }, 56, 4, P, 6, 0.4),
];
export const STAGE_SCREWS = corners(STAGE_PLAN, 6).map(([x, y]) => at([x, y, 62.4]));
export const STAGE_MARKS = Array.from({ length: 11 }, (_, index) => {
  const x = -38 + index * 7.6;
  return worldSegment([x, 39, 58], [x, 39, index % 5 === 0 ? 55 : 56.5]);
});
export const SLIDE = slabOf({ x: -26, y: -9, w: 52, d: 18, r: 1.4 }, 62.3, 0.9, P, 4, 0.2);
export const SLIDE_RIM = planOutline({ x: -24, y: -7, w: 48, d: 14, r: 1 }, 63.3, P, 4);
export const COVER_SLIP = slabOf({ x: -7, y: -4, w: 14, d: 8, r: 1.2 }, 63.3, 0.45, P, 4, 0.1);
export const SPECIMEN_LINES = [
  worldPath([[-5, 0, 63.9], [-3, -2, 63.9], [-1, -1, 63.9], [0, 1, 63.9], [3, 2, 63.9], [4, 4, 63.9]]),
  worldPath([[-4, 0, 63.9], [-2, 2, 63.9], [1, 1, 63.9], [3, -1, 63.9], [5, -3, 63.9]]),
];
export const SPECIMEN_DOTS = [[-3, -1], [0, 1], [3, -2], [2, 3], [-1, 3]].map(([x, y]) => at([x, y, 64]));
export const STAGE_CLIPS = [
  slabOf({ x: -43, y: -9, w: 12, d: 5, r: 2 }, 62.1, 2.4, P, 6, 0.5),
  slabOf({ x: 31, y: 12, w: 12, d: 5, r: 2 }, 62.1, 2.4, P, 6, 0.5),
];
export const CLIP_SCREWS = [
  at([-41, -6.5, 64.5]), at([-34, -6.5, 64.5]), at([33, 14.5, 64.5]), at([40, 14.5, 64.5]),
];
export const STAGE_CONTROL_SHAFTS = [
  axialCylinder([56, 23, 55], [70, 23, 55], 2.2, 28),
  axialCylinder([46, 39, 55], [46, 53, 55], 2.2, 28),
];
export const STAGE_CONTROL_WHEELS = [
  axialCylinder([63, 23, 55], [71, 23, 55], 6.5, 36),
  axialCylinder([46, 47, 55], [54, 47, 55], 6.5, 36),
];
export const STAGE_CONTROL_KNURLS = [
  ...axisKnurls([63, 23, 55], [71, 23, 55], 6.5, 28),
  ...axisKnurls([46, 47, 55], [54, 47, 55], 6.5, 28),
];

export const FOCUS_HOUSING = slabOf({ x: -65, y: -6, w: 22, d: 20, r: 5 }, 42, 20, P, 8, 1);
export const FOCUS_RACK = slabOf({ x: -51, y: -14, w: 5, d: 30, r: 1.5 }, 41, 33, P, 6, 0.5);
export const FOCUS_PINION = cylinder(-46, 4, 10, 51, 12, P, 40, 0.9);
export const FOCUS_WHEELS = [
  axialCylinder([-47, 19, 55], [-47, 42, 55], 14, 48),
  axialCylinder([-47, 41, 55], [-47, 46, 55], 8, 40),
  axialCylinder([-47, -38, 55], [-47, -15, 55], 14, 48),
  axialCylinder([-47, -15, 55], [-47, -10, 55], 8, 40),
];
export const FOCUS_KNURLS = [
  ...axisKnurls([-47, 19, 55], [-47, 42, 55], 14, 72),
  ...axisKnurls([-47, 41, 55], [-47, 46, 55], 8, 40),
  ...axisKnurls([-47, -38, 55], [-47, -15, 55], 14, 72),
  ...axisKnurls([-47, -15, 55], [-47, -10, 55], 8, 40),
];
export const FOCUS_BANDS = [
  axialCylinder([-47, 39, 55], [-47, 40, 55], 14.3, 48),
  axialCylinder([-47, 42, 55], [-47, 43, 55], 8.2, 40),
  axialCylinder([-47, -17, 55], [-47, -16, 55], 14.3, 48),
  axialCylinder([-47, -14, 55], [-47, -13, 55], 8.2, 40),
];
export const FOCUS_STOPS = [
  slabOf({ x: -53, y: -15, w: 10, d: 4, r: 1 }, 82, 4, P, 6, 0.4),
  slabOf({ x: -54, y: -15, w: 12, d: 4, r: 1 }, 38, 4, P, 6, 0.4),
];

export const CONDENSER_CARRIER = slabOf({ x: -24, y: -22, w: 48, d: 44, r: 5 }, 48, 5, P, 10, 0.8);
export const CONDENSER_BARREL = cylinder(0, 0, 12, 45, 13, P, 48, 1.1);
export const CONDENSER_LOWER_RING = cylinder(0, 0, 13.2, 43.5, 2, P, 48, 0.5);
export const CONDENSER_LENS_RING = ring(0, 0, 9.8, 58.2, P, 48);
export const CONDENSER_LENS = cylinder(0, 0, 8.8, 58, 1, P, 48, 0.2);
export const IRIS_HOUSING = cylinder(0, 0, 10.3, 54, 2, P, 40, 0.4);
export const IRIS_RING = ring(0, 0, 8.1, 56.2, P, 40);
export const IRIS_LEVER = slabOf({ x: 11, y: -3, w: 9, d: 4, r: 1.5 }, 53, 2.5, P, 6, 0.4);
export const IRIS_LEVER_CAP = cylinder(19, -1, 2.5, 54, 2, P, 24, 0.4);
export const CONDENSER_HEIGHT_KNOB = axialCylinder([17, 14, 48], [25, 14, 48], 5.5, 32);
export const CONDENSER_HEIGHT_KNURLS = axisKnurls([17, 14, 48], [25, 14, 48], 5.5, 28);

export const NOSEPIECE = cylinder(0, 0, 19, 101, 6, P, 64, 1);
export const NOSEPIECE_RIM = ring(0, 0, 16.7, 107.3, P, 56);
export const NOSEPIECE_HUB = cylinder(0, 0, 8.5, 107, 4.5, P, 48, 0.8);
export const NOSEPIECE_DETENT = cylinder(14, 1, 2.3, 106, 2.8, P, 24, 0.4);
export const NOSEPIECE_FACE = ring(0, 0, 6, 111.7, P, 48);

export const OBJECTIVES = [
  { point: [0, 0] as [number, number], top: 105, bottom: 83, radius: 5.6, collar: 6.8 },
  { point: [15, -3] as [number, number], top: 105, bottom: 87, radius: 4.7, collar: 5.8 },
  { point: [-14, -5] as [number, number], top: 105, bottom: 89, radius: 4.2, collar: 5.2 },
  { point: [1, 15] as [number, number], top: 105, bottom: 90, radius: 4.5, collar: 5.5 },
].map(({ point: [x, y], top, bottom, radius, collar }) => ({
  barrel: cylinder(x, y, radius, bottom + 2, top - bottom - 2, P, 36, 0.6),
  upper: cylinder(x, y, radius + 0.7, top - 2.7, 2.8, P, 36, 0.5),
  nose: cylinder(x, y, radius + 0.45, bottom, 2.4, P, 36, 0.4),
  collar: cylinder(x, y, collar, top, 2.5, P, 36, 0.6),
  glass: cylinder(x, y, radius * 0.68, bottom - 0.7, 0.9, P, 32, 0.1),
  rim: ring(x, y, radius + 0.1, bottom + 2.5, P, 32),
}));

export const PRISM_HOUSING = slabOf({ x: -13, y: -28, w: 43, d: 39, r: 7 }, 113, 19, P, 10, 1.1);
export const PRISM_FACE = slabOf({ x: -5, y: -19, w: 27, d: 21, r: 3 }, 132.2, 0.8, P, 8, 0.2);
export const PRISM_BLOCK = sidePrism([[0, 116], [13, 116], [23, 123], [21, 132], [8, 132], [-1, 126]], -18, 0);
export const HEAD_SADDLE = slabOf({ x: 8, y: -42, w: 25, d: 23, r: 4 }, 128, 7, P, 8, 0.8);
export const HEAD_SADDLE_SCREWS = corners({ x: 8, y: -42, w: 25, d: 23, r: 0 }, 3).map(([x, y]) => at([x, y, 135.3]));
export const PRISM_SEAMS = [
  planOutline({ x: -10, y: -25, w: 37, d: 33, r: 6 }, 129, P, 8),
  worldSegment([-7, -18, 132.7], [15, -18, 132.7]),
];

export const BODY_TUBE = axialCylinder(TUBE_A, TUBE_B, 9.4, 48);
export const BODY_TUBE_COLLARS = [
  axialCylinder([13, -9, 129.5], [17, -9, 135.6], 10.8, 48),
  axialCylinder([45, -9, 178.2], [49, -9, 184.3], 10, 48),
];
export const TUBE_WINDOW = axisWindow(TUBE_A, TUBE_B, 9.55, 0.18, 0.81, 0.38);
export const TUBE_WINDOW_EDGE = axisWindow(TUBE_A, TUBE_B, 9.74, 0.17, 0.82, 0.42);
export const TUBE_LENSES = [
  axialCylinder([23, -9, 144.8], [24.4, -9, 146.9], 6.6, 40),
  axialCylinder([37.3, -9, 166.5], [38.8, -9, 168.8], 6.7, 40),
];
export const INTERMEDIATE_IMAGE = [
  worldPath([[35.5, -9, 164], [37, -9, 168], [39, -9, 167], [40, -9, 164], [37, -9, 162], [35.5, -9, 164]]),
  worldPath([[37, -10, 161.8], [37, -8, 161.8]]),
];

export const EYEPIECE = axialCylinder(EYE_A, EYE_B, 7, 44);
export const EYEPIECE_BANDS = [
  axialCylinder([54.5, -9, 192.8], [56.8, -9, 196.3], 8.2, 40),
  axialCylinder([62, -9, 204], [64.4, -9, 207.6], 8, 40),
];
export const DIOPTER_KNURLS = axisKnurls([54.5, -9, 192.8], [56.8, -9, 196.3], 8.2, 42);
export const EYE_LENS = axialCylinder([62.7, -9, 205], [64.1, -9, 207.3], 5.8, 40);
export const EYECUP = axialCylinder([64, -9, 208], [69, -9, 215.7], 8.4, 40);

export const ARM_RIVETS = [
  at([-80, -21.5, 17]), at([-54, -21.5, 52]), at([-43, -21.5, 92]),
  at([-20, -21.5, 124]), at([8, -21.5, 139]),
];
export const STAGE_HOLDER = slabOf({ x: -38, y: -41, w: 76, d: 8, r: 2 }, 48, 5, P, 8, 0.6);
export const STAGE_HOLDER_BOLTS = corners({ x: -38, y: -41, w: 76, d: 8, r: 0 }, 4).map(([x, y]) => at([x, y, 53.5]));
export const STAGE_CARRIAGE = slabOf({ x: -54, y: -34, w: 108, d: 68, r: 4 }, 51.5, 3.5, P, 10, 0.7);
export const FOCUS_RACK_TICKS = Array.from({ length: 9 }, (_, index) => worldSegment([-45.5, 7.2, 43 + index * 4.1], [-42, 7.2, 43 + index * 4.1]));

export const raySets = {
  center: [
    [0, 0, 9], [0, 0, 46], [0, 0, 61.7], [0, 0, 64], [0, 0, 83],
    [0, 0, 101], [8, -9, 123], [22, -9, 145], [37, -9, 168], [56, -9, 195], [69, -9, 215],
  ] as Point3[],
  marginalA: [
    [-8, 0, 9], [-6, 0, 45], [-2, 0, 61.7], [0, 0, 64], [5.4, 0, 83],
    [6.2, 0, 101], [8, -9, 123], [27, -9, 150], [37, -9, 168], [52, -9, 190], [60, -9, 209], [69, -9, 215],
  ] as Point3[],
  marginalB: [
    [8, 0, 9], [6, 0, 45], [2, 0, 61.7], [0, 0, 64], [-5.4, 0, 83],
    [-6.2, 0, 101], [8, -9, 123], [17, -9, 146], [37, -9, 168], [60, -9, 201], [69, -9, 215],
  ] as Point3[],
};

export const RAY_D = Object.fromEntries(Object.entries(raySets).map(([name, points]) => [name, worldPath(points)])) as Record<keyof typeof raySets, string>;
export const OPTICAL_AXIS = [
  worldSegment([0, 0, 8], [0, 0, 61.5]),
  worldSegment([0, 0, 64], [0, 0, 83]),
  worldPath([[0, 0, 101], [8, -9, 123], [56, -9, 195], [69, -9, 215]]),
];


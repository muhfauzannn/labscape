const smooth = (a: number, b: number, value: number) => {
  const t = Math.max(0, Math.min(1, (value - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function energyAfter(current: number, powered: boolean, dt: number, still: boolean) {
  const target = powered ? 1 : 0;
  const next = still ? target : current + (target - current) * (1 - Math.exp(-dt / 0.16));
  return Math.abs(target - next) < 0.0005 ? target : next;
}

/** One continuous energy value drives the image, line, and phosphor dot in either direction. */
export function crtPoseAt(energy: number) {
  const sx = smooth(0.06, 0.34, energy);
  const sy = smooth(0.34, 1, energy);
  return {
    sx,
    sy,
    opacity: smooth(0.08, 0.42, energy),
    beam: sx * (1 - sy) * smooth(0.04, 0.18, energy),
    dot: (1 - sx) * smooth(0, 0.05, energy),
  };
}

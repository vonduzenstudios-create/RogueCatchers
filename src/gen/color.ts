/** Convert HSL (h in degrees, s and l in 0..1) to a #rrggbb string. */
export function hsl(h: number, s: number, l: number): string {
  h = ((h % 360) + 360) % 360;
  s = clamp01(s);
  l = clamp01(l);
  const c = (1 - Math.abs(2 * l - 1)) * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = l - c / 2;
  const [r, g, b] =
    h < 60 ? [c, x, 0] : h < 120 ? [x, c, 0] : h < 180 ? [0, c, x] : h < 240 ? [0, x, c] : h < 300 ? [x, 0, c] : [c, 0, x];
  const hex = (v: number) => Math.round((v + m) * 255).toString(16).padStart(2, '0');
  return `#${hex(r)}${hex(g)}${hex(b)}`;
}

/**
 * A 4-step shading ramp: [shadow, base, light, highlight].
 * Shadows shift hue toward purple and highlights toward yellow,
 * the usual pixel-art trick that keeps colours lively.
 */
export function ramp(h: number, s: number, l: number): [string, string, string, string] {
  return [
    hsl(h + shiftToward(h, 260, 18), s * 0.9, l - 0.2),
    hsl(h, s, l),
    hsl(h + shiftToward(h, 60, 10), s * 0.95, l + 0.13),
    hsl(h + shiftToward(h, 60, 18), s * 0.7, l + 0.27),
  ];
}

/** Degrees to rotate `from` toward `to`, at most `amount`. */
function shiftToward(from: number, to: number, amount: number): number {
  const diff = ((to - from + 540) % 360) - 180;
  return Math.sign(diff) * Math.min(Math.abs(diff), amount);
}

function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

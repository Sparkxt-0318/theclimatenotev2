/**
 * CIELAB conversion and colour-vision-deficiency simulation.
 *
 * Contrast ratio alone is the wrong tool for a categorical palette: two colours
 * can have identical luminance (contrast ratio 1.0 between them) and still be
 * instantly distinguishable by hue. Perceptual distance in CIELAB answers the
 * question we actually care about — "does a reader see these as two different
 * colours?" — and running the same check through a CVD simulation answers it
 * for the ~8% of men with red-green colour blindness too.
 */

import { parseColor } from './contrast';

type Vec3 = [number, number, number];

function srgbToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
}

function linearToSrgb(channel: number): number {
  const clamped = Math.min(1, Math.max(0, channel));
  const c = clamped <= 0.0031308 ? clamped * 12.92 : 1.055 * clamped ** (1 / 2.4) - 0.055;
  return Math.round(c * 255);
}

function toLinearRgb(color: string): Vec3 {
  const { r, g, b } = parseColor(color);
  return [srgbToLinear(r), srgbToLinear(g), srgbToLinear(b)];
}

function applyMatrix(m: readonly Vec3[], v: Vec3): Vec3 {
  const row = (i: number): number => {
    const r = m[i];
    if (!r) throw new Error('malformed matrix');
    return r[0] * v[0] + r[1] * v[1] + r[2] * v[2];
  };
  return [row(0), row(1), row(2)];
}

/** D65 white point. */
const WHITE: Vec3 = [0.95047, 1.0, 1.08883];

const RGB_TO_XYZ: readonly Vec3[] = [
  [0.4124564, 0.3575761, 0.1804375],
  [0.2126729, 0.7151522, 0.072175],
  [0.0193339, 0.119192, 0.9503041],
];

export type Lab = { L: number; a: number; b: number };

export function toLab(color: string): Lab {
  const [X, Y, Z] = applyMatrix(RGB_TO_XYZ, toLinearRgb(color));
  // CIE standard: cbrt above the epsilon, linear below it. Both branches must
  // land in the same range — dividing only the constant by 116 (rather than the
  // whole linear expression) inflates near-black colours enormously.
  const f = (t: number) =>
    t > 216 / 24389 ? Math.cbrt(t) : ((24389 / 27) * t + 16) / 116;
  const fx = f(X / WHITE[0]);
  const fy = f(Y / WHITE[1]);
  const fz = f(Z / WHITE[2]);
  return { L: 116 * fy - 16, a: 500 * (fx - fy), b: 200 * (fy - fz) };
}

/** Perceptual lightness, 0 (black) to 100 (white). */
export function lightness(color: string): number {
  return toLab(color).L;
}

/**
 * CIE76 perceptual distance. Rough rules of thumb: below ~2.3 is a "just
 * noticeable difference", ~10 reads as a shade change, and above ~25 reads as
 * unambiguously two different colours.
 *
 * CIE76 under-reports differences among saturated blues, so treat its output
 * as a conservative floor rather than a precise figure.
 */
export function deltaE76(a: string, b: string): number {
  const la = toLab(a);
  const lb = toLab(b);
  return Math.hypot(la.L - lb.L, la.a - lb.a, la.b - lb.b);
}

/**
 * Viénot–Brettel–Mollon dichromacy simulation matrices, applied in linear RGB.
 * Deuteranopia (~6% of men) and protanopia (~2%) are the ones that collapse
 * red/green distinctions — the exact risk for a palette built around a green.
 */
const CVD_MATRICES = {
  protanopia: [
    [0.170556992, 0.829443014, 0],
    [0.170556991, 0.829443008, 0],
    [-0.004517144, 0.004517144, 1],
  ],
  deuteranopia: [
    [0.33066007, 0.66933993, 0],
    [0.33066007, 0.66933993, 0],
    [-0.02785538, 0.02785538, 1],
  ],
  tritanopia: [
    [1, 0.1273989, -0.1273989],
    [0, 0.8739093, 0.1260907],
    [0, 0.8739093, 0.1260907],
  ],
} as const satisfies Record<string, readonly Vec3[]>;

export type CvdType = keyof typeof CVD_MATRICES;
export const CVD_TYPES = Object.keys(CVD_MATRICES) as CvdType[];

/** Returns how `color` appears to someone with the given dichromacy. */
export function simulateCvd(color: string, type: CvdType): string {
  const [r, g, b] = applyMatrix(CVD_MATRICES[type], toLinearRgb(color));
  return `#${[r, g, b].map((c) => linearToSrgb(c).toString(16).padStart(2, '0')).join('')}`;
}

/**
 * The worst-case perceptual distance between two colours across normal vision
 * and all three dichromacies. This is the number a categorical palette must
 * hold up against.
 */
export function minDeltaAcrossVision(a: string, b: string): number {
  return CVD_TYPES.reduce(
    (worst, type) => Math.min(worst, deltaE76(simulateCvd(a, type), simulateCvd(b, type))),
    deltaE76(a, b),
  );
}

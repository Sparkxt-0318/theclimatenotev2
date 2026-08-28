/**
 * WCAG 2.1 relative-luminance and contrast maths.
 *
 * Used by the theme test to prove every text pairing in the palette is
 * readable, and by the figure renderer to pick a label colour that survives
 * whatever fill it lands on.
 */

export type Rgb = { r: number; g: number; b: number };

/** Accepts `#RGB`, `#RRGGBB`, or `rgba(r, g, b, a)`. Alpha is ignored. */
export function parseColor(color: string): Rgb {
  const value = color.trim();

  const rgbaMatch = /^rgba?\(([^)]+)\)$/i.exec(value);
  if (rgbaMatch?.[1]) {
    const parts = rgbaMatch[1].split(',').map((p) => Number.parseFloat(p.trim()));
    const [r, g, b] = parts;
    if (r === undefined || g === undefined || b === undefined || Number.isNaN(r)) {
      throw new Error(`Unparseable colour: ${color}`);
    }
    return { r, g, b };
  }

  const hex = value.replace(/^#/, '');
  const expanded =
    hex.length === 3
      ? hex
          .split('')
          .map((c) => c + c)
          .join('')
      : hex;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) throw new Error(`Unparseable colour: ${color}`);

  return {
    r: Number.parseInt(expanded.slice(0, 2), 16),
    g: Number.parseInt(expanded.slice(2, 4), 16),
    b: Number.parseInt(expanded.slice(4, 6), 16),
  };
}

/**
 * Flattens a translucent colour against a known backdrop. Some semantic tokens
 * are intentionally translucent (brandSubtle), and contrast is only meaningful
 * once they are composited.
 */
export function flatten(foreground: string, backdrop: string): string {
  const match = /^rgba\(([^)]+)\)$/i.exec(foreground.trim());
  if (!match?.[1]) return foreground;

  const parts = match[1].split(',').map((p) => Number.parseFloat(p.trim()));
  const [r, g, b, a = 1] = parts;
  if (r === undefined || g === undefined || b === undefined) return foreground;

  const base = parseColor(backdrop);
  const mix = (fg: number, bg: number) => Math.round(fg * a + bg * (1 - a));
  return `rgb(${mix(r, base.r)}, ${mix(g, base.g)}, ${mix(b, base.b)})`;
}

export function relativeLuminance(color: string): number {
  const { r, g, b } = parseColor(color);
  const channel = (raw: number) => {
    const c = raw / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

/** Contrast ratio between two colours, from 1 (identical) to 21 (black/white). */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lighter, darker] = la > lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

/** WCAG AA thresholds. Large text is >=18pt, or >=14pt bold. */
export const AA = { normalText: 4.5, largeText: 3, nonText: 3 } as const;

/** Picks whichever of two candidates reads better on `background`. */
export function bestTextColor(background: string, candidates: readonly string[]): string {
  let best = candidates[0] ?? '#000000';
  let bestRatio = 0;
  for (const candidate of candidates) {
    const ratio = contrastRatio(candidate, background);
    if (ratio > bestRatio) {
      bestRatio = ratio;
      best = candidate;
    }
  }
  return best;
}

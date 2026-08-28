import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import {
  AA,
  calendarScaleDark,
  calendarScaleLight,
  chartSeriesDark,
  chartSeriesLight,
  contrastRatio,
  deltaE76,
  darkColors,
  flatten,
  lightness,
  minDeltaAcrossVision,
  simulateCvd,
  lightColors,
  type SemanticColors,
} from './index';

/**
 * These tests exist so that swapping in the real brand green cannot silently
 * make text unreadable. If one fails after a palette change, adjust the ramp —
 * do not lower the threshold.
 */

type Pairing = { name: string; fg: keyof SemanticColors; bg: keyof SemanticColors; min: number };

const PAIRINGS: Pairing[] = [
  { name: 'body text on background', fg: 'textPrimary', bg: 'background', min: AA.normalText },
  { name: 'body text on surface', fg: 'textPrimary', bg: 'surface', min: AA.normalText },
  { name: 'secondary text on background', fg: 'textSecondary', bg: 'background', min: AA.normalText },
  { name: 'secondary text on sunken', fg: 'textSecondary', bg: 'surfaceSunken', min: AA.normalText },
  // Tertiary text is only ever used at >=18pt or for de-emphasised metadata.
  { name: 'tertiary text on background', fg: 'textTertiary', bg: 'background', min: AA.largeText },
  { name: 'brand link on background', fg: 'brand', bg: 'background', min: AA.normalText },
  { name: 'brand link on surface', fg: 'brand', bg: 'surface', min: AA.normalText },
  { name: 'text on brand fill', fg: 'textOnBrand', bg: 'brand', min: AA.normalText },
  { name: 'text on brand-subtle chip', fg: 'brandOnSubtle', bg: 'brandSubtle', min: AA.normalText },
  { name: 'danger text on background', fg: 'danger', bg: 'background', min: AA.normalText },
  { name: 'success text on background', fg: 'success', bg: 'background', min: AA.normalText },
];

for (const [schemeName, colors] of [
  ['light', lightColors],
  ['dark', darkColors],
] as const) {
  describe(`${schemeName} palette contrast`, () => {
    for (const pairing of PAIRINGS) {
      it(`${pairing.name} meets ${pairing.min}:1`, () => {
        // brandSubtle is translucent in dark mode; composite before measuring.
        const bg = flatten(colors[pairing.bg], colors.background);
        const fg = flatten(colors[pairing.fg], bg);
        const ratio = contrastRatio(fg, bg);
        assert.ok(
          ratio >= pairing.min,
          `${schemeName}: ${pairing.fg} on ${pairing.bg} is ${ratio.toFixed(2)}:1, needs ${pairing.min}:1`,
        );
      });
    }

    it('separates surface elevations from the background', () => {
      // Not a text pairing, so no AA threshold — but the steps must be
      // *visible*, otherwise cards vanish into the page.
      const step = contrastRatio(colors.surfaceSunken, colors.surface);
      assert.ok(step > 1.03, `surface/sunken are indistinguishable (${step.toFixed(3)}:1)`);
    });
  });
}

describe('impact calendar scale', () => {
  for (const [schemeName, scale, base] of [
    ['light', calendarScaleLight, lightColors],
    ['dark', calendarScaleDark, darkColors],
  ] as const) {
    it(`${schemeName} steps are perceptually even`, () => {
      // Measured as lightness, not contrast ratio: at the pale end of the light
      // scale every swatch sits near white, so contrast-against-background
      // barely moves and would wave through steps a reader cannot tell apart.
      const deltas: number[] = [];
      for (let i = 1; i < scale.length; i += 1) {
        const previous = scale[i - 1];
        const current = scale[i];
        assert.ok(previous !== undefined && current !== undefined);
        const step = deltaE76(previous, current);
        assert.ok(
          step > 12,
          `${schemeName} step ${i - 1}->${i} is only ${step.toFixed(1)} deltaE; readers cannot see it`,
        );
        deltas.push(step);
      }
      // No step may be more than 2.5x another, or the ramp reads as a jump
      // rather than a progression.
      const spread = Math.max(...deltas) / Math.min(...deltas);
      assert.ok(spread < 2.5, `${schemeName} steps are uneven (widest/narrowest = ${spread.toFixed(2)})`);
    });

    it(`${schemeName} runs consistently in one direction`, () => {
      const direction = schemeName === 'light' ? -1 : 1;
      for (let i = 1; i < scale.length; i += 1) {
        const previous = scale[i - 1];
        const current = scale[i];
        assert.ok(previous !== undefined && current !== undefined);
        const change = (lightness(current) - lightness(previous)) * direction;
        assert.ok(change > 0, `${schemeName} step ${i} reverses direction`);
      }
    });

    it(`${schemeName} empty day is visible against the page`, () => {
      const empty = scale[0];
      assert.ok(empty !== undefined);
      // An untouched day still needs a visible cell, or the week looks broken
      // rather than simply unfilled.
      assert.ok(contrastRatio(empty, base.background) > 1.05);
    });
  }
});

describe('chart series', () => {
  for (const [schemeName, series, base] of [
    ['light', chartSeriesLight, lightColors],
    ['dark', chartSeriesDark, darkColors],
  ] as const) {
    it(`${schemeName} series all clear 3:1 against the page`, () => {
      for (const color of series) {
        const ratio = contrastRatio(color, base.background);
        assert.ok(
          ratio >= AA.nonText,
          `${schemeName}: ${color} is only ${ratio.toFixed(2)}:1 against ${base.background}`,
        );
      }
    });

    it(`${schemeName} series stay distinct under red-green colour blindness`, () => {
      // The real test of a palette built around a green. Contrast ratio cannot
      // answer this — two colours can have identical luminance and still be
      // obviously different, or vice versa — so this measures perceptual
      // distance in CIELAB through a dichromacy simulation.
      for (let i = 0; i < series.length; i += 1) {
        for (let j = i + 1; j < series.length; j += 1) {
          const a = series[i];
          const b = series[j];
          assert.ok(a !== undefined && b !== undefined);
          const worst = Math.min(
            deltaE76(a, b),
            deltaE76(simulateCvd(a, 'deuteranopia'), simulateCvd(b, 'deuteranopia')),
            deltaE76(simulateCvd(a, 'protanopia'), simulateCvd(b, 'protanopia')),
          );
          assert.ok(
            worst >= 25,
            `${schemeName}: series ${i} (${a}) and ${j} (${b}) are only ${worst.toFixed(1)} deltaE apart in the worst case`,
          );
        }
      }
    });

    it(`${schemeName} leads with the brand green`, () => {
      // Single-series charts are the common case and must look like us.
      const first = series[0];
      assert.ok(first !== undefined);
      assert.ok(minDeltaAcrossVision(first, base.brand) < 12, 'first series is not the brand green');
    });
  }
});

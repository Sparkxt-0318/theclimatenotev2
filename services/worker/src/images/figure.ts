/**
 * Renders a chart from data the model extracted out of the article.
 *
 * The model emits a specification — series, points, labels — not a picture. We
 * draw it ourselves, in brand colours, from numbers that can be checked against
 * the article text.
 *
 * This is the whole reason the figure path exists. Asking an image model to
 * "draw a graph of this data" produces something chart-shaped with invented
 * numbers on the axes, which for a climate publication is worse than having no
 * figure at all. A rendered chart is either right or visibly broken.
 *
 * Rendered via SVG rather than canvas so there is no native canvas dependency;
 * sharp rasterises the result.
 */

import { chartSeriesLight, neutral } from '@climatenote/shared/theme';
import sharp from 'sharp';
import * as vega from 'vega';
import * as vegaLite from 'vega-lite';

import type { FigureSpec } from '@climatenote/shared';

export type RenderedFigure = {
  png: Buffer;
  width: number;
  height: number;
};

const WIDTH = 1200;
const HEIGHT = 750;

/** Vega-Lite mark for each chart type we allow the model to choose. */
const MARKS = {
  bar: { type: 'bar', cornerRadiusEnd: 4 },
  line: { type: 'line', strokeWidth: 3, point: { size: 60, filled: true } },
  area: { type: 'area', line: true, opacity: 0.75 },
  scatter: { type: 'point', size: 110, filled: true },
} as const;

export async function renderFigure(spec: FigureSpec): Promise<RenderedFigure> {
  const values = spec.series.flatMap((series) =>
    series.points.map((point) => ({
      x: point.x,
      y: point.y,
      series: series.name,
    })),
  );

  // Categorical when the x values are strings, otherwise let Vega infer.
  const xIsCategorical = spec.series.some((s) => s.points.some((p) => typeof p.x === 'string'));
  const multiSeries = spec.series.length > 1;

  const vegaLiteSpec: vegaLite.TopLevelSpec = {
    $schema: 'https://vega.github.io/schema/vega-lite/v5.json',
    width: WIDTH - 160,
    height: HEIGHT - 220,
    background: neutral[0],
    title: {
      text: spec.title,
      anchor: 'start',
      fontSize: 30,
      font: 'Georgia, serif',
      color: neutral[900],
      subtitle: spec.caption.length > 110 ? `${spec.caption.slice(0, 107)}…` : spec.caption,
      subtitleFontSize: 17,
      subtitleColor: neutral[600],
      subtitleFont: 'Helvetica, Arial, sans-serif',
      subtitlePadding: 12,
      offset: 20,
    },
    data: { values },
    mark: MARKS[spec.chartType],
    encoding: {
      x: {
        field: 'x',
        type: xIsCategorical ? 'nominal' : 'quantitative',
        title: spec.xLabel || null,
        // Preserve the order the data arrived in. Vega sorts nominal values
        // alphabetically by default, which would put "Beans, Beef, Cheese..."
        // in a chart whose entire point is that beef towers over everything.
        // The model is instructed to supply a meaningful order; honour it.
        sort: xIsCategorical ? null : undefined,
        axis: { labelFontSize: 16, titleFontSize: 17, labelAngle: xIsCategorical ? -30 : 0 },
      },
      y: {
        field: 'y',
        type: 'quantitative',
        title: spec.yLabel ? `${spec.yLabel}${spec.unit ? ` (${spec.unit})` : ''}` : null,
        axis: { labelFontSize: 16, titleFontSize: 17 },
      },
      ...(multiSeries
        ? {
            color: {
              field: 'series',
              type: 'nominal',
              scale: { range: [...chartSeriesLight] },
              legend: { labelFontSize: 16, titleFontSize: 0, orient: 'top', title: null },
            },
          }
        : { color: { value: chartSeriesLight[0] } }),
    },
    config: {
      font: 'Helvetica, Arial, sans-serif',
      axis: { labelColor: neutral[600], titleColor: neutral[700], gridColor: neutral[200], domainColor: neutral[300] },
      view: { stroke: null },
    },
  };

  const compiled = vegaLite.compile(vegaLiteSpec).spec;
  const view = new vega.View(vega.parse(compiled), { renderer: 'none' });
  const svg = await view.toSVG();
  view.finalize();

  const png = await sharp(Buffer.from(svg))
    .resize(WIDTH, HEIGHT, { fit: 'contain', background: neutral[0] })
    .png({ quality: 92 })
    .toBuffer();

  return { png, width: WIDTH, height: HEIGHT };
}

/**
 * Checks the figure's numbers can be traced back to the article.
 *
 * A chart is more persuasive than a sentence, so an unverifiable one is more
 * dangerous than an unverifiable claim. This does not attempt to verify every
 * data point — it checks the model quoted real source text and that the values
 * are not obviously fabricated.
 */
export function figureIsPlausible(
  spec: FigureSpec,
  articleText: string,
): { ok: boolean; reason?: string } {
  const normalised = articleText.toLowerCase().replace(/\s+/g, ' ');
  const quote = spec.sourceSpan.toLowerCase().replace(/\s+/g, ' ');

  if (quote.length < 15 || !normalised.includes(quote.slice(0, Math.floor(quote.length * 0.8)))) {
    return { ok: false, reason: 'The quoted source text does not appear in the article.' };
  }

  const allPoints = spec.series.flatMap((s) => s.points);
  if (allPoints.some((p) => !Number.isFinite(p.y))) {
    return { ok: false, reason: 'The chart contains non-numeric values.' };
  }

  // At least half the plotted values should appear as digits somewhere in the
  // article. A chart whose numbers are nowhere in the text was invented.
  const digitsInArticle = new Set(articleText.match(/\d+(?:\.\d+)?/g) ?? []);
  const traceable = allPoints.filter((point) => {
    const rounded = Math.round(point.y);
    return (
      digitsInArticle.has(String(point.y)) ||
      digitsInArticle.has(String(rounded)) ||
      digitsInArticle.has(rounded.toFixed(1))
    );
  });

  if (allPoints.length > 0 && traceable.length / allPoints.length < 0.5) {
    return {
      ok: false,
      reason: `Only ${traceable.length} of ${allPoints.length} plotted values appear in the article.`,
    };
  }

  return { ok: true };
}

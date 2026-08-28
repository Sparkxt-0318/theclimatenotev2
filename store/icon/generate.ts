/**
 * Generates the app icon and launch images.
 *
 * PLACEHOLDER. This is built from the brand tokens so nothing is blocked while
 * the real logo is outstanding — replace `mark()` with the logo artwork when it
 * arrives and re-run. The geometry and export sizes stay correct either way.
 *
 * iOS requirements this satisfies:
 *  - 1024x1024, square, NO alpha channel and NO rounded corners. iOS applies
 *    its own mask; a pre-rounded icon gets a dark halo around the corners.
 *  - The mark keeps clear of the corners, since the mask crops roughly 10%.
 *
 * Run: pnpm --filter @climatenote/store icon
 */

import { mkdirSync } from 'node:fs';
import { join } from 'node:path';

import { brand, neutral } from '@climatenote/shared/theme';
import sharp from 'sharp';

const SIZE = 1024;

/**
 * The mark: a leaf whose central vein is also the rule of a written note —
 * the two halves of "climate" and "note".
 */
function mark(color: string, size = SIZE): string {
  const s = (value: number) => (value * size) / 1024;

  return `
    <g transform="translate(${s(512)}, ${s(512)})">
      <!-- Leaf body: two mirrored quadratic curves meeting at tip and base. -->
      <path d="
        M 0 ${s(-268)}
        C ${s(78)} ${s(-208)}, ${s(178)} ${s(-78)}, ${s(178)} ${s(48)}
        C ${s(178)} ${s(178)}, ${s(102)} ${s(258)}, 0 ${s(268)}
        C ${s(-102)} ${s(258)}, ${s(-178)} ${s(178)}, ${s(-178)} ${s(48)}
        C ${s(-178)} ${s(-78)}, ${s(-78)} ${s(-208)}, 0 ${s(-268)}
        Z"
        fill="${color}"/>

      <!-- The vein, cut out so it reads as ruled lines on a page. -->
      <path d="M 0 ${s(-196)} L 0 ${s(226)}"
            stroke="${brand[600]}" stroke-width="${s(24)}" stroke-linecap="round"/>
      ${[-84, 10, 104]
        .map(
          (y, index) => {
            const reach = [96, 116, 96][index] ?? 100;
            const rise = [64, 72, 60][index] ?? 64;
            return `
      <path d="M 0 ${s(y)} L ${s(reach)} ${s(y - rise)}"
            stroke="${brand[600]}" stroke-width="${s(19)}" stroke-linecap="round"/>
      <path d="M 0 ${s(y)} L ${s(-reach)} ${s(y - rise)}"
            stroke="${brand[600]}" stroke-width="${s(19)}" stroke-linecap="round"/>`;
          },
        )
        .join('')}
    </g>`;
}

function iconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
        <stop offset="0%" stop-color="${brand[500]}"/>
        <stop offset="100%" stop-color="${brand[700]}"/>
      </linearGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
    ${mark(neutral[0])}
  </svg>`;
}

function splashSvg(background: string, markColor: string): string {
  const width = 1284;
  const height = 2778;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${background}"/>
    <g transform="translate(${(width - 320) / 2}, ${(height - 320) / 2}) scale(${320 / 1024})">
      ${mark(markColor)}
    </g>
  </svg>`;
}

async function main(): Promise<void> {
  const assets = join(import.meta.dirname, '../../apps/mobile/assets');
  const storeDir = join(import.meta.dirname, 'generated');
  mkdirSync(assets, { recursive: true });
  mkdirSync(storeDir, { recursive: true });

  // App Store icon: flattened onto an opaque background because an alpha
  // channel is rejected at upload.
  const icon = await sharp(Buffer.from(iconSvg()))
    .flatten({ background: brand[600] })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await sharp(icon).toFile(join(assets, 'icon.png'));
  await sharp(icon).toFile(join(storeDir, 'app-icon-1024.png'));

  await sharp(Buffer.from(splashSvg(neutral[0], brand[500])))
    .png()
    .toFile(join(assets, 'splash.png'));

  await sharp(Buffer.from(splashSvg('#0D0D08', brand[300])))
    .png()
    .toFile(join(assets, 'splash-dark.png'));

  // Verify what Apple actually checks.
  const meta = await sharp(join(storeDir, 'app-icon-1024.png')).metadata();
  const problems: string[] = [];
  if (meta.width !== 1024 || meta.height !== 1024) {
    problems.push(`icon is ${meta.width}x${meta.height}, must be 1024x1024`);
  }
  if (meta.hasAlpha) problems.push('icon has an alpha channel, which App Store Connect rejects');

  if (problems.length > 0) {
    for (const problem of problems) console.error(`FAIL ${problem}`);
    process.exit(1);
  }

  console.log(`ok   app icon 1024x1024, no alpha channel`);
  console.log(`ok   splash (light and dark) written to apps/mobile/assets`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

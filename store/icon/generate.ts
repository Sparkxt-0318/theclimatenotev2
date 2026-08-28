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
 * The mark: the spiral-bound notebook from the logo.
 *
 * Simplified for icon use. The logo renders the notebook in perspective with a
 * fine wire coil and delicately fanned pages; at 60 x 60 on a home screen both
 * would turn to mush. This keeps the silhouette — cover, darker spine band,
 * bold coil, pages splaying up and right — and drops the detail that would not
 * survive.
 */
function mark(size = SIZE): string {
  const s = (value: number) => (value * size) / 1024;

  // Pages behind the cover, fanning up and to the right as in the logo.
  const pages = [
    { dx: 34, dy: -30, w: 300, h: 470, fill: brand[200], rotate: 3 },
    { dx: 66, dy: -54, w: 262, h: 450, fill: brand[100], rotate: 6 },
  ]
    .map(
      (page) => `
      <g transform="rotate(${page.rotate} ${s(-40)} ${s(240)})">
        <rect x="${s(-150 + page.dx)}" y="${s(-236 + page.dy)}"
              width="${s(page.w)}" height="${s(page.h)}"
              rx="${s(16)}" fill="${page.fill}"/>
      </g>`,
    )
    .reverse()
    .join('');

  // The coil. Six bold loops rather than the logo's finer wire, so the binding
  // still reads at small sizes.
  const coil = Array.from({ length: 6 }, (_, index) => {
    const y = -186 + index * 76;
    return `
      <path d="M ${s(-206)} ${s(y)} q ${s(34)} ${s(-26)} ${s(66)} 0"
            fill="none" stroke="${brand[700]}" stroke-width="${s(19)}" stroke-linecap="round"/>`;
  }).join('');

  return `
    <!-- 1.3, not larger: iOS masks the icon to a squircle, and at 1.4 the
         top-right page corner fell inside the region the mask cuts away. -->
    <g transform="translate(${s(500)}, ${s(516)}) scale(1.3)">
      ${pages}

      <!-- Front cover -->
      <rect x="${s(-186)}" y="${s(-240)}" width="${s(340)}" height="${s(500)}"
            rx="${s(20)}" fill="${brand[300]}"/>

      <!-- Spine band, the darker left face from the logo -->
      <path d="M ${s(-186)} ${s(-220)} a ${s(20)} ${s(20)} 0 0 1 ${s(20)} ${s(-20)}
               l ${s(66)} 0 l 0 ${s(500)} l ${s(-66)} 0
               a ${s(20)} ${s(20)} 0 0 1 ${s(-20)} ${s(-20)} Z"
            fill="${brand[500]}"/>

      ${coil}

      <!-- The label rule on the cover -->
      <rect x="${s(-46)} " y="${s(-56)}" width="${s(158)}" height="${s(26)}"
            rx="${s(13)}" fill="${brand[50]}"/>
    </g>`;
}

function iconSvg(): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${SIZE}" height="${SIZE}" viewBox="0 0 ${SIZE} ${SIZE}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.4" y2="1">
        <stop offset="0%" stop-color="${neutral[0]}"/>
        <stop offset="100%" stop-color="${brand[50]}"/>
      </linearGradient>
    </defs>
    <rect width="${SIZE}" height="${SIZE}" fill="url(#bg)"/>
    ${mark()}
  </svg>`;
}

function splashSvg(background: string): string {
  const width = 1284;
  const height = 2778;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
    <rect width="${width}" height="${height}" fill="${background}"/>
    <g transform="translate(${(width - 300) / 2}, ${(height - 300) / 2}) scale(${300 / 1024})">
      ${mark()}
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
    .flatten({ background: neutral[0] })
    .png({ compressionLevel: 9 })
    .toBuffer();

  await sharp(icon).toFile(join(assets, 'icon.png'));
  await sharp(icon).toFile(join(storeDir, 'app-icon-1024.png'));

  await sharp(Buffer.from(splashSvg(neutral[0])))
    .png()
    .toFile(join(assets, 'splash.png'));

  await sharp(Buffer.from(splashSvg(neutral[950])))
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

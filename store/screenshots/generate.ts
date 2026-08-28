/**
 * Generates the App Store screenshots.
 *
 * Apple requires exactly 1320 x 2868 for the 6.9" iPhone, and rejects the
 * upload if a single pixel is off. Since 2024 that one size is all you need —
 * Apple scales it down for every smaller device.
 *
 * The app screen is laid out at iPhone 16 Pro Max logical size (440 x 956) and
 * rendered at 3x, which is exactly the device's real pixel density, so text is
 * as sharp as a device capture rather than an upscale.
 *
 * Run: pnpm --filter @climatenote/store screenshots
 */

import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { brand, lightColors, neutral } from '@climatenote/shared/theme';
import { chromium } from 'playwright';

import { SCREEN, SCREENS } from './screens';

/** Apple's required size for the 6.9" iPhone. */
const CANVAS = { width: 1320, height: 2868 };
const SCALE = 3;

/**
 * Layout of the marketing frame, in CSS pixels before the 3x scale.
 *
 * `deviceTop` is chosen so the ENTIRE 956pt screen fits between it and the
 * bottom of the canvas. Sizing the device by a fixed inset instead clipped the
 * tab bar off the bottom of every screen, which reads as a rendering bug
 * rather than as a deliberate crop.
 */
const FRAME = {
  width: CANVAS.width / SCALE, // 440
  height: CANVAS.height / SCALE, // 956
  captionTop: 58,
  deviceTop: 196,
};

function page(screen: (typeof SCREENS)[number]): string {
  // Scale so the full screen height fits below the caption. The device bleeds
  // off the bottom edge of the canvas, which is a deliberate framing choice
  // and keeps the tab bar visible.
  const deviceHeight = FRAME.height - FRAME.deviceTop;
  const deviceScale = deviceHeight / SCREEN.height;
  const deviceWidth = Math.round(SCREEN.width * deviceScale);
  const deviceInset = Math.round((FRAME.width - deviceWidth) / 2);

  return `<!doctype html>
<html><head><meta charset="utf-8"><style>
  * { margin:0; padding:0; box-sizing:border-box; }
  body { width:${FRAME.width}px; height:${FRAME.height}px; overflow:hidden;
         font-family:-apple-system,'SF Pro Display','Helvetica Neue',Helvetica,Arial,sans-serif;
         background:linear-gradient(170deg, ${brand[50]} 0%, #FFFFFF 55%, ${brand[50]} 100%); }
  .caption { position:absolute; top:${FRAME.captionTop}px; left:0; right:0; padding:0 40px;
             text-align:center; }
  .caption h1 { font-size:33px; line-height:41px; font-weight:700; letter-spacing:-0.6px;
                color:${neutral[900]}; text-wrap:balance; }
  .caption h2 { font-size:33px; line-height:41px; font-weight:700; letter-spacing:-0.6px;
                color:${brand[500]}; text-wrap:balance; }
  .device { position:absolute; top:${FRAME.deviceTop}px; left:${deviceInset}px;
            width:${deviceWidth}px; height:${deviceHeight}px;
            border-radius:44px; overflow:hidden;
            box-shadow:0 24px 60px rgba(8,42,28,0.18), 0 2px 6px rgba(8,42,28,0.10);
            border:1px solid rgba(8,42,28,0.10); background:${lightColors.background}; }
  .screen { width:${SCREEN.width}px; height:${SCREEN.height}px;
            transform:scale(${deviceScale}); transform-origin:top left; }
</style></head>
<body>
  <div class="caption">
    <h1>${screen.caption}</h1>
    ${screen.subcaption ? `<h2>${screen.subcaption}</h2>` : ''}
  </div>
  <div class="device"><div class="screen">${screen.html()}</div></div>
</body></html>`;
}

/**
 * Locates a Chromium binary.
 *
 * Returns undefined so Playwright falls back to its own managed download when
 * nothing is pre-installed. Environments that ship a browser (CI images,
 * sandboxes) often carry a different revision than the installed Playwright
 * expects, which otherwise fails with "please run npx playwright install"
 * despite a perfectly usable binary being present.
 */
function findChromium(): string | undefined {
  const root = process.env.PLAYWRIGHT_BROWSERS_PATH;
  if (!root || !existsSync(root)) return undefined;

  const candidates = readdirSync(root)
    .filter((entry) => entry.startsWith('chromium-'))
    .sort()
    .reverse()
    .map((entry) => join(root, entry, 'chrome-linux', 'chrome'));

  return candidates.find((path) => existsSync(path));
}

async function main(): Promise<void> {
  const outputDir = join(import.meta.dirname, 'generated');
  mkdirSync(outputDir, { recursive: true });

  const browser = await chromium.launch({ executablePath: findChromium() });
  const context = await browser.newContext({
    viewport: { width: FRAME.width, height: FRAME.height },
    deviceScaleFactor: SCALE,
  });
  const tab = await context.newPage();

  const written: string[] = [];

  for (const screen of SCREENS) {
    await tab.setContent(page(screen), { waitUntil: 'load' });
    const buffer = await tab.screenshot({ type: 'png' });

    const path = join(outputDir, `${screen.id}.png`);
    writeFileSync(path, buffer);
    written.push(path);
  }

  await browser.close();

  // Verify every file is exactly the size Apple demands. App Store Connect
  // rejects the upload outright if one is off, and finding that out during
  // submission is a wasted round trip.
  const { default: sharp } = await import('sharp');
  let allCorrect = true;

  for (const path of written) {
    const { width, height } = await sharp(path).metadata();
    const correct = width === CANVAS.width && height === CANVAS.height;
    if (!correct) allCorrect = false;
    console.log(`${correct ? 'ok  ' : 'BAD '} ${path.split('/').pop()} ${width}x${height}`);
  }

  if (!allCorrect) {
    console.error(`\nEvery screenshot must be exactly ${CANVAS.width}x${CANVAS.height}.`);
    process.exit(1);
  }

  console.log(`\n${written.length} screenshots at ${CANVAS.width}x${CANVAS.height} in ${outputDir}`);
}

void main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});

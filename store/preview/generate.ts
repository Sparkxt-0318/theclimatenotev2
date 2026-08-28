/**
 * Builds the interactive preview artifact.
 *
 * Embeds the SAME screen markup the App Store screenshots are rendered from
 * (store/screenshots/screens.ts), so the preview cannot drift from the
 * screenshots or from the app's design tokens — all three read one source.
 *
 * Run: pnpm --filter @climatenote/store preview
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

import { brand, neutral } from '@climatenote/shared/theme';

import { SCREEN, SCREENS } from '../screenshots/screens';

/** What each screen is for, shown beside it. */
const NOTES: Record<string, { name: string; note: string; tab?: 'read' | 'notes' | 'impact' }> = {
  '01-feed': {
    name: 'Read',
    note: 'The weekly issue leads; the archive runs beneath it. No account needed to get this far — that is deliberate, and it is what App Review checks.',
    tab: 'read',
  },
  '02-reader': {
    name: 'The article',
    note: 'Serif body at a generous line height, a collapsing header, and a hairline progress rule. On device the cover parallaxes at half scroll speed.',
  },
  '03-summary': {
    name: 'The short version',
    note: 'AI-written, labelled as such, and scored against a reading-grade target in code rather than assumed to be simple.',
  },
  '04-reflection': {
    name: 'Write your climate note',
    note: 'Three actions drawn from this specific article, each with a number attached, plus space to write your own. Every option had to quote the sentence that justifies it.',
  },
  '05-impact': {
    name: 'Impact',
    note: 'A hedged headline figure, the seven-day strip, and a breakdown by category. Every number traces to a published source.',
    tab: 'impact',
  },
  '06-notes': {
    name: 'Your notes',
    note: 'One tap to check something off. The commitments you made, and how often you have kept them.',
    tab: 'notes',
  },
};

function page(): string {
  const screens = SCREENS.map((screen) => {
    const meta = NOTES[screen.id];
    return {
      id: screen.id,
      name: meta?.name ?? screen.id,
      note: meta?.note ?? '',
      tab: meta?.tab,
      html: screen.html(),
    };
  });

  return `<title>The Climate Note Preview</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,600&family=Instrument+Sans:wght@400;500;600&display=swap">

<style>
  /* ── Tokens ──────────────────────────────────────────────────────────────
     Sampled from the app's own palette (packages/shared/src/theme/colors.ts):
     the sage is the notebook in the logo, the slate is the wordmark. Neutrals
     carry the wordmark's cool cast rather than a default grey. */
  :root {
    --sage:        ${brand[300]};
    --sage-deep:   ${brand[600]};
    --sage-darker: ${brand[700]};
    --sage-wash:   ${brand[50]};

    --ground:      ${neutral[50]};
    --panel:       ${neutral[0]};
    --ink:         ${neutral[800]};
    --ink-soft:    ${neutral[600]};
    --ink-faint:   ${neutral[500]};
    --rule:        ${neutral[200]};

    --display: 'Newsreader', Georgia, serif;
    --ui: 'Instrument Sans', system-ui, -apple-system, sans-serif;

    --shell: min(1180px, 100% - 2.5rem);
    --device-shell: linear-gradient(160deg, #cdd3d6, #9aa4a9 40%, #c6ccd0);
    --on-sage: ${neutral[0]};
  }

  /* Standard form rather than CSS nesting: the un-stamped "system" state is
     what most viewers get, and nesting support is not worth risking here. */
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --ground:    #101315;
      --panel:     #1A1E21;
      --ink:       #EDF0F1;
      --ink-soft:  #A9B3B8;
      --ink-faint: #7E888D;
      --rule:      #2B3235;
      --sage-wash: rgba(166, 196, 159, 0.10);
      --sage-deep: ${brand[300]};
      --sage-darker: ${brand[200]};
      --device-shell: linear-gradient(160deg, #4a5257, #23292c 40%, #3c4347);
      --on-sage: #0F1A0C;
    }
  }

  :root[data-theme="dark"] {
    --ground:    #101315;
    --panel:     #1A1E21;
    --ink:       #EDF0F1;
    --ink-soft:  #A9B3B8;
    --ink-faint: #7E888D;
    --rule:      #2B3235;
    --sage-wash: rgba(166, 196, 159, 0.10);
    --sage-deep: ${brand[300]};
    --sage-darker: ${brand[200]};
    --device-shell: linear-gradient(160deg, #4a5257, #23292c 40%, #3c4347);
    --on-sage: #0F1A0C;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    background: var(--ground);
    color: var(--ink);
    font-family: var(--ui);
    font-size: 16px;
    line-height: 1.55;
    -webkit-font-smoothing: antialiased;
  }

  .shell { width: var(--shell); margin: 0 auto; }

  /* ── Masthead ─────────────────────────────────────────────────────────── */
  header { padding: 3.5rem 0 2rem; }

  .mark {
    display: flex; align-items: center; gap: 0.75rem;
    font-family: var(--ui); font-size: 0.72rem; font-weight: 600;
    letter-spacing: 0.14em; text-transform: uppercase; color: var(--sage-deep);
  }
  .mark::after { content: ''; flex: 1; height: 1px; background: var(--rule); }

  h1 {
    font-family: var(--display);
    font-size: clamp(2.1rem, 6vw, 3.4rem);
    font-weight: 500;
    line-height: 1.08;
    letter-spacing: -0.02em;
    margin: 1.25rem 0 0.75rem;
    text-wrap: balance;
  }

  .standfirst {
    max-width: 54ch; margin: 0; color: var(--ink-soft); font-size: 1.05rem;
  }

  .caveat {
    margin: 1.5rem 0 0; padding: 0.85rem 1.1rem;
    border-left: 2px solid var(--sage);
    background: var(--sage-wash);
    max-width: 60ch; font-size: 0.9rem; color: var(--ink-soft);
    border-radius: 0 6px 6px 0;
  }
  .caveat strong { color: var(--ink); font-weight: 600; }

  /* ── Screen picker ────────────────────────────────────────────────────── */
  nav {
    display: flex; gap: 0.4rem; flex-wrap: wrap;
    padding: 2rem 0 1.5rem;
    border-bottom: 1px solid var(--rule);
    margin-bottom: 2.5rem;
  }

  nav button {
    font: inherit; font-size: 0.84rem; font-weight: 500;
    padding: 0.42rem 0.85rem;
    border: 1px solid var(--rule); border-radius: 999px;
    background: transparent; color: var(--ink-soft);
    cursor: pointer; transition: background 0.15s, color 0.15s, border-color 0.15s;
  }
  nav button:hover { border-color: var(--sage); color: var(--ink); }
  nav button[aria-selected="true"] {
    background: var(--sage-deep); border-color: var(--sage-deep); color: var(--panel);
  }
  nav button[aria-selected="true"] { color: var(--on-sage); }

  /* ── Stage ────────────────────────────────────────────────────────────── */
  .stage {
    display: grid;
    grid-template-columns: minmax(0, 380px) minmax(0, 1fr);
    gap: clamp(2rem, 5vw, 4.5rem);
    align-items: start;
    padding-bottom: 5rem;
  }
  @media (max-width: 860px) {
    .stage { grid-template-columns: 1fr; justify-items: center; }
    .commentary { max-width: 46ch; }
    /* The device is the point of the page; on a phone it should not sit two
       screens below a preamble. */
    .device { position: static; }
  }

  @media (max-width: 640px) {
    :root { --shell: min(1180px, 100% - 2rem); }
    header { padding: 2rem 0 1.25rem; }
    .standfirst { font-size: 0.98rem; }
    .caveat { margin-top: 1rem; padding: 0.7rem 0.9rem; font-size: 0.85rem; }
    nav { padding: 1.25rem 0 1rem; margin-bottom: 1.5rem; gap: 0.35rem; }
    nav button { font-size: 0.79rem; padding: 0.36rem 0.7rem; }
    .stage { gap: 1.75rem; }
  }

  /* The device. Its screen renders at the app's real logical size and is
     scaled down, so type and spacing keep their true proportions. */
  .device {
    position: sticky; top: 2rem;
    width: 100%; max-width: 360px;
    aspect-ratio: ${SCREEN.width} / ${SCREEN.height};
    border-radius: 44px;
    padding: 6px;
    background: var(--device-shell);
    box-shadow: 0 30px 60px -20px rgba(16, 22, 24, 0.45), 0 2px 6px rgba(16, 22, 24, 0.18);
  }
  :root[data-theme="dark"] .device { background: var(--device-shell); }

  .viewport {
    position: relative; width: 100%; height: 100%;
    border-radius: 38px; overflow: hidden; background: #fff;
  }

  .screen {
    position: absolute; inset: 0;
    width: ${SCREEN.width}px; height: ${SCREEN.height}px;
    transform-origin: top left;
    opacity: 0; visibility: hidden;
    transition: opacity 0.28s ease;
  }
  .screen[data-active="true"] { opacity: 1; visibility: visible; }

  /* The app's own tab bar is live: tapping it switches screens, which is the
     most honest interaction this preview can offer. */
  .taphit {
    position: absolute; bottom: 0; height: 84px; width: 33.333%;
    background: transparent; border: 0; cursor: pointer; z-index: 5;
  }
  .taphit:focus-visible { outline: 2px solid var(--sage-deep); outline-offset: -4px; }

  /* ── Commentary ───────────────────────────────────────────────────────── */
  .commentary h2 {
    font-family: var(--display); font-weight: 500;
    font-size: clamp(1.5rem, 3vw, 2rem); line-height: 1.15;
    letter-spacing: -0.015em; margin: 0 0 0.65rem; text-wrap: balance;
  }
  .commentary p { margin: 0 0 1.5rem; color: var(--ink-soft); max-width: 46ch; }

  .facts { border-top: 1px solid var(--rule); padding-top: 1.5rem; }
  .facts dl { display: grid; grid-template-columns: auto 1fr; gap: 0.5rem 1.25rem; margin: 0; }
  .facts dt {
    font-size: 0.72rem; font-weight: 600; letter-spacing: 0.1em;
    text-transform: uppercase; color: var(--ink-faint); padding-top: 0.15rem;
  }
  .facts dd { margin: 0; font-size: 0.92rem; color: var(--ink-soft); }
  .facts dd b { color: var(--ink); font-weight: 600; }

  footer {
    border-top: 1px solid var(--rule); padding: 2rem 0 4rem;
    font-size: 0.86rem; color: var(--ink-faint); max-width: 62ch;
  }
  footer code {
    font-family: ui-monospace, 'SF Mono', Menlo, monospace; font-size: 0.85em;
    background: var(--sage-wash); color: var(--sage-darker);
    padding: 0.12em 0.4em; border-radius: 4px;
  }

  @media (prefers-reduced-motion: reduce) {
    * { transition-duration: 0.01ms !important; }
  }
</style>

<div class="shell">
  <header>
    <div class="mark">The Climate Note &middot; iOS</div>
    <h1>Six screens, before there is a build.</h1>
    <p class="standfirst">
      The app's real screens, rendered from the same design tokens it compiles —
      so the type, spacing and colour here are the app's, not an impression of them.
    </p>
    <p class="caveat">
      <strong>This is a rendering, not the running app.</strong> No scrolling
      physics, no haptics, no live data. It is here so you can judge layout and
      colour today; the real thing needs a build.
    </p>
  </header>

  <nav role="tablist" aria-label="App screens">
    ${screens
      .map(
        (screen, index) =>
          `<button role="tab" data-target="${screen.id}" aria-selected="${index === 0}">${screen.name}</button>`,
      )
      .join('\n    ')}
  </nav>

  <div class="stage">
    <div class="device">
      <div class="viewport" id="viewport">
        ${screens
          .map(
            (screen, index) =>
              `<div class="screen" id="${screen.id}" data-active="${index === 0}">${screen.html}</div>`,
          )
          .join('\n        ')}
        <button class="taphit" style="left: 0"        data-tab="read"   aria-label="Read tab"></button>
        <button class="taphit" style="left: 33.333%"  data-tab="notes"  aria-label="Notes tab"></button>
        <button class="taphit" style="left: 66.666%"  data-tab="impact" aria-label="Impact tab"></button>
      </div>
    </div>

    <div class="commentary">
      <h2 id="screen-name">${screens[0]?.name ?? ''}</h2>
      <p id="screen-note">${screens[0]?.note ?? ''}</p>

      <div class="facts">
        <dl>
          <dt>Reading</dt>
          <dd>Free, no account. Signing in only saves what you commit to.</dd>
          <dt>Sign-in</dt>
          <dd>Native Apple and Google sheets — <b>the app never opens Safari</b>, which is what the last submission was rejected for.</dd>
          <dt>Numbers</dt>
          <dd>From published sources with stated assumptions. Where a figure cannot be defended, the app shows none.</dd>
          <dt>Palette</dt>
          <dd>Sage <b>${brand[300]}</b> from the notebook, slate <b>${neutral[700]}</b> from the wordmark.</dd>
        </dl>
      </div>
    </div>
  </div>

  <footer>
    Tap the tab bar inside the phone, or the buttons above. To run the real app
    on sample data with no backend: <code>EXPO_PUBLIC_DEMO=1 npx expo run:ios</code>
  </footer>
</div>

<script>
  (function () {
    var screens = ${JSON.stringify(
      screens.map((screen) => ({ id: screen.id, name: screen.name, note: screen.note, tab: screen.tab })),
    )};

    var viewport = document.getElementById('viewport');
    var nameEl = document.getElementById('screen-name');
    var noteEl = document.getElementById('screen-note');
    var tabs = Array.prototype.slice.call(document.querySelectorAll('nav button'));

    /* The screen is authored at the app's logical size and scaled to whatever
       width the device ends up, so proportions survive any viewport. */
    function fit() {
      var scale = viewport.clientWidth / ${SCREEN.width};
      Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (el) {
        el.style.transform = 'scale(' + scale + ')';
      });
    }

    function show(id) {
      var meta = screens.filter(function (s) { return s.id === id; })[0];
      if (!meta) return;

      Array.prototype.forEach.call(document.querySelectorAll('.screen'), function (el) {
        el.setAttribute('data-active', String(el.id === id));
      });
      tabs.forEach(function (tab) {
        tab.setAttribute('aria-selected', String(tab.getAttribute('data-target') === id));
      });

      nameEl.textContent = meta.name;
      noteEl.textContent = meta.note;
    }

    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () { show(tab.getAttribute('data-target')); });
    });

    /* The in-device tab bar works, so the phone behaves like the phone. */
    Array.prototype.forEach.call(document.querySelectorAll('.taphit'), function (hit) {
      hit.addEventListener('click', function () {
        var wanted = hit.getAttribute('data-tab');
        var match = screens.filter(function (s) { return s.tab === wanted; })[0];
        if (match) show(match.id);
      });
    });

    window.addEventListener('resize', fit);
    fit();
  })();
</script>
`;
}

const outputDir = join(import.meta.dirname, 'generated');
mkdirSync(outputDir, { recursive: true });
const target = join(outputDir, 'preview.html');
writeFileSync(target, page());
console.log(`Wrote ${target}`);

/**
 * The six app screens, rendered as HTML for the App Store screenshots.
 *
 * Built from the SAME design tokens the app imports, so the spacing, type ramp
 * and colours are correct by construction rather than by eye. If the brand
 * green changes, these change with it.
 *
 * These are faithful renderings of screens the app really has. They are not a
 * simulator capture — this build environment has no Xcode — so before
 * submitting, compare each against the running app on a device and regenerate
 * if anything has drifted.
 */

import {
  articleTextStyles,
  brand,
  calendarScaleLight,
  chartSeriesLight,
  lightColors as c,
  radius,
  spacing,
  textStyles,
} from '@climatenote/shared/theme';

import { ISSUE } from './content';

const SERIF = "'Iowan Old Style', Georgia, 'Times New Roman', serif";
const UI = "-apple-system, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif";

/** iPhone 16 Pro Max logical size. Rendered at 3x for the 1320x2868 asset. */
export const SCREEN = { width: 440, height: 956 };

const t = (token: keyof typeof textStyles) => {
  const s = textStyles[token];
  return `font-size:${s.fontSize}px;line-height:${s.lineHeight}px;letter-spacing:${s.letterSpacing}px;font-weight:${s.fontWeight};`;
};

const a = (token: keyof typeof articleTextStyles) => {
  const s = articleTextStyles[token];
  return `font-size:${s.fontSize}px;line-height:${s.lineHeight}px;letter-spacing:${s.letterSpacing}px;font-weight:${s.fontWeight};`;
};

/** The iOS status bar, so the screen reads as a real device capture. */
function statusBar(): string {
  return `
  <div style="height:54px;display:flex;align-items:flex-end;justify-content:space-between;
              padding:0 32px 8px;font-family:${UI};font-size:15px;font-weight:600;color:${c.textPrimary}">
    <span>9:41</span>
    <span style="display:flex;gap:6px;align-items:center">
      <svg width="18" height="12" viewBox="0 0 18 12" fill="${c.textPrimary}">
        <rect x="0" y="8" width="3" height="4" rx="1"/><rect x="5" y="5.5" width="3" height="6.5" rx="1"/>
        <rect x="10" y="3" width="3" height="9" rx="1"/><rect x="15" y="0" width="3" height="12" rx="1"/>
      </svg>
      <svg width="17" height="12" viewBox="0 0 17 12" fill="${c.textPrimary}">
        <path d="M8.5 11.5 1 4a10.6 10.6 0 0 1 15 0z" opacity="0.35"/>
        <path d="M8.5 11.5 4.5 7.5a6 6 0 0 1 8 0z"/>
      </svg>
      <svg width="27" height="13" viewBox="0 0 27 13">
        <rect x="0.5" y="0.5" width="22" height="12" rx="3.5" fill="none" stroke="${c.textPrimary}" opacity="0.4"/>
        <rect x="2" y="2" width="17" height="9" rx="2" fill="${c.textPrimary}"/>
        <path d="M24 4.5v4a2.4 2.4 0 0 0 0-4z" fill="${c.textPrimary}" opacity="0.4"/>
      </svg>
    </span>
  </div>`;
}

/** The three-tab bar, with one tab active. */
function tabBar(active: 'read' | 'notes' | 'impact'): string {
  const tab = (key: 'read' | 'notes' | 'impact', label: string, icon: string) => {
    const on = key === active;
    const color = on ? c.brand : c.textTertiary;
    return `
      <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:5px">
        ${icon.replaceAll('CURRENT', color)}
        <span style="font-family:${UI};font-size:11px;font-weight:500;color:${color}">${label}</span>
      </div>`;
  };

  const readIcon = `<div style="width:26px;height:26px;display:flex;flex-direction:column;justify-content:center;gap:4px">
      <div style="height:2.2px;border-radius:2px;background:CURRENT;width:26px"></div>
      <div style="height:2.2px;border-radius:2px;background:CURRENT;width:20px"></div>
      <div style="height:2.2px;border-radius:2px;background:CURRENT;width:24px"></div></div>`;

  const notesIcon = `<div style="width:22px;height:22px;border-radius:7px;border:2.2px solid CURRENT;
      display:flex;align-items:center;justify-content:center">
      <div style="width:10px;height:5px;border-left:2.2px solid CURRENT;border-bottom:2.2px solid CURRENT;
                  transform:rotate(-45deg);margin-top:-2px"></div></div>`;

  const impactIcon = `<div style="width:24px;height:22px;display:flex;align-items:flex-end;gap:3px">
      <div style="width:5px;height:8px;border-radius:2px;background:CURRENT"></div>
      <div style="width:5px;height:14px;border-radius:2px;background:CURRENT"></div>
      <div style="width:5px;height:20px;border-radius:2px;background:CURRENT"></div></div>`;

  return `
  <div style="position:absolute;bottom:0;left:0;right:0;height:84px;padding-top:10px;
              background:${c.background};border-top:0.5px solid ${c.border};display:flex">
    ${tab('read', 'Read', readIcon)}
    ${tab('notes', 'Notes', notesIcon)}
    ${tab('impact', 'Impact', impactIcon)}
  </div>`;
}

/**
 * A placeholder for the cover photograph.
 *
 * A gradient rather than a stock image: the real cover is chosen per issue by
 * the pipeline from licence-clear sources, and shipping someone else's
 * photograph inside an App Store screenshot would need its own clearance.
 */
function coverArt(height: number): string {
  return `
  <div style="height:${height}px;position:relative;overflow:hidden;
              background:linear-gradient(160deg, ${brand[700]} 0%, ${brand[500]} 45%, ${brand[300]} 100%)">
    <div style="position:absolute;inset:0;opacity:0.22;
                background:radial-gradient(circle at 25% 30%, #fff 0%, transparent 45%),
                           radial-gradient(circle at 78% 68%, #fff 0%, transparent 40%)"></div>
    <svg viewBox="0 0 440 340" style="position:absolute;bottom:-2px;left:0;width:100%;opacity:0.30">
      <path d="M0 250 Q 70 200 140 232 T 290 214 T 440 244 L440 340 L0 340 Z" fill="#fff" opacity="0.30"/>
      <path d="M0 285 Q 90 248 180 272 T 330 258 T 440 282 L440 340 L0 340 Z" fill="#fff" opacity="0.35"/>
    </svg>
  </div>`;
}

function shell(inner: string): string {
  return `<div style="width:${SCREEN.width}px;height:${SCREEN.height}px;position:relative;overflow:hidden;
                      background:${c.background};font-family:${UI};color:${c.textPrimary}">${inner}</div>`;
}

// ── 1. The feed ─────────────────────────────────────────────────────────────

export function feedScreen(): string {
  const archive = [
    { date: '17 Aug', min: 5, title: 'The quiet return of the ozone hole' },
    { date: '10 Aug', min: 7, title: 'Who actually pays for a heatwave' },
    { date: '3 Aug', min: 6, title: 'Your phone has a water footprint' },
  ];

  return shell(`
    ${statusBar()}
    <div style="padding:16px ${spacing.xl}px 0">
      <div style="${a('articleTitle')}font-family:${SERIF}">The Climate Note</div>
      <div style="${t('subheadline')}color:${c.textSecondary};margin-top:2px">This week</div>
    </div>

    <div style="padding:20px ${spacing.xl}px 0">
      <div style="border-radius:${radius.xl}px;overflow:hidden">${coverArt(250)}</div>
      <div style="padding-top:16px">
        <div style="display:flex;gap:12px;align-items:center">
          <span style="${t('overline')}color:${c.brand}">ISSUE ${ISSUE.number}</span>
          <span style="${t('caption')}color:${c.textTertiary}">${ISSUE.minutes} min read</span>
        </div>
        <div style="${a('articleH2')}font-family:${SERIF};margin-top:8px">${ISSUE.title}</div>
        <div style="${t('callout')}font-family:${SERIF};color:${c.textSecondary};margin-top:8px">${ISSUE.dek}</div>
      </div>
    </div>

    <div style="${t('overline')}color:${c.textTertiary};padding:30px ${spacing.xl}px 10px">EARLIER ISSUES</div>
    ${archive
      .map(
        (item) => `
      <div style="display:flex;align-items:center;gap:16px;padding:14px ${spacing.xl}px">
        <div style="flex:1">
          <div style="${t('caption')}color:${c.textTertiary}">${item.date} · ${item.min} min</div>
          <div style="${t('title3')}font-family:${SERIF};margin-top:3px">${item.title}</div>
        </div>
        <div style="width:70px;height:70px;border-radius:${radius.md}px;overflow:hidden">${coverArt(70)}</div>
      </div>`,
      )
      .join('')}
    ${tabBar('read')}`);
}

// ── 2. The reader ───────────────────────────────────────────────────────────

export function readerScreen(): string {
  return shell(`
    <div style="position:absolute;top:0;left:0;right:0;height:2px;background:${c.brand};width:38%"></div>
    ${coverArt(300)}
    <div style="position:absolute;top:60px;left:20px;width:36px;height:36px;border-radius:18px;
                background:rgba(0,0,0,0.35);display:flex;align-items:center;justify-content:center">
      <div style="width:10px;height:10px;border-left:2px solid #fff;border-bottom:2px solid #fff;
                  transform:rotate(45deg);margin-left:3px"></div>
    </div>

    <div style="padding:24px ${spacing.xxl}px 0">
      <div style="${t('overline')}color:${c.brand}">ISSUE ${ISSUE.number}</div>
      <div style="${a('articleTitle')}font-family:${SERIF};margin-top:10px">${ISSUE.title}</div>
      <div style="${a('articleDek')}font-family:${SERIF};color:${c.textSecondary};margin-top:12px">${ISSUE.dek}</div>
      <div style="${t('footnote')}color:${c.textTertiary};margin-top:12px">${ISSUE.date} · ${ISSUE.minutes} min read</div>

      <div style="${a('articleBody')}font-family:${SERIF};margin-top:26px">
        Cattle farming is the single largest agricultural source of methane, a gas
        that traps roughly 80 times more heat than carbon dioxide over its first
        twenty years in the atmosphere.
      </div>
      <div style="${a('articleBody')}font-family:${SERIF};margin-top:20px">
        The scale is easy to miss from a supermarket aisle.
      </div>
    </div>`);
}

// ── 3. The summary ──────────────────────────────────────────────────────────

export function summaryScreen(): string {
  const bullets = [
    'Swapping beef for chicken cuts a meal’s footprint by about 90%.',
    'Countries are starting to price farm emissions the way they price fuel.',
    'Eating what you already bought beats almost any shopping change.',
  ];

  return shell(`
    ${statusBar()}
    <div style="padding:20px ${spacing.xxl}px 0">
      <div style="${a('articleBody')}font-family:${SERIF};color:${c.textSecondary}">
        …delivers most of the available benefit.
      </div>
    </div>

    <div style="margin:28px ${spacing.xl}px 0;padding:${spacing.xxl}px;
                border-radius:${radius.xl}px;background:${c.brandSubtle}">
      <div style="${t('overline')}color:${c.brand}">THE SHORT VERSION</div>

      <div style="margin-top:20px">
        <div style="${t('footnote')}color:${c.brand};font-weight:600;letter-spacing:0.4px">WHAT IS GOING WRONG</div>
        <div style="${t('callout')}font-family:${SERIF};margin-top:6px">
          Cows burp methane, a gas that heats the planet much faster than carbon
          dioxide does. Raising them also takes up more than three quarters of all
          farmland while producing less than a fifth of our food.
        </div>
      </div>

      <div style="margin-top:20px">
        <div style="${t('footnote')}color:${c.brand};font-weight:600;letter-spacing:0.4px">WHY IT MATTERS</div>
        <div style="${t('callout')}font-family:${SERIF};margin-top:6px">
          Land used for cattle is land not growing food or holding carbon in
          forests. Methane also acts fast, so cutting it now slows warming within
          our lifetimes rather than the next century.
        </div>
      </div>

      <div style="margin-top:20px">
        <div style="${t('footnote')}color:${c.brand};font-weight:600;letter-spacing:0.4px">WHAT CAN BE DONE</div>
        ${bullets
          .map(
            (bullet) => `
          <div style="display:flex;gap:12px;margin-top:10px">
            <div style="width:5px;height:5px;border-radius:3px;background:${c.brand};margin-top:9px;flex:none"></div>
            <div style="${t('callout')}font-family:${SERIF}">${bullet}</div>
          </div>`,
          )
          .join('')}
      </div>

      <div style="${t('caption2')}color:${c.textTertiary};margin-top:20px">
        Summarised by AI from the article above, and checked by an editor before
        publishing. The article itself is written by a person.
      </div>
    </div>

    <div style="padding:34px ${spacing.xl}px 0">
      <div style="${a('articleH2')}font-family:${SERIF}">Write your climate note!</div>
      <div style="${t('callout')}font-family:${SERIF};color:${c.textSecondary};margin-top:8px">
        Pick one thing to try this week. Small and specific beats big and vague.
      </div>
      <div style="margin-top:16px;border-radius:${radius.lg}px;padding:${spacing.lg}px;
                  border:1px solid ${c.border};background:${c.surface};display:flex;gap:12px">
        <div style="width:22px;height:22px;border-radius:11px;flex:none;margin-top:2px;
                    border:2px solid ${c.borderStrong}"></div>
        <div style="flex:1">
          <div style="${t('headline')}">Swap two beef meals for beans this week</div>
        </div>
      </div>
    </div>`);
}

// ── 4. The reflection options ───────────────────────────────────────────────

export function reflectionScreen(): string {
  const options = [
    {
      title: 'Swap two beef meals for beans this week',
      detail: 'Beef is about 99 kg of CO₂e per kilogram against under two for beans — the single biggest lever in your week.',
      impact: 'Roughly 19.6 kg CO₂e over a week',
      selected: true,
    },
    {
      title: 'Finish leftovers on three nights',
      detail: 'Every wasted meal also wastes the land and water behind it.',
      impact: 'Roughly 2.5 kg CO₂e over a week',
      selected: false,
    },
    {
      title: 'Choose oat milk for a week of coffees',
      detail: 'Dairy carries a share of the same land and methane cost the article describes.',
      impact: 'Roughly 2.3 kg CO₂e over a week',
      selected: false,
    },
  ];

  const radio = (on: boolean) => `
    <div style="width:22px;height:22px;border-radius:11px;flex:none;margin-top:2px;
                border:2px solid ${on ? c.brand : c.borderStrong};
                display:flex;align-items:center;justify-content:center">
      ${on ? `<div style="width:10px;height:10px;border-radius:5px;background:${c.brand}"></div>` : ''}
    </div>`;

  return shell(`
    ${statusBar()}
    <div style="padding:18px ${spacing.xl}px 0">
      <div style="${a('articleH2')}font-family:${SERIF}">Write your climate note!</div>
      <div style="${t('callout')}font-family:${SERIF};color:${c.textSecondary};margin-top:8px">
        Pick one thing to try this week. Small and specific beats big and vague.
      </div>
    </div>

    <div style="padding:20px ${spacing.xl}px 0;display:flex;flex-direction:column;gap:12px">
      ${options
        .map(
          (option) => `
        <div style="border-radius:${radius.lg}px;padding:${spacing.lg}px;display:flex;gap:12px;
                    border:1px solid ${option.selected ? c.brand : c.border};
                    background:${option.selected ? c.brandSubtle : c.surface}">
          ${radio(option.selected)}
          <div style="flex:1">
            <div style="${t('headline')}">${option.title}</div>
            <div style="${t('subheadline')}color:${c.textSecondary};margin-top:4px">${option.detail}</div>
            <div style="${t('caption')}color:${c.textTertiary};margin-top:6px">${option.impact}</div>
          </div>
        </div>`,
        )
        .join('')}

      <div style="border-radius:${radius.lg}px;padding:${spacing.lg}px;display:flex;gap:12px;
                  border:1px solid ${c.border};background:${c.surface}">
        ${radio(false)}
        <div style="flex:1">
          <div style="${t('headline')}">Write my own</div>
          <div style="${t('subheadline')}color:${c.textSecondary};margin-top:4px">
            Something else this article made you want to do.
          </div>
        </div>
      </div>

      <div style="margin-top:8px;height:50px;border-radius:${radius.lg}px;background:${c.brand};
                  display:flex;align-items:center;justify-content:center;
                  ${t('headline')}color:${c.textOnBrand}">Save my note</div>

      <div style="margin-top:24px;padding-top:20px;border-top:0.5px solid ${c.border}">
        <div style="${t('overline')}color:${c.textTertiary}">ALSO PUBLISHED ON</div>
        <div style="display:flex;gap:8px;margin-top:12px">
          ${['Instagram', 'Substack', 'Medium']
            .map(
              (platform) => `<div style="border:1px solid ${c.border};border-radius:999px;
                 padding:8px 16px;${t('footnote')}color:${c.brand}">${platform}</div>`,
            )
            .join('')}
        </div>
      </div>
    </div>`);
}

// ── 5. Impact ───────────────────────────────────────────────────────────────

export function impactScreen(): string {
  const days = [
    { letter: 'M', date: 18, level: 4 },
    { letter: 'T', date: 19, level: 3 },
    { letter: 'W', date: 20, level: 4 },
    { letter: 'T', date: 21, level: 2 },
    { letter: 'F', date: 22, level: 4 },
    { letter: 'S', date: 23, level: 0 },
    { letter: 'S', date: 24, level: 3 },
  ];

  const categories = [
    { label: 'Food', value: '34 kg', width: 100, color: chartSeriesLight[0] },
    { label: 'Getting around', value: '9 kg', width: 27, color: chartSeriesLight[1] },
    { label: 'Waste', value: '4 kg', width: 12, color: chartSeriesLight[2] },
  ];

  return shell(`
    ${statusBar()}
    <div style="padding:16px ${spacing.xl}px 0">
      <div style="${a('articleTitle')}font-family:${SERIF}">Your impact</div>
    </div>

    <div style="margin:20px ${spacing.xl}px 0;padding:${spacing.xxl}px;
                border-radius:${radius.xl}px;background:${c.brandSubtle}">
      <div style="${t('overline')}color:${c.brand}">SAVED SO FAR</div>
      <div style="font-size:38px;line-height:44px;font-weight:700;color:${c.brand};margin-top:6px">about 47 kg</div>
      <div style="${t('subheadline')}color:${c.textSecondary};margin-top:4px">
        CO₂e across 23 actions — about 276 km not driven
      </div>
    </div>

    <div style="padding:30px ${spacing.xl}px 0">
      <div style="display:flex;justify-content:space-between;align-items:baseline">
        <div style="${t('title3')}">This week</div>
        <div style="${t('subheadline')}color:${c.brand}">5 day streak</div>
      </div>

      <div style="display:flex;justify-content:space-between;margin-top:16px">
        ${days
          .map(
            (day) => `
          <div style="display:flex;flex-direction:column;align-items:center;gap:8px;flex:1">
            <div style="${t('caption2')}color:${c.textTertiary}">${day.letter}</div>
            <div style="width:40px;height:40px;border-radius:${radius.md}px;
                        background:${calendarScaleLight[day.level]};
                        ${day.date === 24 ? `border:2px solid ${c.brand};` : ''}
                        display:flex;align-items:center;justify-content:center;
                        ${t('footnote')}color:${day.level >= 3 ? c.background : c.textSecondary}">${day.date}</div>
          </div>`,
          )
          .join('')}
      </div>

      <div style="display:flex;align-items:center;gap:4px;justify-content:flex-end;margin-top:12px">
        <span style="${t('caption2')}color:${c.textTertiary}">Less</span>
        ${calendarScaleLight
          .map((color) => `<div style="width:12px;height:12px;border-radius:3px;background:${color}"></div>`)
          .join('')}
        <span style="${t('caption2')}color:${c.textTertiary}">More</span>
      </div>
    </div>

    <div style="padding:30px ${spacing.xl}px 0">
      <div style="${t('title3')}">Where it came from</div>
      <div style="margin-top:16px;display:flex;flex-direction:column;gap:16px">
        ${categories
          .map(
            (category) => `
          <div>
            <div style="display:flex;justify-content:space-between">
              <span style="${t('subheadline')}">${category.label}</span>
              <span style="${t('footnote')}color:${c.textTertiary}">${category.value}</span>
            </div>
            <div style="height:8px;border-radius:4px;background:${c.surfaceSunken};margin-top:8px;overflow:hidden">
              <div style="height:8px;border-radius:4px;width:${category.width}%;background:${category.color}"></div>
            </div>
          </div>`,
          )
          .join('')}
      </div>
    </div>
    ${tabBar('impact')}`);
}

// ── 6. Notes ────────────────────────────────────────────────────────────────

export function notesScreen(): string {
  const notes = [
    { title: 'Swap two beef meals for beans this week', from: 'The cows in the room', done: true, times: 5 },
    { title: 'Walk the short trip to school on three days', from: 'Who actually pays for a heatwave', done: true, times: 3 },
    { title: 'Refill a bottle instead of buying one', from: 'Your phone has a water footprint', done: false, times: 8 },
    { title: 'Finish leftovers on three nights', from: 'The cows in the room', done: false, times: 1 },
    { title: 'Take the bus twice instead of a lift', from: 'Who actually pays for a heatwave', done: true, times: 4 },
    { title: 'Air-dry one wash instead of tumble drying', from: 'The quiet return of the ozone hole', done: false, times: 2 },
  ];

  return shell(`
    ${statusBar()}
    <div style="padding:16px ${spacing.xl}px 0">
      <div style="${a('articleTitle')}font-family:${SERIF}">Your notes</div>
      <div style="${t('subheadline')}color:${c.textSecondary};margin-top:2px">
        Tap to check something off for today.
      </div>
    </div>

    <div style="padding:20px ${spacing.xl}px 0;display:flex;flex-direction:column;gap:12px">
      ${notes
        .map(
          (note) => `
        <div style="border-radius:${radius.lg}px;padding:${spacing.lg}px;display:flex;gap:16px;
                    border:1px solid ${note.done ? c.brand : c.border};
                    background:${note.done ? c.brandSubtle : c.surface}">
          <div style="width:26px;height:26px;border-radius:13px;flex:none;margin-top:2px;
                      border:2px solid ${note.done ? c.brand : c.borderStrong};
                      background:${note.done ? c.brand : 'transparent'};
                      display:flex;align-items:center;justify-content:center">
            ${
              note.done
                ? `<div style="width:11px;height:6px;border-left:2px solid ${c.textOnBrand};
                     border-bottom:2px solid ${c.textOnBrand};transform:rotate(-45deg);margin-top:-3px"></div>`
                : ''
            }
          </div>
          <div style="flex:1">
            <div style="${t('headline')}">${note.title}</div>
            <div style="${t('footnote')}color:${c.textTertiary};margin-top:4px">From “${note.from}”</div>
            <div style="${t('caption')}color:${c.brand};margin-top:4px">Done ${note.times} times</div>
          </div>
        </div>`,
        )
        .join('')}
    </div>
    ${tabBar('notes')}`);
}

export const SCREENS = [
  {
    id: '01-feed',
    caption: 'One story a week.',
    subcaption: 'Worth six minutes.',
    html: feedScreen,
  },
  {
    id: '02-reader',
    caption: 'Written for people,',
    subcaption: 'not committees.',
    html: readerScreen,
  },
  {
    id: '03-summary',
    caption: 'The short version,',
    subcaption: 'in plain English.',
    html: summaryScreen,
  },
  {
    id: '04-reflection',
    caption: 'Then one real thing',
    subcaption: 'you can actually do.',
    html: reflectionScreen,
  },
  {
    id: '05-impact',
    caption: 'Watch it add up.',
    subcaption: 'With honest numbers.',
    html: impactScreen,
  },
  {
    id: '06-notes',
    caption: 'Check things off.',
    subcaption: 'Build the streak.',
    html: notesScreen,
  },
];

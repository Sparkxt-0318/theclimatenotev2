/**
 * The content shown in the App Store screenshots.
 *
 * Written out here rather than pulled from the live database so the screenshots
 * are reproducible and do not change when an issue is republished. The article
 * text is representative of a real Climate Note issue.
 *
 * Apple requires screenshots to accurately represent the app. Everything shown
 * is UI the app actually renders, with the same components, spacing and colours
 * — nothing is promised here that the app does not do.
 */

export type Screenshot = {
  id: string;
  /** The marketing line above the device. Keep it short; it is read at a glance. */
  caption: string;
  subcaption?: string;
  screen: string;
};

export const ISSUE = {
  number: 14,
  title: 'The cows in the room',
  dek: 'Livestock takes up most of the world’s farmland and returns a fraction of its food. That gap is the story.',
  date: '24 August 2026',
  minutes: 6,
};

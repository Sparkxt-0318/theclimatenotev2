/** Spacing, radii, elevation and motion. */

/** 4pt grid. Use the token, not the number, so rhythm stays consistent. */
export const spacing = {
  xxs: 2,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  xxxl: 32,
  huge: 48,
  giant: 64,
} as const;

/** Horizontal page margin. Article text uses the wider one for comfort. */
export const gutter = { screen: 20, article: 24 } as const;

export const radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  pill: 999,
} as const;

export const hairline = 0.5;

/**
 * Shadows are soft and low-contrast — a card should read as slightly lifted,
 * not as a floating box with a drop shadow.
 */
export const shadow = {
  card: {
    shadowColor: '#000000',
    shadowOpacity: 0.06,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
    elevation: 2,
  },
  sheet: {
    shadowColor: '#000000',
    shadowOpacity: 0.12,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 12 },
    elevation: 8,
  },
} as const;

/**
 * Motion.
 *
 * Everything is spring-based rather than duration-based. A spring keeps its
 * momentum when a gesture interrupts it, which is the specific quality that
 * makes iOS feel responsive rather than animated — a timing curve restarts and
 * feels like the interface is arguing with you.
 */
export const spring = {
  /** Default for layout and screen transitions. */
  default: { damping: 20, stiffness: 180, mass: 1 },
  /** Snappier — chips, toggles, check-offs. */
  snappy: { damping: 22, stiffness: 320, mass: 0.8 },
  /** Softer, for larger travelling surfaces like sheets. */
  gentle: { damping: 26, stiffness: 120, mass: 1 },
} as const;

/** Reserved for opacity and colour cross-fades, where a spring is overkill. */
export const duration = { fast: 120, normal: 220, slow: 360 } as const;

/** Scale applied while a card or button is held down. */
export const pressScale = 0.97;

/** Height of the collapsing article header, before and after collapse. */
export const articleHeader = { expanded: 320, collapsed: 96 } as const;

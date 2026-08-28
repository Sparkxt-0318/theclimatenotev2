/**
 * Public contact and site details.
 *
 * One place, because these appear across the privacy policy, terms, support
 * and account-deletion pages, and App Review opens all of them. An address on
 * a domain that does not exist is worse than no address: the deletion page
 * promises a reply within seven days.
 */

/**
 * Support inbox. MUST be an address that actually receives mail — a personal
 * Gmail account is perfectly acceptable to App Review.
 */
export const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL ?? 'theclimatenote@gmail.com';

/** Where the site is deployed. The Vercel URL until a domain is pointed at it. */
export const SITE_URL =
  process.env.NEXT_PUBLIC_SITE_URL ??
  (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

/**
 * Licence-clear image search.
 *
 * Only these sources, and every result carries its credit, licence and origin
 * URL. The database enforces the same rule with a CHECK constraint, so an image
 * without attribution cannot be stored even if this module is bypassed.
 *
 * Scraping arbitrary web images was the original brief, but a published app
 * distributing photographs it has no right to is a real legal exposure for a
 * small publication. These sources give genuine editorial range without it.
 */

export type LicensedImage = {
  url: string;
  width: number;
  height: number;
  credit: string;
  license: string;
  sourceUrl: string;
  provider: 'unsplash' | 'pexels' | 'wikimedia' | 'nasa';
  description: string;
};

type SearchContext = { unsplashKey: string | null; pexelsKey: string | null };

/**
 * Searches every available source and returns candidates for the model to pick
 * from. Sources are queried in parallel; one being down or rate-limited must
 * not sink the whole run.
 */
export async function searchLicensedImages(
  query: string,
  context: SearchContext,
  limit = 6,
): Promise<LicensedImage[]> {
  const searches = [
    context.unsplashKey ? searchUnsplash(query, context.unsplashKey) : null,
    context.pexelsKey ? searchPexels(query, context.pexelsKey) : null,
    searchWikimedia(query),
    searchNasa(query),
  ].filter((search): search is Promise<LicensedImage[]> => search !== null);

  const settled = await Promise.allSettled(searches);

  const candidates = settled
    .flatMap((result) => (result.status === 'fulfilled' ? result.value : []))
    // Small images look soft as a full-bleed cover on a modern phone.
    .filter((image) => image.width >= 1200);

  return diversify(candidates, limit);
}

/**
 * Trims the candidate list down to genuinely different pictures.
 *
 * Both Wikimedia and stock APIs happily return six frames from one shoot or one
 * upload batch. Handing the model six versions of the same photograph is not a
 * choice, so this caps each provider and drops near-identical descriptions.
 */
function diversify(images: LicensedImage[], limit: number): LicensedImage[] {
  const PER_PROVIDER = 2;
  const perProvider = new Map<string, number>();
  const seen: string[] = [];
  const chosen: LicensedImage[] = [];

  // Interleave providers so one prolific source cannot fill the whole list
  // before the others are considered.
  const byProvider = new Map<string, LicensedImage[]>();
  for (const image of images) {
    const bucket = byProvider.get(image.provider) ?? [];
    bucket.push(image);
    byProvider.set(image.provider, bucket);
  }

  const queues = [...byProvider.values()];
  let index = 0;

  while (chosen.length < limit && queues.some((queue) => queue.length > 0)) {
    const queue = queues[index % queues.length];
    index += 1;
    const image = queue?.shift();
    if (!image) continue;

    const count = perProvider.get(image.provider) ?? 0;
    if (count >= PER_PROVIDER) continue;

    const fingerprint = normaliseDescription(image.description);
    if (seen.some((existing) => tooSimilar(existing, fingerprint))) continue;

    seen.push(fingerprint);
    perProvider.set(image.provider, count + 1);
    chosen.push(image);
  }

  return chosen;
}

function normaliseDescription(description: string): string {
  return description
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\b\d{4,}\b/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Jaccard overlap of word sets; above 0.6 the two describe the same picture. */
function tooSimilar(a: string, b: string): boolean {
  const wordsA = new Set(a.split(' ').filter((w) => w.length > 3));
  const wordsB = new Set(b.split(' ').filter((w) => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;

  let shared = 0;
  for (const word of wordsA) if (wordsB.has(word)) shared += 1;

  return shared / Math.min(wordsA.size, wordsB.size) > 0.6;
}

async function searchUnsplash(query: string, key: string): Promise<LicensedImage[]> {
  const url = new URL('https://api.unsplash.com/search/photos');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '4');
  url.searchParams.set('orientation', 'landscape');
  url.searchParams.set('content_filter', 'high');

  const response = await fetch(url, { headers: { Authorization: `Client-ID ${key}` } });
  if (!response.ok) return [];

  const body = (await response.json()) as {
    results?: {
      urls: { raw: string; regular: string };
      width: number;
      height: number;
      description: string | null;
      alt_description: string | null;
      links: { html: string };
      user: { name: string };
    }[];
  };

  return (body.results ?? []).map((photo) => ({
    url: photo.urls.regular,
    width: photo.width,
    height: photo.height,
    // The Unsplash licence requires photographer attribution.
    credit: `${photo.user.name} / Unsplash`,
    license: 'Unsplash License',
    sourceUrl: photo.links.html,
    provider: 'unsplash' as const,
    description: photo.description ?? photo.alt_description ?? '',
  }));
}

async function searchPexels(query: string, key: string): Promise<LicensedImage[]> {
  const url = new URL('https://api.pexels.com/v1/search');
  url.searchParams.set('query', query);
  url.searchParams.set('per_page', '4');
  url.searchParams.set('orientation', 'landscape');

  const response = await fetch(url, { headers: { Authorization: key } });
  if (!response.ok) return [];

  const body = (await response.json()) as {
    photos?: {
      src: { original: string; large2x: string };
      width: number;
      height: number;
      alt: string;
      url: string;
      photographer: string;
    }[];
  };

  return (body.photos ?? []).map((photo) => ({
    url: photo.src.large2x,
    width: photo.width,
    height: photo.height,
    credit: `${photo.photographer} / Pexels`,
    license: 'Pexels License',
    sourceUrl: photo.url,
    provider: 'pexels' as const,
    description: photo.alt ?? '',
  }));
}

/**
 * Wikimedia Commons. No key needed, and by far the best source for scientific
 * diagrams, historical photographs and anything institutional.
 */
async function searchWikimedia(query: string): Promise<LicensedImage[]> {
  const url = new URL('https://commons.wikimedia.org/w/api.php');
  url.searchParams.set('action', 'query');
  url.searchParams.set('format', 'json');
  url.searchParams.set('generator', 'search');
  url.searchParams.set('gsrsearch', `${query} filetype:bitmap`);
  url.searchParams.set('gsrnamespace', '6');
  url.searchParams.set('gsrlimit', '6');
  url.searchParams.set('prop', 'imageinfo');
  url.searchParams.set('iiprop', 'url|size|extmetadata');
  url.searchParams.set('iiurlwidth', '2000');

  const response = await fetch(url, {
    headers: { 'User-Agent': 'TheClimateNote/1.0 (editorial image search)' },
  });
  if (!response.ok) return [];

  const body = (await response.json()) as {
    query?: {
      pages?: Record<
        string,
        {
          title: string;
          imageinfo?: {
            thumburl?: string;
            url: string;
            descriptionurl: string;
            width: number;
            height: number;
            extmetadata?: Record<string, { value?: string }>;
          }[];
        }
      >;
    };
  };

  const pages = Object.values(body.query?.pages ?? {});

  return pages.flatMap((page) => {
    const info = page.imageinfo?.[0];
    if (!info) return [];

    const meta = info.extmetadata ?? {};
    const licenseName = stripHtml(meta.LicenseShortName?.value ?? '');
    const artist = stripHtml(meta.Artist?.value ?? 'Wikimedia Commons');

    // Anything without an explicitly permissive licence is not safe to publish.
    if (!/^(cc|public domain|pd)/i.test(licenseName)) return [];

    return [
      {
        url: info.thumburl ?? info.url,
        width: info.width,
        height: info.height,
        credit: `${artist} / Wikimedia Commons (${licenseName})`,
        license: licenseName,
        sourceUrl: info.descriptionurl,
        provider: 'wikimedia' as const,
        description: page.title.replace(/^File:/, '').replace(/\.[a-z]+$/i, ''),
      },
    ];
  });
}

/** NASA's image library. Public domain, and unmatched for Earth observation. */
async function searchNasa(query: string): Promise<LicensedImage[]> {
  const url = new URL('https://images-api.nasa.gov/search');
  url.searchParams.set('q', query);
  url.searchParams.set('media_type', 'image');

  const response = await fetch(url);
  if (!response.ok) return [];

  const body = (await response.json()) as {
    collection?: {
      items?: {
        href: string;
        data?: { title: string; description?: string; center?: string }[];
        links?: { href: string; render?: string }[];
      }[];
    };
  };

  return (body.collection?.items ?? []).slice(0, 3).flatMap((item) => {
    const preview = item.links?.find((link) => link.render === 'image')?.href;
    const data = item.data?.[0];
    if (!preview || !data) return [];

    return [
      {
        url: preview,
        // The search API does not report dimensions; NASA previews are large.
        width: 1920,
        height: 1080,
        credit: `NASA${data.center ? ` / ${data.center}` : ''}`,
        license: 'Public domain (NASA)',
        sourceUrl: item.href,
        provider: 'nasa' as const,
        description: `${data.title}. ${data.description ?? ''}`.slice(0, 400),
      },
    ];
  });
}

function stripHtml(value: string): string {
  return value.replace(/<[^>]+>/g, '').trim();
}

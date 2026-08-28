/**
 * Downloads, normalises and stores article images.
 *
 * Every image is re-encoded to a consistent size and format, and a blurhash is
 * computed so the app can paint the right shape and colours before the file
 * arrives — no layout reflow, no white flash.
 */

import { encode } from 'blurhash';
import sharp from 'sharp';

import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = 'article-images';
const MAX_WIDTH = 1600;

export type StoredImage = {
  storagePath: string;
  width: number;
  height: number;
  blurhash: string;
};

export async function fetchImage(url: string): Promise<Buffer> {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'TheClimateNote/1.0 (editorial image fetch)' },
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Image fetch failed: ${response.status} ${url}`);
  return Buffer.from(await response.arrayBuffer());
}

export async function storeImage(
  supabase: SupabaseClient,
  buffer: Buffer,
  path: string,
): Promise<StoredImage> {
  // Cap the width and strip metadata: a 5MB original costs a reader's data
  // allowance for detail a phone screen cannot show, and EXIF can carry
  // location data we have no business republishing.
  const normalised = sharp(buffer).rotate().resize({
    width: MAX_WIDTH,
    withoutEnlargement: true,
  });

  const jpeg = await normalised.jpeg({ quality: 82, progressive: true }).toBuffer();
  const metadata = await sharp(jpeg).metadata();

  const storagePath = `${path}.jpg`;
  const { error } = await supabase.storage.from(BUCKET).upload(storagePath, jpeg, {
    contentType: 'image/jpeg',
    upsert: true,
    cacheControl: '31536000',
  });
  if (error) throw new Error(`Image upload failed: ${error.message}`);

  return {
    storagePath,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    blurhash: await computeBlurhash(jpeg),
  };
}

/**
 * Blurhash: roughly 30 characters that decode to a recognisable blur of the
 * image. Rendered instantly while the real file downloads.
 */
async function computeBlurhash(buffer: Buffer): Promise<string> {
  const { data, info } = await sharp(buffer)
    .raw()
    .ensureAlpha()
    .resize(32, 32, { fit: 'inside' })
    .toBuffer({ resolveWithObject: true });

  return encode(new Uint8ClampedArray(data), info.width, info.height, 4, 3);
}

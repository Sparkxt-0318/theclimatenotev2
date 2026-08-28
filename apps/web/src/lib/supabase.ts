/**
 * Supabase clients for the web app.
 *
 * Three of them, deliberately separated:
 *  - `publicClient`  reads published content with the anon key. RLS does the
 *                    protecting, so this is safe to use for anything public.
 *  - `serverClient`  carries the visitor's cookie session, for the admin console.
 *  - `adminClient`   uses the service role key and BYPASSES RLS. Server-only,
 *                    and every call site must have already checked the caller
 *                    is an admin.
 */

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '';

export function publicClient() {
  return createClient(url, anonKey, { auth: { persistSession: false } });
}

export async function serverClient() {
  const cookieStore = await cookies();

  return createServerClient(url, anonKey, {
    cookies: {
      getAll: () => cookieStore.getAll(),
      setAll: (toSet) => {
        try {
          for (const { name, value, options } of toSet) cookieStore.set(name, value, options);
        } catch {
          // Called from a Server Component, where cookies are read-only. The
          // middleware refreshes the session instead, so this is safe to ignore.
        }
      },
    },
  });
}

/**
 * Service-role client. Bypasses row-level security entirely.
 *
 * Never import this into anything that runs in a browser, and never call it
 * without having established that the caller is an admin — see requireAdmin().
 */
export function adminClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set');
  return createClient(url, serviceKey, { auth: { persistSession: false } });
}

export function imageUrl(storagePath: string): string {
  return `${url}/storage/v1/object/public/article-images/${storagePath}`;
}

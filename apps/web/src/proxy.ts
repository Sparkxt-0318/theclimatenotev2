/**
 * Refreshes the Supabase session cookie on each request.
 *
 * Named `proxy` rather than `middleware`: Next.js 16 renamed the convention and
 * the old name is deprecated.
 *
 * Server Components cannot write cookies, so without this an editor's session
 * would expire mid-session and the console would start redirecting to sign-in
 * for no visible reason.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function proxy(request: NextRequest) {
  const response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll: (toSet) => {
          for (const { name, value, options } of toSet) response.cookies.set(name, value, options);
        },
      },
    },
  );

  // Touching getUser() is what performs the refresh.
  await supabase.auth.getUser();
  return response;
}

export const config = {
  // Only the admin console has sessions; running this on public pages would
  // add a round trip to every cached article view for nothing.
  matcher: ['/admin/:path*'],
};

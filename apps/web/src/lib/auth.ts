/**
 * Admin access control for the console.
 *
 * The check is the profile's role in the database, not a claim in a token the
 * client could influence. Every admin route calls requireAdmin() before doing
 * anything, and it redirects rather than returning a flag, so forgetting to
 * branch on the result cannot silently expose the page.
 */

import { redirect } from 'next/navigation';

import { serverClient } from './supabase';

export type AdminSession = { userId: string; email: string };

export async function requireAdmin(): Promise<AdminSession> {
  const supabase = await serverClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/admin/sign-in');

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .maybeSingle();

  if (profile?.role !== 'admin') redirect('/admin/sign-in?denied=1');

  return { userId: user.id, email: user.email ?? '' };
}

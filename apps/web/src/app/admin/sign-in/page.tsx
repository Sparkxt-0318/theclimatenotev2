import type { Metadata } from 'next';

import { SignInForm } from './form';

export const metadata: Metadata = { title: 'Editor sign-in' };

/**
 * Admin sign-in.
 *
 * Email and password, deliberately separate from the app's native Apple/Google
 * flow: this is a browser console for a handful of editors, and a magic link or
 * password here has no bearing on the mobile app's App Store compliance.
 */
export default async function AdminSignInPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  const { denied } = await searchParams;

  return (
    <div className="container" style={{ maxWidth: 420 }}>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: 28 }}>Editor sign-in</h1>

      {denied ? (
        <p className="small" style={{ color: '#b4553c' }}>
          That account is not an editor. Ask an existing editor to grant access.
        </p>
      ) : null}

      <SignInForm />
    </div>
  );
}

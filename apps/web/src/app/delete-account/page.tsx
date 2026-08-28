import type { Metadata } from 'next';

import { SUPPORT_EMAIL } from '@/lib/site';

export const metadata: Metadata = { title: 'Delete your account' };

/**
 * A web route for account deletion.
 *
 * The in-app path is what guideline 5.1.1(v) actually requires, and it exists.
 * This page is here for someone who has deleted the app but still wants their
 * data gone — a reasonable thing to want, and an easy thing to make possible.
 */
export default function DeleteAccountPage() {
  return (
    <div className="container prose">
      <h1 style={{ fontSize: 36 }}>Delete your account</h1>

      <h2>In the app (instant)</h2>
      <p>
        Open The Climate Note, go to <strong>Settings</strong>, and tap{' '}
        <strong>Delete my account</strong>. Confirm, and everything is removed
        immediately: your account, every note you have written, and your whole
        impact history. If you signed in with Apple, we also revoke that
        connection so the app no longer appears in your Apple ID settings.
      </p>

      <h2>If you have already deleted the app</h2>
      <p>
        Email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}?subject=Delete%20my%20account`}>
          {SUPPORT_EMAIL}
        </a>{' '}
        from the address you signed up with, and we will delete it within seven
        days and confirm when it is done.
      </p>

      <h2>What gets deleted</h2>
      <ul>
        <li>Your account and email address</li>
        <li>Every climate note you have written</li>
        <li>Every action you have checked off, and all your impact history</li>
        <li>Your sign-in connection to Apple or Google</li>
      </ul>
      <p>
        None of it is archived, anonymised and kept, or retained in backups
        beyond our normal 30-day backup rotation, after which it is gone
        entirely.
      </p>
    </div>
  );
}

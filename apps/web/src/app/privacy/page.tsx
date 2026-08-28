import type { Metadata } from 'next';

import { SUPPORT_EMAIL } from '@/lib/site';

export const metadata: Metadata = { title: 'Privacy policy' };

/**
 * Privacy policy.
 *
 * App Review requires a reachable privacy policy URL, and guideline 5.1.1(i)
 * rejections for a thin or missing one are common. It must also match the App
 * Privacy answers in App Store Connect exactly — if you change what the app
 * collects, change both.
 */
export default function PrivacyPage() {
  return (
    <div className="container prose">
      <h1 style={{ fontSize: 36 }}>Privacy policy</h1>
      <p className="small">Last updated: 28 August 2026</p>

      <p>
        The Climate Note is read mostly by people under 18, so this policy is
        written to be understood rather than to protect us. If anything here is
        unclear, ask and we will explain it.
      </p>

      <h2>What we collect</h2>
      <p>
        <strong>If you never sign in:</strong> nothing that identifies you. You
        can read every issue without an account. We do not use advertising
        identifiers and we do not track you across other apps or websites.
      </p>
      <p>
        <strong>If you create an account:</strong> your email address, and your
        name if Apple or Google shares it with us. That is what your account is
        attached to.
      </p>
      <p>
        <strong>What you write:</strong> the climate notes you save, which
        actions you check off, and the dates you checked them off on. This is
        the data that makes your impact page work.
      </p>

      <h2>What we do not collect</h2>
      <ul>
        <li>Your location</li>
        <li>Your contacts, photos, or anything else on your device</li>
        <li>Advertising or cross-app tracking identifiers</li>
        <li>Payment details — the app is free and has nothing to buy</li>
      </ul>

      <h2>Who can see your notes</h2>
      <p>
        Only you. Notes and completions are protected at the database level by
        rules that check the request is yours. This is not a policy promise
        about what we choose to look at — administrators have no access to that
        data at all, so there is nothing to abuse.
      </p>

      <h2>Who we share data with</h2>
      <p>We do not sell your data or share it for advertising. We use:</p>
      <ul>
        <li>
          <strong>Supabase</strong> — hosts the database and your account.
        </li>
        <li>
          <strong>Apple and Google</strong> — only to sign you in. They tell us
          your email address; we do not tell them anything about you.
        </li>
        <li>
          <strong>OpenAI</strong> — processes each published article to write the
          summary and the reflection prompts. Your personal data is never sent.
        </li>
      </ul>

      <h2>Deleting everything</h2>
      <p>
        Open the app, go to Settings, and tap <strong>Delete my account</strong>.
        Your account, your notes and your whole history are removed from our
        servers immediately. If you signed in with Apple, we also revoke that
        connection. There is no waiting period and nothing is kept in the
        background. You can also{' '}
        <a href="/delete-account">request deletion from this website</a>.
      </p>

      <h2>Young people</h2>
      <p>
        The app is rated 4+ and does not knowingly collect data from children
        under 13 beyond an email address used solely for sign-in. There is no
        social feed and nothing you write is visible to other people. If you are
        a parent or guardian and want an account removed, email us and we will do
        it.
      </p>

      <h2>Changes</h2>
      <p>
        If we change what we collect, we will update this page and the date at
        the top before the change takes effect.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </div>
  );
}

import type { Metadata } from 'next';

import { SUPPORT_EMAIL } from '@/lib/site';

export const metadata: Metadata = { title: 'Terms of use' };

export default function TermsPage() {
  return (
    <div className="container prose">
      <h1 style={{ fontSize: 36 }}>Terms of use</h1>
      <p className="small">Last updated: 28 August 2026</p>

      <h2>What this is</h2>
      <p>
        The Climate Note is a free weekly newsletter and app. There is nothing to
        buy, no subscription and no advertising.
      </p>

      <h2>Your account</h2>
      <p>
        You need to be 13 or older to create an account. Keep your sign-in
        secure. You can delete your account at any time from Settings in the app,
        which removes everything.
      </p>

      <h2>What you write</h2>
      <p>
        The notes you write stay yours. They are private to your account and we
        do not publish, share or sell them. You can delete them at any time.
      </p>

      <h2>Our writing</h2>
      <p>
        Articles are written by our team and remain our copyright. Quote us, link
        to us, share with friends — but please do not republish whole issues as
        your own.
      </p>

      <h2>About the numbers</h2>
      <p>
        The impact figures are estimates based on published averages, listed with
        their sources on our methodology page. They are there to give you a sense
        of scale, not to measure your life precisely. Do not use them for
        anything that requires real accounting.
      </p>

      <h2>What we do not promise</h2>
      <p>
        We work to keep the app running and the writing accurate, but it is
        provided as-is. We are a small publication, not a utility, and we cannot
        promise the service will always be available or error-free.
      </p>

      <h2>Contact</h2>
      <p>
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>
      </p>
    </div>
  );
}

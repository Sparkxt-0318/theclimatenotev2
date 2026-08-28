import type { Metadata } from 'next';

import { SUPPORT_EMAIL } from '@/lib/site';

export const metadata: Metadata = { title: 'Support' };

/** App Review requires a reachable support URL with a real way to get help. */
export default function SupportPage() {
  return (
    <div className="container prose">
      <h1 style={{ fontSize: 36 }}>Support</h1>

      <p>
        Something broken, confusing, or wrong? Email{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a> and
        a person will reply, usually within a couple of days.
      </p>

      <h2>Common questions</h2>

      <h3>Do I need an account to read?</h3>
      <p>
        No. Every issue is free to read with no account at all. Signing in only
        adds the ability to save the actions you commit to and track them.
      </p>

      <h3>How do I delete my account?</h3>
      <p>
        In the app: Settings → Delete my account. It removes your account, your
        notes and your history straight away. You can also{' '}
        <a href="/delete-account">request it here</a>.
      </p>

      <h3>Where do the impact numbers come from?</h3>
      <p>
        Published averages from sources including Poore &amp; Nemecek (2018), the
        UK government conversion factors and the US EPA. Every figure is listed
        with its source and assumptions in the app under Settings → How we
        calculate impact. They are estimates with real uncertainty, and we say so
        rather than presenting them as measurements.
      </p>

      <h3>Is the writing AI-generated?</h3>
      <p>
        No. Articles are written by people. AI writes the plain-language summary
        at the end, suggests the reflection prompts, and helps choose or build
        the image — all of which is reviewed by an editor before publishing, and
        labelled in the app. The article itself is never touched by a model.
      </p>

      <h3>I found a mistake in an article.</h3>
      <p>
        Please tell us. We would much rather correct something than leave it
        wrong.
      </p>
    </div>
  );
}

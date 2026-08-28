'use client';

import { useState, useTransition } from 'react';

import { runIngestionNow } from './actions';

/**
 * "Check Drive now" — fires the pipeline without waiting for the half-hourly
 * cron. Useful when an editor has just dropped a file in and wants the draft.
 */
export function RunIngestionButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {message ? <span className="small">{message}</span> : null}
      <button
        type="button"
        className="button button--secondary"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            const result = await runIngestionNow();
            setMessage(
              result.ok
                ? 'Started. A draft should appear in a few minutes.'
                : `Could not start: ${result.error}`,
            );
          })
        }
      >
        {pending ? 'Starting…' : 'Check Drive now'}
      </button>
    </div>
  );
}

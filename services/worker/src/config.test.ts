import { strict as assert } from 'node:assert';
import { afterEach, describe, it } from 'node:test';

import { resolveProvider } from './config';

/**
 * Provider selection.
 *
 * The pipeline runs on whichever key is present, and the ingest workflow now
 * exposes AI_PROVIDER as a repository variable — so an unset variable arrives
 * as "", and a typo arrives as a word nobody validated. Both used to fall
 * through to key-presence selection, which meant an override could silently do
 * nothing at all.
 */

const KEYS = ['AI_PROVIDER', 'GEMINI_API_KEY', 'OPENAI_API_KEY'] as const;
const saved = Object.fromEntries(KEYS.map((key) => [key, process.env[key]]));

function env(values: Partial<Record<(typeof KEYS)[number], string>>): void {
  for (const key of KEYS) {
    if (values[key] === undefined) delete process.env[key];
    else process.env[key] = values[key];
  }
}

afterEach(() => {
  for (const key of KEYS) {
    const original = saved[key];
    if (original === undefined) delete process.env[key];
    else process.env[key] = original;
  }
});

describe('resolveProvider', () => {
  it('prefers Gemini when both keys are present, because its free tier costs nothing', () => {
    env({ GEMINI_API_KEY: 'g', OPENAI_API_KEY: 'o' });
    assert.equal(resolveProvider(), 'gemini');
  });

  it('falls back to OpenAI when it is the only key', () => {
    env({ OPENAI_API_KEY: 'o' });
    assert.equal(resolveProvider(), 'openai');
  });

  it('treats an empty AI_PROVIDER as unset, which is how GitHub Actions sends one', () => {
    env({ AI_PROVIDER: '', GEMINI_API_KEY: 'g' });
    assert.equal(resolveProvider(), 'gemini');
  });

  it('honours an explicit override even when the other key is also present', () => {
    env({ AI_PROVIDER: 'openai', GEMINI_API_KEY: 'g', OPENAI_API_KEY: 'o' });
    assert.equal(resolveProvider(), 'openai');
  });

  it('rejects a misspelled provider instead of quietly running the other one', () => {
    env({ AI_PROVIDER: 'gemeni', GEMINI_API_KEY: 'g' });
    assert.throws(() => resolveProvider(), /must be "gemini" or "openai"/);
  });

  it('rejects an override whose key is missing', () => {
    env({ AI_PROVIDER: 'openai', GEMINI_API_KEY: 'g' });
    assert.throws(() => resolveProvider(), /OPENAI_API_KEY is not set/);
  });

  it('names the free option first when nothing is configured', () => {
    env({});
    assert.throws(() => resolveProvider(), /GEMINI_API_KEY/);
  });
});

import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { redact } from './redact';

describe('redact', () => {
  it('hides a value whose own key looks like a secret', () => {
    assert.deepEqual(redact({ external_google_secret: 'abc', site_url: 'https://x' }), {
      external_google_secret: '«redacted»',
      site_url: 'https://x',
    });
  });

  it('hides a {name, value} secret, where the sibling is what makes it sensitive', () => {
    assert.deepEqual(
      redact([
        { name: 'APPLE_PRIVATE_KEY', value: '-----BEGIN PRIVATE KEY-----' },
        { name: 'APPLE_SERVICE_ID', value: 'com.theclimatenote.app' },
      ]),
      [
        { name: 'APPLE_PRIVATE_KEY', value: '«redacted»' },
        { name: 'APPLE_SERVICE_ID', value: 'com.theclimatenote.app' },
      ],
    );
  });

  it('reaches secrets nested inside ordinary objects', () => {
    assert.deepEqual(redact({ config: { db_password: 'hunter2' } }), {
      config: { db_password: '«redacted»' },
    });
  });

  it('catches db_pass, which is what the project-creation body actually calls it', () => {
    assert.deepEqual(redact({ name: 'the-climate-note', db_pass: 'hunter2' }), {
      name: 'the-climate-note',
      db_pass: '«redacted»',
    });
  });

  it('leaves everything that is not a secret exactly as it was', () => {
    const body = { query: 'select 1', parameters: [1, 'two', null], read_only: true };
    assert.deepEqual(redact(body), body);
  });
});

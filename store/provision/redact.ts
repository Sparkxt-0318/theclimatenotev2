/**
 * Redaction for the provisioning dry-run.
 *
 * Separate from the script itself so it can be tested without importing a
 * module whose whole purpose is to make network calls on load.
 *
 * This exists because the first version of the dry-run printed an Apple
 * private key in full. The rule looked right — redact any field whose *name*
 * looks like a secret — but the secrets endpoint takes `{name, value}` pairs,
 * where the sensitive field is blandly called "value" and its sibling is what
 * makes it sensitive.
 */

// PASS rather than PASSWORD on purpose: the project-creation body calls the
// database password `db_pass`, which the longer word does not match.
export const SECRET_SHAPED = /KEY|SECRET|PASS|TOKEN|PRIVATE/i;

const REDACTED = '«redacted»';

type Json = Record<string, unknown>;

export function redact(body: unknown): unknown {
  if (Array.isArray(body)) return body.map(redact);
  if (!body || typeof body !== 'object') return body;

  const object = body as Json;

  // The {name, value} shape, judged by the sibling.
  if (typeof object.name === 'string' && 'value' in object && SECRET_SHAPED.test(object.name)) {
    return { ...object, value: REDACTED };
  }

  return Object.fromEntries(
    Object.entries(object).map(([key, value]) => [
      key,
      SECRET_SHAPED.test(key) && typeof value === 'string' ? REDACTED : redact(value),
    ]),
  );
}

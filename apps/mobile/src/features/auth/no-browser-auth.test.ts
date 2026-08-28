import { strict as assert } from 'node:assert';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { describe, it } from 'node:test';

/**
 * The regression guard for the App Store rejection.
 *
 * ESLint already bans these imports, but lint can be skipped, disabled inline,
 * or simply not run before a build. This asserts the same thing against the
 * source on disk, so `pnpm test` catches it even if nothing else does.
 *
 * The rejection was:
 *   "the user is taken to the default web browser to sign in or register for
 *    an account, which provides a poor user experience."
 *
 * If this test fails, do not weaken it. Use the native sign-in in
 * src/features/auth/native-sign-in.ts.
 */

const MOBILE_SRC = join(import.meta.dirname, '../../..');

/** Modules that put a browser in front of the user during authentication. */
const FORBIDDEN_IMPORTS = [
  'expo-auth-session',
  'expo-web-browser',
  'react-native-app-auth',
  'react-native-inappbrowser-reborn',
];

/** Supabase calls that perform a browser redirect. */
const FORBIDDEN_CALLS = ['signInWithOAuth', 'linkIdentity'];

function sourceFiles(dir: string, found: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.expo', 'ios', 'android', 'dist'].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) {
      sourceFiles(full, found);
    } else if (['.ts', '.tsx'].includes(extname(full)) && !full.endsWith('.test.ts')) {
      found.push(full);
    }
  }
  return found;
}

describe('no browser-based authentication', () => {
  const files = sourceFiles(join(MOBILE_SRC, 'src')).concat(sourceFiles(join(MOBILE_SRC, 'app')));

  it('finds source files to check', () => {
    // Guards against the walker silently returning nothing and the suite
    // "passing" while checking zero files.
    assert.ok(files.length > 5, `only found ${files.length} source files`);
  });

  it('imports no browser-auth library', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const module of FORBIDDEN_IMPORTS) {
        const imported = new RegExp(`from\\s+['"]${module}['"]|require\\(['"]${module}['"]\\)`);
        assert.ok(
          !imported.test(source),
          `${file} imports ${module}, which opens a browser to sign in. ` +
            'That is what the App Store rejected. See src/features/auth/README.md.',
        );
      }
    }
  });

  it('never calls a Supabase redirect sign-in', () => {
    for (const file of files) {
      const source = readFileSync(file, 'utf8');
      for (const call of FORBIDDEN_CALLS) {
        // Ignore prose in comments; only flag real call sites.
        const withoutComments = source
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '');
        assert.ok(
          !new RegExp(`\\.${call}\\s*\\(`).test(withoutComments),
          `${file} calls ${call}(), which opens a browser. Use signInWithIdToken instead.`,
        );
      }
    }
  });

  it('exchanges native ID tokens with Supabase', () => {
    // The positive half: prove the approved mechanism is actually present, so
    // this suite cannot pass simply because auth was deleted.
    const signIn = readFileSync(join(MOBILE_SRC, 'src/features/auth/native-sign-in.ts'), 'utf8');
    assert.ok(signIn.includes('signInWithIdToken'), 'native sign-in no longer uses signInWithIdToken');
    assert.ok(signIn.includes("provider: 'apple'"), 'Apple sign-in is missing');
    assert.ok(signIn.includes("provider: 'google'"), 'Google sign-in is missing');
  });

  it('sends Apple the hashed nonce and Supabase the raw one', () => {
    // Reversing these is the classic Apple integration bug and produces an
    // opaque "invalid token" from Supabase.
    const signIn = readFileSync(join(MOBILE_SRC, 'src/features/auth/native-sign-in.ts'), 'utf8');
    assert.ok(/nonce:\s*hashed/.test(signIn), 'Apple must receive the hashed nonce');
    assert.ok(/nonce:\s*raw/.test(signIn), 'Supabase must receive the raw nonce');
  });
});

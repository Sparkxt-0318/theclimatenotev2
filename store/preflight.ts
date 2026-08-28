/**
 * Submission readiness gate.
 *
 * Run before every App Store submission:  pnpm preflight
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * This project had careful quality gates for colour contrast, reflection
 * specificity and row-level security, and none at all for "is this actually
 * shippable". An audit days before submission found a Settings screen that was
 * fully built but that nothing navigated to — making account deletion
 * unreachable and the submission un-passable — alongside placeholder strings
 * baked into the build, a lockfile that broke CI, and a privacy manifest that
 * contradicted the store listing.
 *
 * Every one of those was mechanically detectable. This is the check that would
 * have caught them.
 *
 * Checks marked LOCAL run anywhere. Checks marked LIVE need the environment
 * configured and are skipped (loudly) when it is not, so the gate stays useful
 * before the credentials exist.
 */

import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';

const ROOT = join(import.meta.dirname, '..');

type Result = { ok: boolean; skipped?: boolean; detail?: string };
type Check = { name: string; area: string; run: () => Result | Promise<Result> };

const pass = (detail?: string): Result => ({ ok: true, detail });
const fail = (detail: string): Result => ({ ok: false, detail });
const skip = (detail: string): Result => ({ ok: true, skipped: true, detail });

function read(path: string): string {
  return readFileSync(join(ROOT, path), 'utf8');
}

function sourceFiles(dir: string, found: string[] = []): string[] {
  if (!existsSync(dir)) return found;
  for (const entry of readdirSync(dir)) {
    if (['node_modules', '.expo', 'ios', 'android', 'dist', '.next'].includes(entry)) continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) sourceFiles(full, found);
    else if (['.ts', '.tsx'].includes(extname(full)) && !full.endsWith('.test.ts')) found.push(full);
  }
  return found;
}

// ── Checks ──────────────────────────────────────────────────────────────────

const checks: Check[] = [
  {
    area: 'Navigation',
    name: 'every registered route is reachable',
    /**
     * THE check. A route can be built, styled, tested and registered in the
     * navigator while being reachable from nowhere — which is precisely what
     * happened to Settings, taking account deletion down with it.
     *
     * Compares the routes declared in the root layout against every navigation
     * target in the source.
     */
    run: () => {
      const layout = read('apps/mobile/app/_layout.tsx');
      const registered = [...layout.matchAll(/<Stack\.Screen\s+name="([^"]+)"/g)]
        .map((match) => match[1] as string)
        // Route groups are containers, not destinations.
        .filter((name) => !name.startsWith('(') && !name.startsWith('+'));

      const source = sourceFiles(join(ROOT, 'apps/mobile/src'))
        .concat(sourceFiles(join(ROOT, 'apps/mobile/app')))
        .map((file) => readFileSync(file, 'utf8'))
        .join('\n');

      const unreachable = registered.filter((route) => {
        // A dynamic route is reached through a template literal.
        const base = route.replace(/\/\[.+\]$/, '');
        return !new RegExp(`router\\.(push|replace|navigate)\\(\\s*[\`'"]/${base}`).test(source);
      });

      return unreachable.length === 0
        ? pass(`${registered.length} routes, all reachable`)
        : fail(
            `unreachable from anywhere in the app: ${unreachable.join(', ')}. ` +
              `A registered route nothing navigates to is dead UI — if it is Settings, ` +
              `account deletion is inaccessible and review will reject (5.1.1(v)).`,
          );
    },
  },
  {
    area: 'Navigation',
    name: 'account deletion is reachable',
    run: () => {
      const settings = read('apps/mobile/app/settings.tsx');
      if (!/delete/i.test(settings)) return fail('settings.tsx has no delete-account control');

      const source = sourceFiles(join(ROOT, 'apps/mobile/src'))
        .concat(sourceFiles(join(ROOT, 'apps/mobile/app')))
        .map((file) => readFileSync(file, 'utf8'))
        .join('\n');

      return /router\.(push|replace)\(\s*['"]\/settings['"]/.test(source)
        ? pass()
        : fail('nothing navigates to /settings, so Delete My Account cannot be opened');
    },
  },
  {
    area: 'Build config',
    name: 'no placeholder strings ship in the build',
    run: () => {
      const offenders: string[] = [];
      for (const path of ['apps/mobile/app.config.ts', 'apps/mobile/eas.json']) {
        const content = read(path);
        for (const marker of ['REPLACE_WITH', 'PLACEHOLDER', 'YOUR-PROJECT', 'xxxxxxxx']) {
          // A dev-only fallback is fine; a value that can reach a release build is not.
          if (content.includes(marker) && !content.includes(`dev-${marker.toLowerCase()}`)) {
            offenders.push(`${path} contains "${marker}"`);
          }
        }
      }
      return offenders.length === 0 ? pass() : fail(offenders.join('; '));
    },
  },
  {
    area: 'Build config',
    name: 'a release build refuses to proceed without its env vars',
    run: () => {
      try {
        execFileSync('npx', ['expo', 'config', '--type', 'public'], {
          cwd: join(ROOT, 'apps/mobile'),
          env: { ...process.env, EXPO_PUBLIC_ENV: 'production', EXPO_PUBLIC_SUPABASE_URL: '' },
          stdio: 'pipe',
        });
        return fail(
          'a production config evaluated with no Supabase URL. Missing build-time ' +
            'values must fail the build, not ship a binary that crashes on launch.',
        );
      } catch {
        return pass('refuses, as it should');
      }
    },
  },
  {
    area: 'Privacy',
    name: 'privacy manifest matches the store listing',
    run: () => {
      const config = read('apps/mobile/app.config.ts');
      const listing = read('store/metadata/app-store-listing.md');

      const declaresCollection = /NSPrivacyCollectedDataType:/.test(config);
      const listingCollects = /Email address \| Yes/.test(listing);

      if (listingCollects && !declaresCollection) {
        return fail(
          'the listing declares collected data but NSPrivacyCollectedDataTypes is empty. ' +
            'A mismatch between the manifest and App Privacy is a rejection.',
        );
      }
      if (/NSPrivacyTracking:\s*true/.test(config)) {
        return fail('NSPrivacyTracking is true; the listing declares no tracking');
      }
      return pass();
    },
  },
  {
    area: 'Assets',
    name: 'app icon is 1024x1024 with no alpha channel',
    run: async () => {
      const { default: sharp } = await import('sharp');
      const path = join(ROOT, 'store/icon/generated/app-icon-1024.png');
      if (!existsSync(path)) return fail('missing; run: pnpm --filter @climatenote/store icon');

      const meta = await sharp(path).metadata();
      if (meta.width !== 1024 || meta.height !== 1024) {
        return fail(`is ${meta.width}x${meta.height}, must be 1024x1024`);
      }
      // App Store Connect rejects an icon with an alpha channel outright.
      if (meta.hasAlpha) return fail('has an alpha channel, which App Store Connect rejects');
      return pass();
    },
  },
  {
    area: 'Assets',
    name: 'screenshots are present and exactly 1320x2868',
    run: async () => {
      const { default: sharp } = await import('sharp');
      const dir = join(ROOT, 'store/screenshots/generated');
      if (!existsSync(dir)) {
        return fail('none generated; run: pnpm --filter @climatenote/store screenshots');
      }

      const files = readdirSync(dir).filter((file) => file.endsWith('.png'));
      if (files.length < 3) return fail(`only ${files.length}; Apple allows up to 10, use at least 3`);

      for (const file of files) {
        const meta = await sharp(join(dir, file)).metadata();
        if (meta.width !== 1320 || meta.height !== 2868) {
          return fail(`${file} is ${meta.width}x${meta.height}, must be 1320x2868`);
        }
      }
      return pass(`${files.length} screenshots`);
    },
  },
  {
    area: 'Auth',
    name: 'no browser-based sign-in anywhere',
    run: () => {
      const banned = ['expo-auth-session', 'expo-web-browser', 'react-native-app-auth'];
      const offenders: string[] = [];

      for (const file of sourceFiles(join(ROOT, 'apps/mobile/src')).concat(
        sourceFiles(join(ROOT, 'apps/mobile/app')),
      )) {
        const content = readFileSync(file, 'utf8');
        for (const module of banned) {
          if (new RegExp(`from\\s+['"]${module}['"]`).test(content)) {
            offenders.push(`${file} imports ${module}`);
          }
        }
        if (/\.signInWithOAuth\s*\(/.test(content)) offenders.push(`${file} calls signInWithOAuth`);
      }

      return offenders.length === 0
        ? pass()
        : fail(`${offenders.join('; ')} — this is what caused the previous rejection`);
    },
  },
  {
    area: 'Auth',
    name: 'Apple deletion can actually revoke',
    /**
     * Deleting the row without revoking the Apple token leaves the app listed
     * under Sign in with Apple, which reviewers check. Revocation needs the
     * authorization code captured at sign-in.
     */
    run: () => {
      const signIn = read('apps/mobile/src/features/auth/native-sign-in.ts');
      if (!/credential\.authorizationCode/.test(signIn)) {
        return fail(
          'sign-in does not capture Apple authorizationCode, so there is no refresh ' +
            'token to revoke and deletion cannot disconnect Sign in with Apple',
        );
      }
      if (!existsSync(join(ROOT, 'supabase/functions/apple-link/index.ts'))) {
        return fail('the apple-link function is missing; the code is captured but never exchanged');
      }
      const deleteFn = read('supabase/functions/delete-account/index.ts');
      return /apple_credentials/.test(deleteFn)
        ? pass()
        : fail('delete-account does not read the stored Apple refresh token');
    },
  },
  {
    area: 'Auth',
    name: 'nothing can block account deletion',
    /**
     * Deletion must always be possible. An earlier version refused to delete
     * when Apple revocation was impossible, which stranded users with accounts
     * they could never remove — a 5.1.1(v) violation by a different route than
     * the one it was trying to avoid.
     */
    run: () => {
      const fn = read('supabase/functions/delete-account/index.ts');

      // Everything before the auth-user delete call is the pre-flight section;
      // an early return with deleted:false in there is a blocking refusal.
      const deleteCall = fn.indexOf('deleteUser(');
      if (deleteCall === -1) return fail('the function no longer deletes the user');

      const before = fn.slice(0, deleteCall);
      const refusals = [...before.matchAll(/deleted:\s*false/g)];

      return refusals.length === 0
        ? pass('revocation is best-effort, deletion is unconditional')
        : fail(
            `${refusals.length} path(s) return deleted:false before deleting. ` +
              `Revocation must never block deletion — an account a user cannot ` +
              `delete violates 5.1.1(v) on its own.`,
          );
    },
  },
  {
    area: 'Pipeline',
    name: 'the content checksum is written only after every step succeeds',
    /**
     * The worst bug this project had. `upsertArticle` used to write
     * `source_checksum` alongside the article row, BEFORE the AI steps ran. Any
     * failure after that — a rate limit, a timeout, an image sharp could not
     * decode — left the row marked "already processed", so the skip guard
     * skipped it forever. The document sat in the review queue as a permanently
     * broken draft that no re-run would ever repair.
     */
    run: () => {
      const pipeline = read('services/worker/src/pipeline/run.ts');

      const upsertStart = pipeline.indexOf('async function upsertArticle');
      if (upsertStart === -1) return fail('upsertArticle is gone; this check needs updating');

      const upsertEnd = pipeline.indexOf('\nasync function', upsertStart + 10);
      const upsertBody = pipeline.slice(upsertStart, upsertEnd === -1 ? undefined : upsertEnd);

      if (/source_checksum/.test(upsertBody)) {
        return fail(
          'upsertArticle writes source_checksum. It must be written only after the ' +
            'AI steps succeed, or any failure marks the document processed and it is ' +
            'skipped forever.',
        );
      }
      return /update\(\{ source_checksum/.test(pipeline)
        ? pass('written at finalise')
        : fail('nothing writes source_checksum; documents would reprocess every run');
    },
  },
  {
    area: 'Build config',
    name: 'demo mode cannot reach a release build',
    /**
     * Demo mode exists so the app can be seen before any backend does. Shipping
     * it would put seeded numbers in front of real readers and show a reviewer
     * an app that never talks to a server.
     */
    run: () => {
      const easJson = read('apps/mobile/eas.json');
      const config = JSON.parse(easJson) as {
        build?: Record<string, { env?: Record<string, string> }>;
      };

      for (const profile of ['preview', 'production']) {
        if (config.build?.[profile]?.env?.EXPO_PUBLIC_DEMO === '1') {
          return fail(`the ${profile} build profile enables demo mode`);
        }
      }

      // The environment this preflight runs in must not have it on either,
      // since that is the environment a build would inherit.
      return process.env.EXPO_PUBLIC_DEMO === '1'
        ? fail('EXPO_PUBLIC_DEMO=1 is set in this environment; a build here would ship demo data')
        : pass();
    },
  },
  {
    area: 'Contact',
    name: 'support address is a real mailbox',
    run: () => {
      const site = read('apps/web/src/lib/site.ts');
      const match = /SUPPORT_EMAIL\s*=\s*[^?]*\?\?\s*'([^']+)'/.exec(site);
      if (!match?.[1]) return fail('no default support address found');

      const address = match[1];
      const domain = address.split('@')[1] ?? '';
      // theclimatenote.com does not resolve; a support address there receives
      // nothing, and App Review opens the support page.
      return domain === 'theclimatenote.com'
        ? fail(`${address} is on a domain that does not resolve, so it receives no mail`)
        : pass(address);
    },
  },
  {
    area: 'Dependencies',
    name: 'lockfile is in sync (CI and Vercel use --frozen-lockfile)',
    run: () => {
      try {
        // Runs the real thing rather than a dry run: pnpm has no --dry-run, and
        // a frozen install refuses BEFORE touching node_modules when the
        // lockfile is stale, so this is safe and it is exactly what CI does.
        // An earlier version of this check passed a flag that does not exist,
        // so it reported failure unconditionally — a gate that cries wolf gets
        // ignored, which is worse than no gate.
        execFileSync('pnpm', ['install', '--frozen-lockfile'], { cwd: ROOT, stdio: 'pipe' });
        return pass();
      } catch (error) {
        return fail(
          `frozen install fails, so CI and the Vercel build will too. ` +
            `Run: pnpm install --no-frozen-lockfile && commit the lockfile. ` +
            `(${error instanceof Error ? error.message.split('\n')[0] : 'unknown'})`,
        );
      }
    },
  },
  {
    area: 'Live URLs',
    name: 'privacy policy and support URLs resolve',
    /** App Review opens both. A dead link is a 5.1.1(i) / 1.5 rejection. */
    run: async () => {
      const site = process.env.EXPO_PUBLIC_SITE_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
      if (!site) return skip('EXPO_PUBLIC_SITE_URL not set — cannot check the live site');

      for (const path of ['/privacy', '/support']) {
        try {
          const response = await fetch(`${site}${path}`, {
            method: 'HEAD',
            signal: AbortSignal.timeout(10_000),
          });
          if (!response.ok) return fail(`${site}${path} returned ${response.status}`);
        } catch {
          return fail(`${site}${path} is unreachable`);
        }
      }
      return pass(site);
    },
  },
  {
    area: 'Content',
    name: 'the app has published articles to show',
    /** An empty app is rejected under guideline 2.1, App Completeness. */
    run: async () => {
      const url = process.env.SUPABASE_URL ?? process.env.EXPO_PUBLIC_SUPABASE_URL;
      const key = process.env.SUPABASE_ANON_KEY ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;
      if (!url || !key) return skip('Supabase not configured — cannot check for content');

      try {
        const response = await fetch(`${url}/rest/v1/published_articles?select=slug&limit=5`, {
          headers: { apikey: key, Authorization: `Bearer ${key}` },
          signal: AbortSignal.timeout(10_000),
        });
        if (!response.ok) return fail(`Supabase returned ${response.status}`);

        const rows = (await response.json()) as unknown[];
        return rows.length > 0
          ? pass(`${rows.length} published`)
          : fail(
              'no published articles. A reviewer would open the app to an empty feed, ' +
                'which is rejected under guideline 2.1 (App Completeness).',
            );
      } catch {
        return fail('could not reach Supabase');
      }
    },
  },
  {
    area: 'Submission',
    name: 'App Store Connect API key is in place',
    run: () => {
      const easJson = read('apps/mobile/eas.json');
      const keyPath = join(ROOT, 'apps/mobile/private/AuthKey.p8');

      if (!existsSync(keyPath)) {
        return skip('apps/mobile/private/AuthKey.p8 not present — needed only for `eas submit`');
      }
      return /\$ASC_API_KEY_ISSUER_ID/.test(easJson) && !process.env.ASC_API_KEY_ISSUER_ID
        ? fail('ASC_API_KEY_ISSUER_ID / ASC_API_KEY_ID are not set in the environment')
        : pass();
    },
  },
];

// ── Runner ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('\nThe Climate Note — submission preflight\n');

  let failures = 0;
  let skipped = 0;
  let area = '';

  for (const check of checks) {
    if (check.area !== area) {
      area = check.area;
      console.log(`  ${area}`);
    }

    let result: Result;
    try {
      result = await check.run();
    } catch (error) {
      result = fail(error instanceof Error ? error.message : String(error));
    }

    if (result.skipped) {
      skipped += 1;
      console.log(`    ~  ${check.name}`);
      if (result.detail) console.log(`       ${result.detail}`);
    } else if (result.ok) {
      console.log(`    ok ${check.name}${result.detail ? ` — ${result.detail}` : ''}`);
    } else {
      failures += 1;
      console.log(`    NO ${check.name}`);
      console.log(`       ${result.detail}`);
    }
  }

  console.log('');
  if (failures > 0) {
    console.log(`${failures} check(s) failed. Do not submit.\n`);
    process.exit(1);
  }
  console.log(
    skipped > 0
      ? `All checks passed, ${skipped} skipped for missing configuration.\n` +
          `Re-run with the environment set before submitting.\n`
      : 'Ready to submit.\n',
  );
}

void main();

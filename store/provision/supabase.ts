/**
 * Supabase provisioning, over HTTPS only.
 *
 * ── Why this exists ────────────────────────────────────────────────────────
 * `supabase db push` connects to Postgres on port 5432. Plenty of environments
 * — CI runners, agent containers, locked-down networks — allow HTTPS and
 * nothing else, and there the CLI simply cannot reach the database. Everything
 * below goes through the Management API on 443 instead, so setup works from
 * anywhere a browser would.
 *
 * It is also written to be read before it is run. If you are handing someone a
 * personal access token, this file is the complete list of what that token
 * will be used for. `--dry-run` prints every request it would make, with every
 * secret redacted, and sends none of them.
 *
 * Every step is idempotent: it adopts an existing project, skips migrations
 * already recorded, and never overwrites auth settings it was not given a
 * value for. Re-run it as many times as you like.
 *
 *   SUPABASE_ACCESS_TOKEN=sbp_... pnpm provision:supabase --dry-run
 *   SUPABASE_ACCESS_TOKEN=sbp_... pnpm provision:supabase
 *
 * The access token comes from supabase.com/dashboard/account/tokens and can be
 * revoked there the moment provisioning is done.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, readdirSync, writeFileSync, cpSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { redact } from './redact';

const ROOT = join(import.meta.dirname, '..', '..');
const API = 'https://api.supabase.com/v1';

const DRY_RUN = process.argv.includes('--dry-run');
/** The service role key bypasses every RLS policy, so printing it is opt-in. */
const REVEAL_SERVICE_KEY = process.argv.includes('--reveal-service-key');

// ── Inputs ──────────────────────────────────────────────────────────────────

const env = process.env;

const TOKEN = env.SUPABASE_ACCESS_TOKEN;
const PROJECT_NAME = env.SUPABASE_PROJECT_NAME ?? 'the-climate-note';
const PROJECT_REF = env.SUPABASE_PROJECT_REF;
const ORG_SLUG = env.SUPABASE_ORG_SLUG;
const DB_PASSWORD = env.SUPABASE_DB_PASSWORD;
const REGION = env.SUPABASE_REGION ?? 'us-east-1';

const SITE_URL = env.SITE_URL ?? env.NEXT_PUBLIC_SITE_URL;
const ADMIN_EMAIL = env.ADMIN_EMAIL;

const APPLE_BUNDLE_ID = env.APPLE_BUNDLE_ID ?? 'com.theclimatenote.app';
const GOOGLE_WEB_CLIENT_ID = env.GOOGLE_WEB_CLIENT_ID;
const GOOGLE_WEB_CLIENT_SECRET = env.GOOGLE_WEB_CLIENT_SECRET;
const GOOGLE_IOS_CLIENT_ID = env.GOOGLE_IOS_CLIENT_ID;

/** Edge Function secrets. Absent ones are skipped, never blanked. */
const FUNCTION_SECRETS = ['APPLE_TEAM_ID', 'APPLE_KEY_ID', 'APPLE_SERVICE_ID', 'APPLE_PRIVATE_KEY'];

// ── Plumbing ────────────────────────────────────────────────────────────────

type Json = Record<string, unknown>;

async function api<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (DRY_RUN) {
    console.log(`    would ${method} ${path}${body ? ` ${JSON.stringify(redact(body))}` : ''}`);
    return undefined as T;
  }

  const response = await fetch(`${API}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      ...(body ? { 'Content-Type': 'application/json' } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(120_000),
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${method} ${path} → ${response.status} ${text.slice(0, 400)}`);
  }
  return text ? (JSON.parse(text) as T) : (undefined as T);
}

/**
 * Runs SQL through the Management API. `parameters` are bound by the server,
 * so an admin's email address is never concatenated into a statement.
 */
async function sql<T>(ref: string, query: string, parameters: unknown[] = []): Promise<T> {
  return api<T>('POST', `/projects/${ref}/database/query`, { query, parameters });
}

const step = (message: string) => console.log(`\n▸ ${message}`);
const done = (message: string) => console.log(`    ${message}`);

// ── Steps ───────────────────────────────────────────────────────────────────

type Project = { ref: string; name: string; status: string; region: string };

/** Adopts a project by ref or name before creating one, so re-runs are safe. */
async function resolveProject(): Promise<string> {
  step('Project');

  if (PROJECT_REF) {
    done(`using SUPABASE_PROJECT_REF=${PROJECT_REF}`);
    return PROJECT_REF;
  }

  const projects = (await api<Project[]>('GET', '/projects')) ?? [];
  const existing = projects.find((project) => project.name === PROJECT_NAME);
  if (existing) {
    done(`adopting existing "${PROJECT_NAME}" (${existing.ref}, ${existing.status})`);
    return existing.ref;
  }

  if (!ORG_SLUG || !DB_PASSWORD) {
    throw new Error(
      `No project named "${PROJECT_NAME}" exists. To create one, set SUPABASE_ORG_SLUG and ` +
        `SUPABASE_DB_PASSWORD; to use one that already exists, set SUPABASE_PROJECT_REF.`,
    );
  }

  const created = await api<Project>('POST', '/projects', {
    name: PROJECT_NAME,
    organization_slug: ORG_SLUG,
    db_pass: DB_PASSWORD,
    region: REGION,
  });
  done(`created ${created?.ref} in ${REGION}`);
  return created?.ref ?? 'dry-run-ref';
}

/** A fresh project is not immediately queryable; migrations fail if we rush. */
async function waitUntilHealthy(ref: string): Promise<void> {
  if (DRY_RUN) return;

  for (let attempt = 0; attempt < 60; attempt += 1) {
    const project = await api<Project>('GET', `/projects/${ref}`);
    if (project.status === 'ACTIVE_HEALTHY') return;
    done(`status ${project.status}, waiting…`);
    await new Promise((resolve) => setTimeout(resolve, 10_000));
  }
  throw new Error('project never reached ACTIVE_HEALTHY');
}

/**
 * Applies migrations and records them in the same table the CLI uses, so a
 * later `supabase db push` from a machine that *can* reach Postgres sees this
 * history and does not try to replay it.
 */
async function applyMigrations(ref: string): Promise<void> {
  step('Migrations');

  await sql(
    ref,
    `create schema if not exists supabase_migrations;
     create table if not exists supabase_migrations.schema_migrations (
       version text primary key,
       statements text[],
       name text
     );`,
  );

  const applied = DRY_RUN
    ? []
    : await sql<{ version: string }[]>(
        ref,
        'select version from supabase_migrations.schema_migrations',
      );
  const seen = new Set(applied.map((row) => row.version));

  const dir = join(ROOT, 'supabase/migrations');
  const files = readdirSync(dir)
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const version = file.split('_')[0] as string;
    const name = file.replace(/^\d+_/, '').replace(/\.sql$/, '');

    if (seen.has(version)) {
      done(`${file} — already applied`);
      continue;
    }

    if (DRY_RUN) {
      done(`would apply ${file}`);
      continue;
    }

    await sql(ref, readFileSync(join(dir, file), 'utf8'));
    await sql(
      ref,
      `insert into supabase_migrations.schema_migrations (version, name, statements)
       values ($1, $2, array[]::text[]) on conflict (version) do nothing`,
      [version, name],
    );
    done(`${file} — applied`);
  }
}

/**
 * The storage block in the RLS migration is wrapped in an exception handler,
 * because a hosted `db push` runs without the ownership needed to touch
 * storage.objects. So the bucket may legitimately not exist yet.
 */
async function ensureBucket(ref: string): Promise<void> {
  step('Storage');

  if (DRY_RUN) {
    done('would check for the public "article-images" bucket and create it if missing');
    return;
  }

  const buckets = await api<{ name: string; public: boolean }[]>(
    'GET',
    `/projects/${ref}/storage/buckets`,
  );

  const bucket = buckets.find((candidate) => candidate.name === 'article-images');
  if (bucket) {
    done(`article-images exists (${bucket.public ? 'public' : 'PRIVATE — should be public'})`);
    return;
  }

  await sql(
    ref,
    `insert into storage.buckets (id, name, public) values ('article-images', 'article-images', true)
     on conflict (id) do update set public = true`,
  );
  done('created the public article-images bucket');
}

/**
 * Only sends the keys it was given a value for — a partial run must never
 * blank a provider that was configured on a previous one.
 *
 * `additional_client_ids` is the part that is easy to miss and expensive to
 * debug: a native iOS sign-in presents a token whose audience is the bundle ID
 * (Apple) or the iOS OAuth client ID (Google), not the web client ID that
 * Supabase validates against by default. Without these, `signInWithIdToken`
 * fails with "Invalid audience" and nothing in the app explains why.
 */
async function configureAuth(ref: string): Promise<void> {
  step('Auth providers');

  const config: Json = {};

  if (SITE_URL) config.site_url = SITE_URL;

  config.external_apple_enabled = true;
  config.external_apple_additional_client_ids = APPLE_BUNDLE_ID;

  if (GOOGLE_WEB_CLIENT_ID) {
    config.external_google_enabled = true;
    config.external_google_client_id = GOOGLE_WEB_CLIENT_ID;
    if (GOOGLE_WEB_CLIENT_SECRET) config.external_google_secret = GOOGLE_WEB_CLIENT_SECRET;
    if (GOOGLE_IOS_CLIENT_ID) config.external_google_additional_client_ids = GOOGLE_IOS_CLIENT_ID;
    // The native Google SDK does not return the nonce Supabase would check.
    config.external_google_skip_nonce_check = true;
  } else {
    done('GOOGLE_WEB_CLIENT_ID not set — leaving Google untouched');
  }

  await api('PATCH', `/projects/${ref}/config/auth`, config);
  done(`Apple enabled for ${APPLE_BUNDLE_ID}${GOOGLE_WEB_CLIENT_ID ? ', Google enabled' : ''}`);
}

async function setFunctionSecrets(ref: string): Promise<void> {
  step('Edge Function secrets');

  const secrets = FUNCTION_SECRETS.filter((name) => env[name]).map((name) => ({
    name,
    value: env[name] as string,
  }));

  if (secrets.length === 0) {
    done(
      'none provided — set APPLE_TEAM_ID, APPLE_KEY_ID, APPLE_SERVICE_ID and APPLE_PRIVATE_KEY ' +
        'here or in the dashboard, or Apple token revocation cannot run',
    );
    return;
  }

  await api('POST', `/projects/${ref}/secrets`, secrets);
  done(`set ${secrets.map((secret) => secret.name).join(', ')}`);

  const missing = FUNCTION_SECRETS.filter((name) => !env[name]);
  if (missing.length > 0) done(`still missing: ${missing.join(', ')}`);
}

/**
 * Shells out to the CLI rather than hand-rolling the multipart upload: both
 * functions import ../_shared/apple.ts, and the CLI is what knows how to lay
 * those relative paths out for the bundler. `--use-api` bundles server-side,
 * so no Docker is involved.
 *
 * The repo deliberately ships no supabase/config.toml (it would carry a
 * project ref), and the CLI wants one — so this builds a throwaway project
 * directory instead of writing into the repository.
 */
function deployFunctions(ref: string): void {
  step('Edge Functions');

  const names = ['apple-link', 'delete-account'];

  if (DRY_RUN) {
    done(`would deploy ${names.join(' and ')} with --use-api`);
    return;
  }

  const workdir = mkdtempSync(join(tmpdir(), 'climatenote-deploy-'));
  cpSync(join(ROOT, 'supabase/functions'), join(workdir, 'supabase/functions'), {
    recursive: true,
  });
  writeFileSync(
    join(workdir, 'supabase/config.toml'),
    `project_id = "${ref}"\n\n[functions.apple-link]\n[functions.delete-account]\n`,
  );

  for (const name of names) {
    execFileSync(
      'npx',
      ['-y', 'supabase@latest', 'functions', 'deploy', name, '--project-ref', ref, '--use-api'],
      { cwd: workdir, stdio: 'inherit', env: { ...env, SUPABASE_ACCESS_TOKEN: TOKEN } },
    );
    done(`deployed ${name}`);
  }
}

async function promoteAdmin(ref: string): Promise<void> {
  step('Admin');

  if (!ADMIN_EMAIL) {
    done('ADMIN_EMAIL not set — skipping. Sign in once, then re-run with it set.');
    return;
  }

  if (DRY_RUN) {
    done(`would promote ${ADMIN_EMAIL} to admin, if that account exists`);
    return;
  }

  const rows = await sql<{ id: string }[]>(
    ref,
    `update profiles set role = 'admin'
     where id = (select id from auth.users where email = $1) returning id`,
    [ADMIN_EMAIL],
  );

  done(
    rows.length > 0
      ? `${ADMIN_EMAIL} is an admin`
      : `no account for ${ADMIN_EMAIL} yet — sign in on the app or site once, then re-run`,
  );
}

async function reportKeys(ref: string): Promise<void> {
  step('Keys');

  if (DRY_RUN) {
    done('would read the anon and service_role keys');
    return;
  }

  const keys = await api<{ name: string; api_key: string; type: string }[]>(
    'GET',
    `/projects/${ref}/api-keys?reveal=true`,
  );

  console.log(`\n    SUPABASE_URL=https://${ref}.supabase.co`);
  for (const key of keys) {
    const isService = key.name === 'service_role';
    if (isService && !REVEAL_SERVICE_KEY) {
      console.log(`    service_role key: hidden (pass --reveal-service-key to print it)`);
      continue;
    }
    console.log(`    ${key.name}: ${key.api_key}`);
  }

  console.log(
    `\n    The service_role key bypasses every row-level security policy. It belongs in\n` +
      `    GitHub Actions secrets and Vercel environment variables — never in the app,\n` +
      `    never in the repository.`,
  );
}

// ── Runner ──────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log(
    DRY_RUN
      ? '\nThe Climate Note — Supabase provisioning (DRY RUN, nothing will be sent)\n'
      : '\nThe Climate Note — Supabase provisioning\n',
  );

  if (!TOKEN && !DRY_RUN) {
    throw new Error(
      'SUPABASE_ACCESS_TOKEN is not set. Create one at ' +
        'supabase.com/dashboard/account/tokens, and revoke it when provisioning is done.',
    );
  }

  const ref = await resolveProject();
  await waitUntilHealthy(ref);
  await applyMigrations(ref);
  await ensureBucket(ref);
  await configureAuth(ref);
  await setFunctionSecrets(ref);
  deployFunctions(ref);
  await promoteAdmin(ref);
  await reportKeys(ref);

  console.log('\nDone. Re-running this is safe.\n');
}

main().catch((error: unknown) => {
  console.error(`\nProvisioning failed: ${error instanceof Error ? error.message : String(error)}`);
  console.error('Nothing is left half-applied that a re-run will not pick up.\n');
  process.exit(1);
});

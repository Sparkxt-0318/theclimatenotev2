# The Climate Note

A weekly climate newsletter for readers roughly 12 to 22, as an iOS app, a
website, and the pipeline that turns a Word document into both.

```
apps/mobile        Expo / React Native iOS app
apps/web           Next.js website + admin console (Vercel)
packages/shared    design tokens, impact factors, AI schemas, quality gates
services/worker    Drive ingestion + AI pipeline (GitHub Actions cron)
supabase/          schema, row-level security, edge functions
store/             App Store metadata, icon and screenshot generation
```

## The thing to know first

A previous version of this app was rejected by App Review:

> the user is taken to the default web browser to sign in or register for an
> account, which provides a poor user experience.

**Authentication here is native SDK sign-in only.** Apple's system sheet and
Google's native account sheet hand back an ID token, which goes to Supabase over
a plain HTTPS call. No browser, no web view, no redirect.

Two automated guards stop this regressing:

- an ESLint rule that fails the build on the forbidden imports and calls
- a test that scans the source on disk, because lint can be skipped

See [`apps/mobile/src/features/auth/README.md`](apps/mobile/src/features/auth/README.md).

## How an issue becomes an article

```
Drive (.docx) → extract → summarise → imagery → reflections → DRAFT → you publish
```

The author's text is copied verbatim and never touched by a model. AI produces
four things around it, each with a way to be wrong that we check for:

| Feature | The failure mode | The guard |
|---|---|---|
| Plain-language summary | Reads like a policy brief | Flesch-Kincaid scored in code; regenerated with its own worst sentences quoted back |
| Cover image or figure | Copyright, or a chart with invented numbers | Licence-clear sources only, credit recorded; figures rendered by us and rejected unless the values appear in the article |
| Three reflection actions | Vague, or unrelated to the article | Verbatim grounding quote, code validators, and an independent grader — all three must pass |
| Impact numbers | Made up | A curated, sourced factor table. AI only maps an action onto it, and declines when unsure |

Nothing reaches a reader without passing through the admin console.

## Getting started

```bash
pnpm install
cp .env.example .env          # then fill it in — see store/SUBMISSION.md
pnpm check                    # lint, typecheck, tests
pnpm db:test                  # schema + row-level security against real Postgres
```

Running the app needs a development build, because native sign-in cannot work in
Expo Go:

```bash
pnpm --filter @climatenote/mobile build:dev
```

## Shipping it

[`store/SUBMISSION.md`](store/SUBMISSION.md) is the step-by-step, marked with
what needs your Apple/Google accounts and what is already automated.

## Tests worth knowing about

| Command | What it protects |
|---|---|
| `pnpm preflight` | **Run before every submission.** Whether the app is actually shippable |
| `pnpm test` | 112 unit tests: palette contrast and colour-blind safety, impact arithmetic, docx extraction, reflection quality gates, and the browser-auth ban |
| `pnpm db:test` | 34 assertions, each an attempted breach: anonymous reading drafts, one user reading another's notes, a forged note ID, reading someone's Apple refresh token |

The database tests count their own assertions and fail if any were skipped
rather than passed.

`pnpm preflight` exists because this project had careful gates for colour
contrast, reflection quality and row-level security, and none for "can this
ship". An audit found a fully-built Settings screen that nothing navigated to —
which made account deletion unreachable and would have failed review outright.
The gate now checks that every registered route is reachable, that no
placeholder strings ship, that the icon and screenshots are exactly the sizes
Apple demands, that the privacy manifest matches the store listing, that Apple
deletion can actually revoke, and that the app has content to show.

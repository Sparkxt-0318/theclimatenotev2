# Getting to the App Store

Everything that can be automated is. This is the part that needs you, in order.

Anything marked **you** needs your Apple, Google or Supabase account. Anything
marked **automated** is already written and runs from the repository.

---

## 0. Before anything else

Done — the logo is in. Both ramps are sampled from it:

- `brand[300]` `#A6C49F`, the notebook cover
- `neutral[700]` `#3B4347`, the wordmark slate

Each sits within 0.4 deltaE of the artwork, which is below what anyone can see.
The app icon is the notebook mark redrawn for icon use.

**If you have the exact brand hex values**, put them in
`packages/shared/src/theme/colors.ts` and run
`pnpm --filter @climatenote/shared test`. Mine were sampled from the supplied
image, so they may be a shade off. That test fails if a change drops any text
pairing below its contrast requirement, so a correction cannot silently make
text unreadable.

One thing worth knowing: the logo green is **1.9:1 against white**, where
readable body text needs 4.5:1. It is used everywhere it is decorative — fills,
the impact calendar, illustration — but links and buttons use `brand[600]`, a
darker step of the same hue. In dark mode the logo colour clears 9.7:1, so the
app uses your exact green there.

---

## 1. Supabase (~20 minutes)

**You:**

1. Create a project at supabase.com. Choose a region near your readers.
2. Project Settings → API. Copy the URL, the `anon` key and the `service_role`
   key.
3. Run the migrations. `supabase init` first — the CLI needs a
   `supabase/config.toml` before it will link, and this repo does not ship one:
   ```
   npx supabase init          # answer no to overwriting anything
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```
   If `db push` reports it skipped the storage policies, that is expected and
   harmless — the migration says why. Just confirm a public `article-images`
   bucket exists under Storage.
4. Authentication → Providers → enable **Apple** and **Google**.
5. Make yourself an admin, replacing the email:
   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

The service role key bypasses every security rule in the database. It belongs
only in GitHub Actions secrets and Vercel environment variables — never in the
app, never in the repository.

### Or let the repository do all of it

Steps 1–5 above, plus the Apple and Google provider configuration from sections
2 and 3 and both Edge Function deploys, are scripted:

```
SUPABASE_ACCESS_TOKEN=sbp_... pnpm provision:supabase --dry-run   # sends nothing
SUPABASE_ACCESS_TOKEN=sbp_... pnpm provision:supabase
```

Everything runs over HTTPS through the Management API rather than a direct
Postgres connection, so it works from anywhere — including environments where
`db push` cannot reach port 5432 at all. It adopts an existing project rather
than making a second one, skips migrations already applied, and never blanks a
setting it was not given a value for, so re-running it is safe.

`--dry-run` prints every request it would make with the secrets redacted. Read
that output before running it for real — especially if someone else is holding
the token. The token itself comes from
[supabase.com/dashboard/account/tokens](https://supabase.com/dashboard/account/tokens)
and should be revoked as soon as provisioning is done.

Inputs it reads, all optional except the token: `SUPABASE_PROJECT_REF` (or
`SUPABASE_ORG_SLUG` + `SUPABASE_DB_PASSWORD` to create one), `SITE_URL`,
`ADMIN_EMAIL`, `GOOGLE_WEB_CLIENT_ID`, `GOOGLE_WEB_CLIENT_SECRET`,
`GOOGLE_IOS_CLIENT_ID`, and the four `APPLE_*` values.

---

## 2. Google sign-in (~15 minutes)

**You** — in the Google Cloud console, create an OAuth consent screen and then
**two** client IDs:

| Type | Why |
|---|---|
| **iOS** | Identifies the app to the native SDK. Bundle ID `com.theclimatenote.app` |
| **Web** | The audience Supabase validates the token against |

Both are needed. Omitting the Web client ID is the most common cause of
"Invalid audience" from `signInWithIdToken`.

Then:
- Paste the **Web** client ID and secret into Supabase → Authentication →
  Providers → Google.
- Put both client IDs in `.env` as `EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID` and
  `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`.
- Copy the iOS client's **reversed** client ID (it looks like
  `com.googleusercontent.apps.123-abc`) into
  `EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME`.

---

## 3. Sign in with Apple (~15 minutes)

**You** — in the Apple developer portal:

1. Certificates, Identifiers & Profiles → Identifiers → register
   `com.theclimatenote.app` with **Sign in with Apple** enabled.
2. Keys → create a key with **Sign in with Apple** enabled. Download the `.p8`.
   **It downloads once and cannot be downloaded again.**
3. Note your Team ID (top right of the portal) and the Key ID.
4. Supabase → Authentication → Providers → Apple: enable it and put the **bundle
   ID** `com.theclimatenote.app` in the authorised client IDs. That is all
   Supabase needs.

   **Do not paste the `.p8` into that form.** The app signs in with
   `signInWithIdToken`, so Supabase only ever validates the token's audience —
   it never performs the web OAuth exchange that a client secret is for. The
   private key is read solely by our own Edge Function
   (`supabase/functions/_shared/apple.ts`, from `Deno.env`) to revoke the
   connection at deletion, so it belongs in Function Secrets and nowhere else.

Then set the Apple secrets and deploy BOTH functions. `apple-link` captures the
refresh token at sign-in; `delete-account` revokes it. Deploy both: deletion
itself is unconditional and never refuses, but without `apple-link` there is no
token to revoke, so the app keeps appearing under Settings → Sign-In & Security
→ Sign in with Apple after the account is gone — which is the half of guideline
5.1.1(v) reviewers actually check:

```
npx supabase secrets set APPLE_TEAM_ID=XXXXXXXXXX
npx supabase secrets set APPLE_KEY_ID=XXXXXXXXXX
npx supabase secrets set APPLE_SERVICE_ID=com.theclimatenote.app
npx supabase secrets set APPLE_PRIVATE_KEY="$(cat AuthKey_XXXXXXXXXX.p8)"

npx supabase functions deploy apple-link
npx supabase functions deploy delete-account
```

---

## 4. The article pipeline (~15 minutes)

**You:**

1. Google Cloud → IAM → Service Accounts → create one → create a JSON key.
2. Enable the Drive API for the project.
3. Share your Drive folder with the service account's email address, as
   **Viewer**. That is the entire authorisation step — no consent screen.
4. Copy the folder ID from the Drive URL:
   `drive.google.com/drive/folders/THIS_PART`
5. Create a **Gemini API key** at
   [aistudio.google.com/apikey](https://aistudio.google.com/apikey). The free
   tier needs no billing account, and one issue a week sits far inside its
   limits — this is the whole AI cost of the project.
6. Optional but recommended: free Unsplash and Pexels API keys widen the photo
   search. Wikimedia and NASA work without keys.

> **You do not need OpenAI.** The pipeline picks its provider from whichever key
> is present, preferring Gemini. If you would rather use OpenAI, set
> `OPENAI_API_KEY` instead — but note that a ChatGPT Plus subscription does not
> include API access; the API bills separately and needs its own payment method.

Then add these as **GitHub Actions secrets** (Settings → Secrets and variables →
Actions):

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_SERVICE_ACCOUNT_JSON     (the whole JSON file, pasted as one value)
GOOGLE_DRIVE_FOLDER_ID
GEMINI_API_KEY
UNSPLASH_ACCESS_KEY             (optional)
PEXELS_API_KEY                  (optional)
OPENAI_API_KEY                  (only if you chose OpenAI over Gemini)
```

**Automated, once you turn it back on** — the workflow's 30-minute schedule is
currently disabled in `.github/workflows/ingest.yml`, because every run failed
without these secrets. After setting them, uncomment the `schedule:` block the
file points to (or run it manually with the "Run workflow" button, or the admin
console's "Run now", to confirm it works first). From then on the pipeline
checks Drive every 30 minutes, drafts each new document, and waits for you in
the admin console. Nothing publishes itself.

---

## 5. The website (~10 minutes)

**You** — import the repository at vercel.com. Set the root directory to
`apps/web`, and add:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
NEXT_PUBLIC_SITE_URL            (your Vercel URL until a domain is pointed at it)
GITHUB_DISPATCH_TOKEN           (fine-grained PAT, Contents: read and write, this repo only)
GITHUB_REPOSITORY               (Sparkxt-0318/theclimatenotev2)
```

This gives you the privacy policy and support URLs App Review requires, plus
the admin console at `/admin`.

> Vercel's Hobby plan is for non-commercial use. A free newsletter is fine; if
> you start taking money, move to Pro.

---

## 6. The build (~30 minutes, mostly waiting)

**You:**

```
npm install -g eas-cli
eas login                       # create a free Expo account if needed
eas init                        # links the project and PRINTS a project ID
```

**`eas init` cannot write the project ID into this repo.** It writes to a static
`app.json`, and this project uses a dynamic `app.config.ts`. Copy the ID it
prints and set it yourself in the next step.

**Now set the build-time variables.** This step is not optional and is easy to
miss: Expo inlines `EXPO_PUBLIC_*` values into the bundle *at build time*, on
the EAS builder. Your local `.env` never gets there — it is gitignored, and EAS
uploads via git. Without these the build now fails loudly (it used to produce a
binary that crashed on launch):

```
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_URL --value "https://YOUR.supabase.co"
eas env:create --scope project --name EXPO_PUBLIC_SUPABASE_ANON_KEY --value "..."
eas env:create --scope project --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value "..."
eas env:create --scope project --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value "..."
eas env:create --scope project --name EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME --value "com.googleusercontent.apps.123-abc"
eas env:create --scope project --name EXPO_PUBLIC_SITE_URL --value "https://YOUR.vercel.app"
eas env:create --scope project --name EAS_PROJECT_ID --value "<the id eas init printed>"
```

Then build:

```
eas build --profile development --platform ios
```

EAS will offer to create the signing certificates for you. Say yes — it manages
them, and you never touch Xcode.

Install the resulting build on your iPhone and **verify the fix**:

1. Tap an article → "Write your climate note!" → an option → "Sign in to save".
2. Tap **Continue with Apple**. Watch the screen carefully.
3. Tap **Continue with Google**. Watch again.
4. Confirm the **gear button at the top right of every tab** opens Settings.

**Safari must never appear, not even for a frame.** If it does, something has
regressed — `pnpm test` should have caught it, so check that first.

Then test deletion, because reviewers do:

5. Settings → Delete my account → confirm.
6. On the phone: Settings → your name → Sign-In & Security → Sign in with Apple.
   **The Climate Note must no longer be listed.** If it is still there, the
   revocation failed — check the `apple-link` function logs first, since the
   refresh token it stores is what makes revocation possible at all.

---

## 7. Submitting

**You:**

1. App Store Connect → create the app record. Bundle ID
   `com.theclimatenote.app`, name **The Climate Note**.
2. Users and Access → Integrations → App Store Connect API → create a key.
   **App Manager** is enough for `eas submit` alone; choose **Admin** if you
   want EAS to create and manage the signing certificates for you instead of
   doing it through Xcode, which is the whole point of not needing a Mac.
   Download the `.p8` — like the Sign in with Apple key, it downloads once.
3. Put it at `apps/mobile/private/AuthKey.p8` (gitignored) and fill in the
   issuer ID and key ID in `apps/mobile/eas.json`.
4. Build and submit:
   ```
   eas build --profile production --platform ios
   eas submit --platform ios --latest
   ```
5. In App Store Connect, fill the listing from
   [`metadata/app-store-listing.md`](metadata/app-store-listing.md) — copy the
   review notes verbatim, since they pre-empt the previous rejection.
6. Upload the six screenshots from `store/screenshots/generated/`.
7. Upload `store/icon/generated/app-icon-1024.png`.
8. Submit for review.

**Before you submit, run `pnpm preflight`.** It checks the things that are
mechanically checkable: that every screen in the app is reachable (including
Settings, so account deletion is not stranded), that no placeholder strings
ship, that the icon and screenshots are exactly the sizes Apple demands, that
the privacy manifest matches this listing, that no browser-based sign-in has
crept back in, that Apple deletion can actually revoke, that the lockfile is in
sync, that your privacy and support URLs return 200, and that the app has
articles to show. It exits non-zero if anything fails.

**Automated** — the screenshots and icon regenerate any time with
`pnpm --filter @climatenote/store screenshots` and `... icon`, and both verify
their own dimensions before finishing. App Store Connect rejects the upload if a
screenshot is a single pixel off, so this checks before you find out the slow
way.

---

## What to expect

Review usually takes 24–48 hours. First submissions are looked at more closely.

If it is rejected, read the exact guideline number cited. The three most common
causes in 2026 are all already handled here:

| Guideline | The complaint | How this app answers it |
|---|---|---|
| 4.0 / 4.8 | Login opens a browser | Native SDK sign-in only. Two automated guards prevent regression. |
| 5.1.1(v) | No in-app account deletion | Settings → Delete my account, including Apple token revocation. |
| 5.1.1(i) | Missing or thin privacy policy | Hosted at `/privacy`, matching the App Privacy answers. |
| 5.1.1 | Forced registration | Every article is readable with no account. |

---

## A note on the screenshots

They are rendered from the app's real components and design tokens — the same
type ramp, spacing and colours — at exactly 1320 × 2868.

They are **not** simulator captures, because this build environment has no
Xcode. Before submitting, open the app on a device and compare. If a screen has
drifted, update `store/screenshots/screens.ts` and regenerate. Apple requires
screenshots to accurately represent the app, and that is a judgement about the
current build, not the one they were drawn from.

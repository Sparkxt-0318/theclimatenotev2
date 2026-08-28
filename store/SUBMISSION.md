# Getting to the App Store

Everything that can be automated is. This is the part that needs you, in order.

Anything marked **you** needs your Apple, Google or Supabase account. Anything
marked **automated** is already written and runs from the repository.

---

## 0. Before anything else

**You** — send the logo, or the hex code. Everything else can proceed without
it, but the icon and the palette are placeholders until it arrives, and both are
a one-file swap:

- palette → `packages/shared/src/theme/colors.ts` (the `brand` ramp)
- icon → `store/icon/generate.ts` (the `mark()` function)

After changing the palette, run `pnpm --filter @climatenote/shared test`. It
fails if any text pairing drops below its contrast requirement, so a brand
colour that would make text unreadable cannot ship silently.

---

## 1. Supabase (~20 minutes)

**You:**

1. Create a project at supabase.com. Choose a region near your readers.
2. Project Settings → API. Copy the URL, the `anon` key and the `service_role`
   key.
3. Run the migrations:
   ```
   npx supabase link --project-ref YOUR_PROJECT_REF
   npx supabase db push
   ```
4. Authentication → Providers → enable **Apple** and **Google**.
5. Make yourself an admin, replacing the email:
   ```sql
   update profiles set role = 'admin'
   where id = (select id from auth.users where email = 'you@example.com');
   ```

The service role key bypasses every security rule in the database. It belongs
only in GitHub Actions secrets and Vercel environment variables — never in the
app, never in the repository.

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
4. Configure the same values in Supabase → Authentication → Providers → Apple.

Then set the account-deletion function's secrets — this is what revokes the
Apple token, which review requires:

```
npx supabase secrets set APPLE_TEAM_ID=XXXXXXXXXX
npx supabase secrets set APPLE_KEY_ID=XXXXXXXXXX
npx supabase secrets set APPLE_SERVICE_ID=com.theclimatenote.app
npx supabase secrets set APPLE_PRIVATE_KEY="$(cat AuthKey_XXXXXXXXXX.p8)"
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
5. Create an OpenAI API key at platform.openai.com and **add a payment method**.
   A ChatGPT Plus subscription does not include API access. Around $5 covers a
   year at one issue a week.
6. Optional but recommended: free Unsplash and Pexels API keys widen the photo
   search. Wikimedia and NASA work without keys.

Then add these as **GitHub Actions secrets** (Settings → Secrets and variables →
Actions):

```
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
GOOGLE_SERVICE_ACCOUNT_JSON     (the whole JSON file, pasted as one value)
GOOGLE_DRIVE_FOLDER_ID
OPENAI_API_KEY
GEMINI_API_KEY
UNSPLASH_ACCESS_KEY
PEXELS_API_KEY
```

**Automated** — from then on the pipeline checks Drive every 30 minutes, drafts
each new document, and waits for you in the admin console. Nothing publishes
itself.

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
eas init                        # links the project, writes the project ID
eas build --profile development --platform ios
```

EAS will offer to create the signing certificates for you. Say yes — it manages
them, and you never touch Xcode.

Install the resulting build on your iPhone and **verify the fix**:

1. Tap an article → "Write your climate note!" → an option → "Sign in to save".
2. Tap **Continue with Apple**. Watch the screen carefully.
3. Tap **Continue with Google**. Watch again.

**Safari must never appear, not even for a frame.** If it does, something has
regressed — `pnpm test` should have caught it, so check that first.

Then test deletion, because reviewers do:

4. Settings → Delete my account → confirm.
5. On the phone: Settings → your name → Sign-In & Security → Sign in with Apple.
   **The Climate Note must no longer be listed.** If it is, the revocation
   failed; check the Edge Function logs.

---

## 7. Submitting

**You:**

1. App Store Connect → create the app record. Bundle ID
   `com.theclimatenote.app`, name **The Climate Note**.
2. Users and Access → Integrations → App Store Connect API → create a key with
   **App Manager** access. Download the `.p8`.
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

# Authentication

## Read this before changing anything in this folder

A previous version of this app was **rejected by the App Store** with:

> We continue to find that the user is taken to the default web browser to sign
> in or register for an account, which provides a poor user experience.

That happens when sign-in uses an OAuth **browser redirect** — `expo-auth-session`,
Supabase's `signInWithOAuth`, `react-native-app-auth`, or any hosted login page.
The user leaves the app, authenticates in Safari, and is bounced back. Apple
treats that as a broken experience, and they are right.

## What we do instead

Both providers are **native SDK sign-in**. No browser, no web view, no redirect.

```
Apple:   AppleAuthentication.signInAsync()   → native iOS sheet
Google:  GoogleSignin.signIn()               → native Google account sheet
              ↓ both return an ID token
         supabase.auth.signInWithIdToken()   → plain HTTPS API call
```

`signInWithIdToken` is a normal POST to Supabase carrying a token we already
hold. Nothing renders a browser at any point. The app never leaves the
foreground, which is exactly what the rejection asked for.

## Rules

1. **Never import** `expo-auth-session`, `expo-web-browser`, or
   `react-native-app-auth`. ESLint fails the build if you do — see
   `eslint.config.mjs`. Do not add a disable comment; use the native path.
2. **Never call** `supabase.auth.signInWithOAuth()` or `linkIdentity()`. Both
   open a browser. Also enforced by lint.
3. To link a second provider to an existing account, sign in natively with that
   provider — Supabase merges identities that share a verified email address.

## The Apple nonce

Apple sign-in uses a nonce to bind the token to this specific request. The
pairing is easy to get backwards and produces a confusing "invalid token" from
Supabase when you do:

- Generate a **random raw** nonce.
- Send its **SHA-256 hash** to Apple.
- Send the **raw** nonce to Supabase alongside the token Apple returned.

Apple embeds the hash in the token; Supabase hashes the raw nonce we give it
and checks the two match.

## Apple's name is a one-time gift

Apple returns the user's full name **only on the very first authorisation**, and
only if they choose to share it. Every later sign-in returns null. So we persist
it on first sight and never expect it again. If you test by deleting the app and
reinstalling, Apple will still consider you an existing user — revoke the app
under Settings → your name → Sign-In & Security → Sign in with Apple to get the
first-run behaviour back.

## Testing

Native sign-in cannot run in Expo Go, because Expo Go does not contain the
native Google and Apple modules. Use a development build:

```
pnpm --filter @climatenote/mobile build:dev
```

The one test that matters: **watch the screen**. If Safari opens, even for an
instant, the flow is wrong and will be rejected again.

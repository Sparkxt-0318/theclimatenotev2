# delete-account

Deletes a user's account, their notes and their whole history, and revokes
their Sign in with Apple connection.

## Why this is a function rather than a client call

App Store guideline 5.1.1(v) requires in-app account deletion. The part most
submissions miss: if the app offers Sign in with Apple, it must also **revoke
the Apple token** through Apple's REST API. Deleting the database row alone
leaves the app listed under Settings → Sign in with Apple, and reviewers check.

Revocation needs Apple credentials, which must never ship in a client binary.

## Secrets it needs

```
supabase secrets set APPLE_TEAM_ID=XXXXXXXXXX
supabase secrets set APPLE_KEY_ID=XXXXXXXXXX
supabase secrets set APPLE_SERVICE_ID=com.theclimatenote.app
supabase secrets set APPLE_PRIVATE_KEY="$(cat AuthKey_XXXXXXXXXX.p8)"
```

`APPLE_SERVICE_ID` is the app's bundle identifier for a native iOS app — not a
separate Services ID, which is only needed for web sign-in.

Get the key from the Apple developer portal: Certificates, Identifiers &
Profiles → Keys → create a key with **Sign in with Apple** enabled. The `.p8`
downloads once and cannot be downloaded again.

## Deploy

```
supabase functions deploy delete-account
```

## Verifying it before submission

Do not skip this. Reviewers do test it.

1. Create a throwaway account in the app using Sign in with Apple.
2. Settings → Delete my account → confirm.
3. Check the row is gone: `select * from auth.users where email = '…'`
4. On the device, Settings → your name → Sign-In & Security → Sign in with
   Apple. **The Climate Note must no longer be listed.** If it is, revocation
   failed silently — check the function logs.

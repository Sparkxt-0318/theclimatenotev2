# App Store Connect listing

Copy these into App Store Connect. Character limits are Apple's and are enforced
at save time.

---

## App name (30 characters max)

```
The Climate Note
```

## Subtitle (30 characters max)

```
Climate, weekly and readable
```

## Promotional text (170 max — editable without a new build)

```
A new issue every week: one climate story explained in plain English, with one specific thing you can actually do about it. Free to read, no account needed.
```

## Description (4000 max)

```
The Climate Note is a weekly climate newsletter for people who are going to have to live with the consequences.

One issue a week. No jargon, no doom, no lectures. Just a clear explanation of something that matters, written for people rather than for policy committees, and one specific thing you can do about it.

READ IN SIX MINUTES, NOT SIXTY

Every issue is written to be finished. Long enough to actually explain something, short enough to read on the bus. No account needed — open the app and start reading.

THE SHORT VERSION

At the end of every issue there is a plain-English summary: what is going wrong, why it matters, and what can be done. Written to be understood by everyone, and checked against a readability target rather than just claimed to be simple.

WRITE YOUR CLIMATE NOTE

Then the part that matters. Three specific actions drawn from that week's article — not "be more mindful", but "swap two beef meals for beans this week" — plus space to write your own. Pick one. Try it.

WATCH IT ADD UP

Check your actions off through the week and see what they come to. A calendar that turns greener as you go, a streak worth keeping, and honest numbers behind all of it.

We take the numbers seriously. Every figure comes from published research — Poore & Nemecek, the UK government conversion factors, the US EPA — listed in the app with its source and its assumptions. They are estimates and we say so. When we cannot honestly measure something you did, we log it without a number instead of inventing one.

BUILT PROPERLY

- Free. No subscription, no adverts, nothing to buy.
- Your notes are private to you. Not even our administrators can read them.
- Delete your account and everything in it from Settings, whenever you want.
- Full support for Dark Mode, Dynamic Type and VoiceOver.

The Climate Note is made by a small team who think young people deserve climate writing that respects their time and their intelligence.
```

## Keywords (100 characters max, comma-separated, no spaces)

```
climate,environment,sustainability,newsletter,carbon,eco,habits,green,footprint,students,science
```

## Support URL

```
https://theclimatenote.com/support
```

## Marketing URL

```
https://theclimatenote.com
```

## Privacy policy URL

```
https://theclimatenote.com/privacy
```

---

## What's New (for version 1.0)

```
The first issue is here. Read this week's story, pick one thing to try, and watch what it adds up to.
```

---

## Age rating

**4+.** Answer "None" to every content question.

Notes readers write are private to their own account — there is no social feed,
no comments and no user-to-user contact — so none of the user-generated-content
questions apply.

---

## App Privacy

Answer these to match the privacy policy exactly. A mismatch is a rejection.

| Data type | Collected | Linked to identity | Used for tracking | Purpose |
|---|---|---|---|---|
| Email address | Yes | Yes | No | App functionality (account) |
| Name | Yes (if the provider shares it) | Yes | No | App functionality |
| User content (the notes you write) | Yes | Yes | No | App functionality |
| User ID | Yes | Yes | No | App functionality |
| Identifiers for advertising | No | — | — | — |
| Location | No | — | — | — |
| Usage data | No | — | — | — |
| Diagnostics | No | — | — | — |

**"Do you or your third-party partners use data for tracking?"** → **No.**

---

## Export compliance

`ITSAppUsesNonExemptEncryption` is already set to `false` in `app.config.ts`, so
this question is answered automatically at upload. The app uses only standard
HTTPS, which is exempt.

---

## Review notes

Paste this into the App Review Information notes field.

```
Thank you for reviewing The Climate Note.

NO ACCOUNT IS NEEDED. Every article is fully readable without signing in. The app opens straight into content. An account is only needed to save a personal action and track it, and the sign-in sheet always offers "Not now".

ABOUT SIGN-IN — this addresses a previous rejection:
A previous submission was rejected because sign-in opened the default web browser. That has been fixed by moving to fully native authentication.

- Sign in with Apple uses ASAuthorizationController and presents Apple's native system sheet.
- Sign in with Google uses the native Google Sign-In SDK, which presents its own native account sheet.

Neither flow opens Safari, an SFSafariViewController, or any web view. The app never leaves the foreground during sign-in. The resulting identity token is exchanged with our backend over a standard HTTPS request.

To see this: open the app, tap any article, scroll to "Write your climate note!", choose an option and tap "Sign in to save".

ACCOUNT DELETION (guideline 5.1.1(v)):
Settings (top right of the Impact tab, or the gear icon) → "Delete my account". This permanently deletes the account, all saved notes and all history, and revokes the Sign in with Apple token via Apple's REST revocation endpoint.

DEMO ACCOUNT:
Not required, since all content is visible without signing in. If you would prefer one, we are happy to provide credentials.

ABOUT THE AI-ASSISTED CONTENT:
Articles are written by people. AI generates the plain-language summary and the suggested actions at the end of each article; both are reviewed by a human editor before publishing and are labelled in the app as AI-written.
```

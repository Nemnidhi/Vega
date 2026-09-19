# Chat push notifications - deploy runbook

Chat messages are delivered to a recipient's phone via Web Push, so they arrive
in the Android notification drawer whether or not the app is open.

This is the one feature in the app that will deploy "successfully" and still be
completely dead if a step here is skipped, because the public VAPID key is
inlined into the client bundle **at build time**. Read the first section before
deploying.

## Required environment variables

All three live in `.env` on the VPS (`/home/hrmsdeploy/apps/hrms/.env`). They are
not in git.

| Variable | Notes |
|---|---|
| `NEXT_PUBLIC_VAPID_PUBLIC_KEY` | Safe to expose - it ships in the client bundle. |
| `VAPID_PRIVATE_KEY` | Secret. Anyone holding it can push to every registered device. Never commit it. |
| `VAPID_CONTACT_EMAIL` | A `mailto:` contact the push services can reach. Bare address, no `mailto:` prefix. |

To generate a fresh pair:

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

**Changing the keypair invalidates every existing subscription.** Browsers bind a
subscription to the public key it was created with, so after a rotation every
user must toggle the bell off and on again. Rotate only if the private key leaks.

## Deploying

Both deploy paths (`deploy.sh` and `scripts/deploy-via-git.sh`) copy the current
`.env` forward from the previous release and then run `npm run build` on the
server. So:

1. Add the three variables to `.env` on the VPS **first**.
2. Then deploy.

Doing it the other way round produces a build with an empty public key baked in.
The bell will appear, tapping it will fail, and nothing in the deploy output will
say why. If that happens, add the vars and rebuild - a restart alone is not
enough, because the bad value is compiled into the bundle.

## Verifying a deploy

```bash
# Manifest is served and is valid JSON
curl -s https://vega.nemnidhi.com/manifest.webmanifest

# Service worker is served as JavaScript and is not cached
curl -sI https://vega.nemnidhi.com/sw.js | grep -i 'content-type\|cache-control'

# The build picked up the public key (should print a match, not nothing)
curl -s https://vega.nemnidhi.com/login | grep -o 'rel="manifest"'
```

Then on a phone: open the site in Chrome, install it via ⋮ → *Install app*, open
it from the home screen, tap the bell in the top bar and accept the permission
prompt. Send yourself a message from another account; it should appear in the
drawer within a few seconds.

An existing home-screen shortcut created before this feature shipped is only a
bookmark and will not upgrade itself - delete it and install again.

## Things that look like bugs but are not

- **No notification while the chat thread is open on that device.** Expected -
  the message is already on screen.
- **Delivery delayed by minutes when the phone is idle.** Android battery
  optimisation holds pushes for backgrounded apps. Exempting the app from
  battery optimisation in Android settings fixes it.
- **Ten messages produce one notification row.** Deliberate. Notifications are
  tagged per conversation so a fast exchange collapses instead of burying
  everything else.
- **iPhone gets nothing.** iOS only supports Web Push on 16.4+ *and* only when
  the app has been added to the home screen and is opened from there.

## Checking who is registered

Subscriptions live in the `pushsubscriptions` collection, one row per device:

```js
db.pushsubscriptions.find({}, { userId: 1, userAgent: 1, lastSuccessAt: 1 })
```

Rows are removed automatically when a push service reports the subscription is
gone (HTTP 404/410) - permission revoked, app uninstalled, or site data cleared.
Transient failures such as a 500 are kept and retried on the next message.

## Tests

```bash
PUSH_TEST_CERT_DIR=<dir with key.pem and cert.pem> \
PUSH_TEST_URI=mongodb://127.0.0.1:27017/hrms_push_test_local \
npm run test:push
```

The test runs a local TLS server standing in for the push service. It generates
its own throwaway VAPID keypair per run, so it never touches production keys, and
it drops its database when it finishes.

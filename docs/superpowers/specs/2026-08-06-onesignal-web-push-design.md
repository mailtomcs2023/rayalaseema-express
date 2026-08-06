# OneSignal Web Push Notifications — Design

**Date:** 2026-08-06
**Goal:** Convert one-time visitors into returning readers via browser push notifications. Every article push-notifies subscribers the moment it is first published.
**Provider:** OneSignal, free tier (unlimited web-push sends, up to 10k subscribers).

## Decisions

- **Trigger policy:** push on **every article's first transition to PUBLISHED** (user decision). No re-push on later edits. Breaking-news items and other content types (video, reel, cartoon…) do NOT push in v1.
- **Service-worker strategy:** merge OneSignal into the existing PWA worker (`apps/web/public/sw.js`) via `importScripts` — one worker, one root scope. Rejected alternative: separate `/push/` scope worker (two workers, scope bugs on some Android browsers).
- **Config policy:** OneSignal App ID lives in `SiteConfig` (DB key `onesignal_app_id`) so the web SDK renders nothing until the admin sets it — no hardcoded IDs (project rule). The REST API key is a server-side secret, env-only, never in DB or client code.

## Architecture

```
Reader browser                         Admin (publish paths)
──────────────                         ─────────────────────
layout.tsx                             api/content/[id] (manual publish)
  └─ <PushInit/>  (client)             api/auto-publish  (pipeline)
       │ reads /api/config             api/cron/publish-scheduled
       │ onesignal_app_id                    │  on first PUBLISHED transition
       ▼                                     ▼
  OneSignal v16 SDK  ◄────────────  sendPushForArticle(article)
  serviceWorkerPath: /sw.js          POST onesignal.com/api/v1/notifications
       ▼                             (fire-and-forget, .catch(log))
  sw.js (existing PWA worker
   + importScripts OneSignal SW)
```

## Components

### 1. `apps/web/src/components/push-init.tsx` (new, client)

- Fetches `/api/config`; if `onesignal_app_id` absent → renders nothing (feature dark until configured).
- Loads OneSignal v16 page SDK (`OneSignalSDK.page.js`) lazily after page load (no LCP impact).
- `OneSignal.init({ appId, serviceWorkerPath: "/sw.js", serviceWorkerParam: { scope: "/" } })`.
- Slidedown soft-prompt, Telugu text ("తాజా వార్తలు వెంటనే పొందండి…"), shown after 2nd pageview or 15s — OneSignal's built-in prompt config, no custom UI.
- Mounted once in `apps/web/src/app/layout.tsx` next to `DeferredFooterClients`.

### 2. `apps/web/public/sw.js` (edit, 1 line)

- `importScripts("https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.sw.js");` at top. Existing fetch/cache handlers unchanged; OneSignal handles `push` events.

### 3. `apps/admin/src/lib/push.ts` (new)

```ts
sendPushForArticle(article: { title, summary, slug, category, constituency, featuredImage })
```
- Guards: `ONESIGNAL_APP_ID` + `ONESIGNAL_REST_API_KEY` env present, article has slug; else no-op.
- POST `https://onesignal.com/api/v1/notifications`:
  - `headings`/`contents`: article title / summary (Telugu passes through as UTF-8),
  - `url`: canonical `https://rayalaseemanews.com` + `articleHref(article)` (admin has its own copy of the href logic in scripts context — reuse the same rule: constituency path, else category path),
  - `chrome_web_image`: featured image (optional),
  - `included_segments: ["Subscribed Users"]`.
- Fire-and-forget from callers: `.catch()` logs, never blocks or fails the publish response.

### 4. Publish-path hooks (3 call sites)

- `apps/admin/src/app/api/content/[id]/route.ts` — the existing first-publish detection (`data.status === "PUBLISHED" && current.status !== "PUBLISHED"`, ~line 425) additionally calls `sendPushForArticle`.
- `apps/admin/src/app/api/auto-publish/route.ts` — after each article it flips to PUBLISHED.
- `apps/admin/src/app/api/cron/publish-scheduled/route.ts` — same.
- Only `type === "ARTICLE"` pushes.

### 5. Config & secrets

- `SiteConfig` key `onesignal_app_id` — set via existing admin Settings UI (free-form config keys already supported); web reads it through the existing `/api/config` route.
- Admin env (`ecosystem.config.js` on the VM + GitHub Actions deploy secrets): `ONESIGNAL_APP_ID`, `ONESIGNAL_REST_API_KEY`.
- User creates the OneSignal account + Web app for `rayalaseemanews.com` and supplies both values out-of-band (never pasted into chat/commands — cred policy).

## Error handling

- SDK load failure / unsupported browser (iOS Safari non-PWA): OneSignal SDK no-ops; site unaffected.
- REST call failure: logged (`console.error` → PM2 logs), publish succeeds regardless.
- Missing config: both ends silently dark — deployable before the OneSignal account exists.

## Testing

1. Local: set config + env, `bun dev`, verify prompt appears, subscribe, publish draft article in admin, notification arrives with Telugu title + canonical URL opens.
2. Prod (real acceptance, per Telugu-rendering rule — validate in browser): subscribe on rayalaseemanews.com, wait for next auto-publish cycle, verify notification + click-through.
3. Regression: PWA still installable, sw.js still serves cached static assets (DevTools → Application → Service Workers shows single worker).

## Out of scope (v1)

- Per-category subscription preferences, quiet hours, frequency capping (revisit if unsubscribe rate spikes — OneSignal dashboard shows it), breaking-news content type, mobile-app (reader/reporter) push, notification analytics beyond OneSignal's built-ins.

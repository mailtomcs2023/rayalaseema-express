# Reader App Phase 2 — Home Polish, Reels, Google Login + Comments (Design Spec)

Date: 2026-08-20 · Apps: `apps/reader` (Expo 54), `apps/web` (Next.js 16 API), `packages/db` (Prisma), `apps/admin` (moderation)

Approved by owner 2026-08-20. Builds on 2026-08-17 IG redesign (shipped).

## A. Home polish

- **Logo**: stop tinting. Light mode → `assets/logo.png` (full colour), dark → `assets/logo-inverse.png` tinted white. Height 32, width auto (aspect-scaled ~160).
- **PostCard**: remove summary entirely. Headline `numberOfLines={2}`, 16/23 weight 700. Top row: avatar 28, category name 13, time 12. Icon row gains 💬 `chatbubble-outline` with count (from comments API; hide count if 0 or unloaded) between heart and share. Time moves under headline (12, textFaint). Paddings 12→10; media edge-to-edge (unchanged); hairline divider only.
- **StoriesRow**: bubble 60 (ring 62), label fontSize 10 single line; breaking max 6; categories max 8 then one "More" bubble (grid icon, `surfaceAlt` ring) → navigates to Sections tab (`router.push("/(tabs)/categories")`). Row vertical padding 6.

## B. Reels tab

### API (apps/web)
`GET /api/reels?limit=10&offset=0` → Content `type=REEL, status=PUBLISHED`, payload has `clipUrl` (skip rows whose payload lacks clipUrl — YouTube-only shorts excluded v1). Response:
```json
{ "reels": [{ "id","title","slug","clipUrl","thumbnailUrl","duration","publishedAt",
  "category": {"id","name","nameEn","slug","color"} }], "total","limit","offset" }
```
Cache-Control same as articles (s-maxage=60).

### App
- New 5th tab `reels` between index and categories: icon `play.rectangle.fill` (sf) / Ionicons `play` (android). Label i18n `tabs.reels` (te రీల్స్ / en Reels).
- Screen `app/(tabs)/reels.tsx`: full-screen vertical FlatList `pagingEnabled`, one reel per page (page height = usable height above tab bar), black bg always.
- Player: `expo-video` (`useVideoPlayer` + `VideoView`), `contentFit="cover"`, loop, **muted by default**, autoplay only for the visible page (viewability ≥60%); pause others. Tap video = mute/unmute toggle (show transient 🔇/🔊 overlay). Double-tap = like (local likes store, HeartBurst).
- Poster: `thumbnailUrl` while loading. Preload: render current ±1 pages only.
- Right rail: ❤ (likes store), 💬 (comments sheet, C), ✈ share (web `/reel/[slug]` URL), 🔖 save (bookmarks store — reels saved as Article-shaped item with slug prefix handled via existing articleUrl? No: store minimal Reel object in separate `saved-reels` list is overkill → v1: omit save on reels; rail = ❤ 💬 ✈).
- Bottom caption: title 15/21 white 2 lines, category pill small, time.
- Infinite scroll (offset pagination), pull-to-refresh top.
- Tab re-tap → scroll top + refresh. Dep: `expo-video` (expo install).

## C. Google login + comments

### DB (packages/db)
```prisma
model AppUser { id cuid; googleSub String @unique; email String?; name String;
  avatarUrl String?; blocked Boolean @default(false); createdAt; comments AppComment[] }
model AppComment { id cuid; contentId String (FK Content, Cascade); userId FK AppUser;
  parentId String? (self-FK, Cascade); body String @db.Text (max 1000 enforced in API);
  likeCount Int @default(0); hidden Boolean @default(false); createdAt;
  @@index([contentId, hidden, createdAt]) }
model AppCommentLike { commentId+userId @@id; createdAt }
model AppCommentReport { id; commentId FK; userId FK; reason String?; createdAt;
  @@unique([commentId, userId]) }
```
Existing web `Comment` untouched.

### Auth (apps/web, mobile-only routes under /api/mobile/)
- `POST /api/mobile/auth/google` `{idToken}` → verify via Google tokeninfo/`google-auth-library` against `GOOGLE_MOBILE_CLIENT_IDS` env (comma list: android + web client IDs) → upsert AppUser by googleSub → `{token, user}`. Token = JWT (HS256, `MOBILE_JWT_SECRET` env, 30d, payload {sub: appUserId}). No refresh token v1 (30d + silent re-login via Google on expiry).
- Middleware helper `getAppUser(req)` reads `Authorization: Bearer`.

### Comments API (apps/web)
- `GET /api/mobile/comments?contentId&offset&limit=20` → top-level newest-first, each with up to 3 newest replies + reply count, `likeCount`, `likedByMe` (if auth header present), user {id,name,avatarUrl}. Hidden/blocked filtered out.
- `GET /api/mobile/comments/count?contentIds=a,b,c` → `{counts: {id: n}}` (for card 💬 badges; batch ≤30).
- `POST /api/mobile/comments` auth `{contentId, body, parentId?}` → creates (body trimmed, 1..1000 chars; parent must be top-level → 1-level threading). Blocked user → 403.
- `POST /api/mobile/comments/[id]/like` auth → toggle; returns {liked, likeCount}.
- `POST /api/mobile/comments/[id]/report` auth `{reason?}` → upsert report.
- `DELETE /api/mobile/comments/[id]` auth, own comment only → hard delete (cascades likes/reports/replies).

### Admin (apps/admin)
- Page `/app-comments`: reported comments queue (report count desc) + all-comments list; actions hide/unhide, delete, block/unblock user. Reuse admin auth.

### App (apps/reader)
- Dep: `@react-native-google-signin/google-signin` (config plugin, needs `googleServicesFile`? no — webClientId enough for idToken), `expo-secure-store`, `@gorhom/bottom-sheet` (+ its reanimated/gesture deps already present). New EAS build required.
- `src/lib/auth.ts`: configure GoogleSignin (webClientId from `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID`), `signIn()` → idToken → POST auth → store {token,user} SecureStore; `useAuth(): {user, token, signIn, signOut, ready}`; auto-load on start.
- `src/api/comments.ts`: typed client for the endpoints (Bearer from auth).
- `src/components/CommentsSheet.tsx`: bottom sheet (snap 60%/90%): list (top-level + expandable replies), like ❤ w/ count, reply (1 level), report (long-press menu → report/delete-own), input bar bottom (avatar + TextInput + send); if not signed in → sign-in card with Google button in place of input; empty state text.
- Wire 💬: PostCard icon row (+count via batch count API fetched per feed page), ReaderCard rail, Reels rail, Article bottom bar; all open CommentsSheet(contentId).
- Settings: account group — signed out: "Sign in with Google" row; signed in: avatar+name+email, "Sign out".
- i18n te/en for all new strings (comments.*, auth.*, tabs.reels).

### Env needed (user/controller)
- Google Cloud OAuth clients (Android w/ SHA-1 of EAS keystore + Web client) → `EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID` (eas.json env + .env), server `GOOGLE_MOBILE_CLIENT_IDS`, `MOBILE_JWT_SECRET` on prod (GitHub Actions secret → ecosystem env).

## Non-goals
YouTube shorts in reels tab, phone OTP, push notifications, comment edit, nested >1 replies, reels save.

## Testing
- Unit (bun): JWT sign/verify helper, comment body validation, payload mappers.
- API: local curl of each route (dev server) incl. auth failures.
- Device QA: reels autoplay/mute/swipe, comment post/reply/like/report/delete, sign-in flow, Telugu, dark.

## Order
A (home polish) → B (reels API+tab) → C1 (DB+auth) → C2 (comments API+admin) → C3 (app auth+sheet+wiring) → EAS build + QA.

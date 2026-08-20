# Reader Phase 2 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Home polish (logo/cards/stories), Reels tab with native video, Google login + threaded comments across the app.

**Architecture:** Extend shipped IG redesign. Web gains `/api/reels` + `/api/mobile/*` (auth, comments) routes; Prisma gains AppUser/AppComment/AppCommentLike/AppCommentReport; admin gains moderation page; reader gains reels tab (expo-video), auth lib (google-signin + SecureStore), CommentsSheet (@gorhom/bottom-sheet) wired into PostCard/ReaderCard/Reels/Article/Settings.

**Tech Stack:** Expo 54, expo-video, @react-native-google-signin/google-signin, expo-secure-store, @gorhom/bottom-sheet, Next.js 16, Prisma, jose (JWT), bun.

**Spec:** docs/superpowers/specs/2026-08-20-reader-phase2-reels-comments-design.md (authoritative — read the relevant section for each task; it contains exact schemas, routes, and UI rules).

## Global Constraints
- All reader colours via `useTheme().colors` (reels screen may pin dark palette like reader). Brand #FF2C2C, heart #FF3040.
- Every new i18n key in BOTH te and en. Telugu lineHeight ≥1.4× font size.
- No dummy content. Existing web `Comment` model untouched. Existing routes untouched.
- Gates per task: `apps/reader`: `bun test && bun x tsc --noEmit`; `apps/web`: tsc no NEW errors (11 pre-existing allowed); `packages/db`: `prisma validate` (no migrate run — deploy runs `prisma migrate deploy`; create migration files via `prisma migrate dev --create-only` if local DB unavailable, else migrate dev).
- Conventional commits per task. No push until controller says.
- Secrets: never hardcode; env names per spec §C.

## Tasks

### Task 1: Home polish (spec §A)
Files: apps/reader/src/components/{ScreenHeader,PostCard,StoriesRow}.tsx, app/(tabs)/index.tsx if needed, i18n if needed.
- Logo untinted colour asset light / inverse-white dark, height 32.
- PostCard: drop summary, headline 2 lines 16/23 700, time under headline, avatar 28, add 💬 icon (no count yet — placeholder onPress prop `onComment?: () => void`, hidden count), paddings 10.
- StoriesRow: bubble 60, label 10, breaking ≤6, categories ≤8 + More bubble → categories tab.
Commit: `feat(reader): home polish - logo, tighter cards, trimmed stories`.

### Task 2: Reels API (spec §B API)
Files: apps/web/src/app/api/reels/route.ts (create). Query Content REEL published, payload.clipUrl present (filter in JS after fetch page — overfetch limit*2 then slice, or Prisma JSON path filter if supported). Map payload → response shape. tsc + local curl if dev server running.
Commit: `feat(api): public reels feed for mobile`.

### Task 3: Reels tab (spec §B App)
Files: apps/reader: `bun x expo install expo-video`; src/api/client.ts (`fetchReels`, `Reel` type); app/(tabs)/reels.tsx + app/(tabs)/_layout.tsx trigger; src/components/ReelVideoPage.tsx; i18n tabs.reels. Autoplay-visible/pause-others via onViewableItemsChanged; muted default + tap toggle + overlay; double-tap like (likes store, HeartBurst); rail ❤ 💬(stub prop) ✈; caption; ±1 render window; infinite scroll; re-tap refresh. app.json: expo-video plugin if required.
Commit: `feat(reader): reels tab with native vertical video player`.

### Task 4: DB models + migration (spec §C DB)
Files: packages/db/prisma/schema.prisma (+Content relation `appComments AppComment[]`), migration via create-only if no local DB; packages/db/src/index.ts re-export if needed. `prisma validate` + `prisma format`.
Commit: `feat(db): AppUser + app comment tables for mobile`.

### Task 5: Auth + comments API (spec §C Auth/API)
Files: apps/web/src/lib/mobile-auth.ts (verify Google idToken via google-auth-library or tokeninfo fetch; JWT via `jose` HS256 MOBILE_JWT_SECRET; `getAppUser(req)`); apps/web/src/app/api/mobile/auth/google/route.ts; api/mobile/comments/route.ts (GET list w/ replies≤3 + likedByMe, POST create w/ validation, 1-level rule); api/mobile/comments/count/route.ts; api/mobile/comments/[id]/{like,report}/route.ts + DELETE in [id]/route.ts. Unit-test pure validation (body trim/len, client-id allowlist parse) with bun test in apps/web if runner exists, else colocate pure helpers + test in packages/db? — put pure helpers in apps/web/src/lib/mobile-validate.ts and test via `bun test apps/web/src/lib/mobile-validate.test.ts`. Add `jose`+`google-auth-library` deps to apps/web.
Commit: `feat(api): mobile google auth + threaded comments endpoints`.

### Task 6: Admin moderation (spec §C Admin)
Files: apps/admin/src/app/(dashboard)/app-comments/page.tsx + api routes under apps/admin/src/app/api/app-comments/ (list w/ report counts, hide/unhide, delete, block/unblock user). Follow existing admin page/table patterns (read a sibling page first).
Commit: `feat(admin): app comment moderation + user blocking`.

### Task 7: App auth + CommentsSheet + wiring (spec §C App)
Files: apps/reader deps (google-signin, expo-secure-store, @gorhom/bottom-sheet); src/lib/auth.tsx (provider + useAuth, SecureStore persistence); src/api/comments.ts; src/components/CommentsSheet.tsx; wire 💬 + counts: PostCard (batch counts per feed page in HomeFeed), ReaderCard rail, reels rail, article bottom bar; Settings account group; app/_layout.tsx providers (BottomSheetModalProvider, AuthProvider); eas.json + .env EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID placeholder read from env (empty → sign-in button disabled with hint). i18n comments.*/auth.*.
Commit: `feat(reader): google sign-in, comments sheet, comment counts`.

### Task 8: Cleanup + gates + ship prep
Full gates all workspaces; grep for TODO/stub leftovers; update spec deviations in ledger. Controller then: push main (deploy runs migrate), set prod env secrets, EAS build.
Commit: `chore: phase2 gates + cleanup`.

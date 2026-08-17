# Reader App — Instagram-style Redesign (Design Spec)

Date: 2026-08-17 · App: `apps/reader` (Expo 54, expo-router 6, RN 0.81, reanimated 4)

## Goal
Current reader app looks dated (bordered white cards, gray chrome). Redesign every screen with an Instagram-like visual language: edge-to-edge media, stories row, IG-post cards, reels-style full-screen reader, system light/dark theme. Keep existing navigation (NativeTabs), stores, API client and i18n.

## Approach chosen
Theme provider + component refresh. No new styling library (NativeWind/Tamagui rejected — risk with Expo 54 / reanimated 4). Rebuild presentation components on `useTheme()`; keep data layer.

## 1. Theme system
- `src/theme.ts`: export `light` and `dark` palettes (same keys as today's `colors` + `surface`, `surfaceAlt`, `divider`, `iconMuted`, `heart: "#FF3040"`), `spacing`, `radius`, `withAlpha`, and `storyGradient = ["#FF2C2C","#FF7A18","#E1306C"]`.
- `src/theme-context.tsx`: `ThemeProvider` reading `useColorScheme()` + user override (`system|light|dark`) persisted in AsyncStorage key `rsn.theme`. Hook `useTheme()` returns `{ colors, scheme, pref, setPref }`.
- `app/_layout.tsx` wraps in `ThemeProvider`; StatusBar style follows scheme; NativeTabs `backgroundColor`/`tintColor` follow theme.
- Every component reads colours via `useTheme()`; static `colors` import removed from screens/components.

## 2. Home tab (`app/(tabs)/index.tsx`)
Layout top→bottom:
1. **Header** (`ScreenHeader`): wordmark logo left; right icons: search (opens `/search` — stub screen with "coming soon" text, not in this round's data work), notifications bell (no-op for now, hidden if no handler). Height 48, no border, theme surface.
2. **Stories row** (`StoriesRow`): horizontal FlatList, 72px bubbles, 12px gap.
   - Breaking bubbles first: articles from `GET /api/articles?breaking=1&limit=10` (last 24h). Gradient ring (`storyGradient`), thumbnail = featuredImage or logo. Label "Breaking"/category name, 1 line.
   - Category bubbles next: from existing categories fetch; ring = category colour; content = category icon (Ionicons mapping already used in Categories tab) or Telugu/English initial. Label = localized name.
   - Tap breaking bubble → `/reader?breaking=1&start=<id>`; tap category → `/reader?category=<slug>`.
   - Skeleton circles while loading.
3. **Feed** (`ArticleFeedList` w/ new `PostCard`): FlatList, no horizontal margins.
   - `PostCard`: 
     - Row: category avatar (32px circle, category colour bg + icon/initial) · category name (bold) · "· 2h" · spacer · ⋯ (opens Share sheet).
     - Media: full-width `expo-image`, aspect 4:5 when image height>width, else 16:9 (decide via `Image.onLoad` size, default 16:9). No image → gradient placeholder (category colour → dark) with headline centred large.
     - Icon row: heart (filled red if liked), share, spacer, bookmark. 24px Ionicons.
     - Text: headline bold 17px, 3 lines; summary 14px muted 2 lines + "more" tail (`Text` with tail-truncation trick); tap anywhere on card → `/article/[id]` (as today).
     - Double-tap on media → like + heart burst overlay (reanimated scale/opacity, 700ms). Haptic light.
     - 1px divider (theme `divider`) between posts.
   - Skeleton cards on first load. Pull-to-refresh w/ selection haptic (existing behaviour kept).
   - Re-tap tab → scroll top + refresh (existing).

## 3. Reels reader (`app/reader.tsx`, `ReaderCard`, `ReelPager`)
- Keep `ReelPager` gesture/paging + pagination logic untouched.
- `ReaderCard` restyle: image top 45% height full-bleed with bottom gradient scrim into `readerBg`; category pill (colour bg) top-left over image; headline 26px bold white; summary 16px `readerMuted`; source/time small.
- Right vertical action rail (IG Reels): heart, share, bookmark, each 28px icon + tiny label; positioned bottom-right above safe area.
- Swipe left → `/article/[id]` (existing behaviour kept). Position counter stays removed.
- Accepts new query params `breaking=1` and `start=<id>` (open at that article).

## 4. Other tabs
- **Categories**: 2-col grid tiles (aspect 1.4), background = category colour gradient or latest article image w/ scrim, name bottom-left bold white, article count small. Tap → `/category/[slug]` (existing feed screen, reuses `PostCard`).
- **Saved**: header w/ toggle (grid ⊞ / list ☰), default grid 3-col square thumbnails (image or gradient+headline), tap → article. List mode = `PostCard` compact. Empty state illustration text.
- **Settings**: grouped rows on `surface` cards w/ 12 radius: Appearance (System/Light/Dark segmented), Language (existing toggle), About (version), Share app. Uses theme.
- **Article** (`app/article/[id].tsx`): hero image full-bleed with back button overlay, category pill, title 24px, meta row, body via existing `ArticleBody` w/ theme-aware colours; bottom sticky action bar (heart/share/save).

## 5. Data / API changes (apps/web)
- `GET /api/articles` (mobile endpoint used by client.ts): add `isBreaking: boolean` to each article; add query `breaking=1` → only breaking articles published in last 24h (source: existing "breaking" checkbox on articles, commit 45c121b).
- Reader `Article` interface gains `isBreaking?: boolean`.
- Likes: `src/lib/likes.ts` mirroring `bookmarks.ts` (AsyncStorage set of ids, hook `useLikes()`). Local only, no counts.

## 6. Non-goals this round
Comments, real like counts, search backend, notifications, video.

## 7. Testing / verification
- Type-check `bun x tsc --noEmit` in apps/reader.
- Manual on device (Expo dev build): light+dark, Telugu + English, each tab, stories tap → reader → swipe → article, double-tap like persists after restart, saved grid/list toggle, theme pref persists.
- Web API: curl `?breaking=1` returns only breaking last-24h.

## 8. Build order
1. Theme system + provider + Settings theme picker
2. PostCard + feed + likes + double-tap
3. StoriesRow + API `isBreaking`/`breaking=1`
4. Reader restyle + new params
5. Categories grid, Saved grid, Article screen
6. Device QA pass

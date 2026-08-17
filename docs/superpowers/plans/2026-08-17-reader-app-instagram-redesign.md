# Reader App Instagram-style Redesign — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle every screen of `apps/reader` (Expo) into an Instagram-like UI: theme provider with system light/dark, IG post cards on a scrolling home feed, stories row (breaking + categories), reels-style full-screen reader, grid Categories/Saved, refreshed Settings/Article; plus a small web API change (`isBreaking`, `?breaking=1`).

**Architecture:** Keep expo-router routes, NativeTabs, `useFeed`, `feed-store`, `bookmarks`, `ReelPager` gesture engine, i18n. Add `ThemeProvider`/`useTheme()` and rebuild presentation components (`PostCard`, `StoriesRow`, `ReaderCard`, screens) on it. Local-only likes mirror the bookmarks store. Home tab switches from the swipe pager to a FlatList of `PostCard`; the pager stays at `/reader`.

**Tech Stack:** Expo SDK 54, expo-router 6, React Native 0.81, react-native-reanimated 4, react-native-gesture-handler 2.28, expo-image, expo-linear-gradient (to add), AsyncStorage, TypeScript strict, bun. Web: Next.js 16 + Prisma (`packages/db`).

**Spec:** `docs/superpowers/specs/2026-08-17-reader-app-instagram-redesign-design.md`

## Global Constraints

- Brand red `#FF2C2C` stays; heart colour `#FF3040`; story gradient `["#FF2C2C","#FF7A18","#E1306C"]`.
- No dummy/hardcoded content: articles/categories from API only; placeholders = brand logo asset or gradient, never fake text.
- Telugu must render on both light and dark themes — verify on device.
- No new styling library. Only new dependency: `expo-linear-gradient`.
- Existing routes stay: `(tabs)/index|categories|saved|settings`, `/reader`, `/article/[id]`, `/category/[slug]`.
- Type-check gate every task: `cd apps/reader && bun x tsc --noEmit`.
- Unit tests: `bun test` from `apps/reader` (bun runner, no jest). Only pure modules unit-tested; UI device-verified.
- Commit after each task; conventional messages (`feat(reader): …`, `feat(api): …`).
- Web API deploy = push to main (GitHub Actions → Azure VM PM2). No SSH.

---

## File Structure

**apps/reader**
- `src/theme.ts` (modify) — palettes `light`/`dark`, `spacing`, `radius`, `withAlpha`, `storyGradient`, `resolveScheme()`.
- `src/theme-context.tsx` (create) — `ThemeProvider`, `useTheme()`, AsyncStorage pref.
- `src/theme.test.ts` (create).
- `src/lib/likes.ts` (create) — local likes store; `src/lib/likes.test.ts` (create).
- `src/components/CategoryAvatar.tsx`, `PostCard.tsx`, `HeartBurst.tsx`, `Skeleton.tsx`, `StoriesRow.tsx`, `HomeFeed.tsx`, `SavedGridTile.tsx`, `SettingsRow.tsx` (create).
- `src/components/ScreenHeader.tsx`, `ReaderCard.tsx` (modify).
- `src/api/client.ts`, `src/lib/feed-store.ts`, `src/i18n/translations.ts` (modify).
- `app/_layout.tsx`, `app/(tabs)/_layout.tsx`, `app/(tabs)/index.tsx`, `app/(tabs)/categories.tsx`, `app/(tabs)/saved.tsx`, `app/(tabs)/settings.tsx`, `app/reader.tsx`, `app/article/[id].tsx`, `app/category/[slug].tsx` (modify); `app/search.tsx` (create stub).
- `app.json` (modify) — `userInterfaceStyle: "automatic"`, `name: "Rayalaseema News"`.
- Delete at end if unreferenced: `NewsCard.tsx`, `SavedCard.tsx`, `SwipeableArticleFeed.tsx`, `ArticleFeedList.tsx`, `CategoryChips.tsx`.

**apps/web**
- `src/app/api/articles/route.ts` (modify) — `breaking=1` filter + `isBreaking` in payload.

---

### Task 1: Theme tokens + `resolveScheme` (pure)

**Files:**
- Modify: `apps/reader/src/theme.ts`
- Test: `apps/reader/src/theme.test.ts`

**Interfaces:**
- Produces: `type Scheme = "light"|"dark"`, `type ThemePref = "system"|Scheme`, `interface Palette {brand,brandDark,heart,bg,surface,surfaceAlt,card,text,textMuted,textFaint,border,divider,iconMuted,readerBg,readerText,readerMuted,overlay}`, `light`, `dark`, `storyGradient`, `resolveScheme(pref, system): Scheme`, keep `spacing`, `radius`, `withAlpha`. Keep `export const colors = light` as deprecated alias until Task 13. `bgMuted` renamed → `surfaceAlt` (grep-replace all `colors.bgMuted`).

- [ ] **Step 1: Failing test** `apps/reader/src/theme.test.ts`

```ts
import { describe, expect, test } from "bun:test";
import { resolveScheme, light, dark, withAlpha, storyGradient } from "./theme";

describe("resolveScheme", () => {
  test("system follows OS", () => {
    expect(resolveScheme("system", "dark")).toBe("dark");
    expect(resolveScheme("system", "light")).toBe("light");
  });
  test("system with unknown OS falls back to light", () => {
    expect(resolveScheme("system", null)).toBe("light");
    expect(resolveScheme("system", undefined)).toBe("light");
  });
  test("explicit pref wins", () => {
    expect(resolveScheme("dark", "light")).toBe("dark");
    expect(resolveScheme("light", "dark")).toBe("light");
  });
});

describe("palettes", () => {
  test("same keys", () => {
    expect(Object.keys(light).sort()).toEqual(Object.keys(dark).sort());
  });
  test("fixed brand values", () => {
    expect(light.brand).toBe("#FF2C2C");
    expect(dark.brand).toBe("#FF2C2C");
    expect(light.heart).toBe("#FF3040");
    expect(storyGradient).toEqual(["#FF2C2C", "#FF7A18", "#E1306C"]);
  });
});

describe("withAlpha", () => {
  test("hex → rgba", () => {
    expect(withAlpha("#FF2C2C", 0.5)).toBe("rgba(255,44,44,0.5)");
    expect(withAlpha("#abc", 1)).toBe("rgba(170,187,204,1)");
  });
  test("bad hex → brand", () => {
    expect(withAlpha("nope", 0.2)).toBe("rgba(255,44,44,0.2)");
  });
});
```

- [ ] **Step 2: Run** `cd apps/reader && bun test src/theme.test.ts` → FAIL (exports missing).

- [ ] **Step 3: Implement** — replace `src/theme.ts`:

```ts
// Design tokens for the reader app. Two palettes (light/dark) sharing one
// shape; ThemeProvider (theme-context.tsx) picks the active one.

export type Scheme = "light" | "dark";
export type ThemePref = "system" | Scheme;

export interface Palette {
  brand: string; brandDark: string; heart: string;
  bg: string; surface: string; surfaceAlt: string; card: string;
  text: string; textMuted: string; textFaint: string;
  border: string; divider: string; iconMuted: string;
  readerBg: string; readerText: string; readerMuted: string; overlay: string;
}

export const light: Palette = {
  brand: "#FF2C2C", brandDark: "#D81E1E", heart: "#FF3040",
  bg: "#FFFFFF", surface: "#FFFFFF", surfaceAlt: "#F4F4F5", card: "#FFFFFF",
  text: "#18181B", textMuted: "#71717A", textFaint: "#A1A1AA",
  border: "#E4E4E7", divider: "#EFEFEF", iconMuted: "#262626",
  readerBg: "#0B0B0C", readerText: "#FFFFFF", readerMuted: "#C4C4C8",
  overlay: "rgba(0,0,0,0.45)",
};

export const dark: Palette = {
  brand: "#FF2C2C", brandDark: "#D81E1E", heart: "#FF3040",
  bg: "#000000", surface: "#000000", surfaceAlt: "#121212", card: "#0B0B0C",
  text: "#FAFAFA", textMuted: "#A8A8A8", textFaint: "#737373",
  border: "#262626", divider: "#1F1F1F", iconMuted: "#FAFAFA",
  readerBg: "#000000", readerText: "#FFFFFF", readerMuted: "#C4C4C8",
  overlay: "rgba(0,0,0,0.55)",
};

export const storyGradient = ["#FF2C2C", "#FF7A18", "#E1306C"] as const;

export function resolveScheme(pref: ThemePref, system: Scheme | null | undefined): Scheme {
  if (pref === "light" || pref === "dark") return pref;
  return system === "dark" ? "dark" : "light";
}

// Deprecated static alias so not-yet-migrated files compile. Removed in Task 13.
export const colors = light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 12, lg: 16, pill: 999 };

export function withAlpha(hex: string | null | undefined, alpha: number): string {
  let h = (hex || light.brand).replace("#", "");
  if (h.length === 3) h = h.split("").map((c) => c + c).join("");
  const n = parseInt(h, 16);
  if (h.length !== 6 || Number.isNaN(n)) return `rgba(255,44,44,${alpha})`;
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
```

- [ ] **Step 4:** `grep -rln "colors.bgMuted" src app` → replace with `colors.surfaceAlt`. Run `bun test src/theme.test.ts && bun x tsc --noEmit` → PASS/clean.
- [ ] **Step 5: Commit** `git add -A apps/reader && git commit -m "feat(reader): light/dark palettes + resolveScheme"`

---

### Task 2: ThemeProvider + `useTheme` + app.json automatic

**Files:** Create `apps/reader/src/theme-context.tsx`; Modify `apps/reader/app/_layout.tsx`, `apps/reader/app.json`.

**Interfaces:** `useTheme(): { colors: Palette; scheme: Scheme; pref: ThemePref; setPref(p: ThemePref): void }`; `ThemeProvider`. Storage key `rsn.theme`.

- [ ] **Step 1:** `src/theme-context.tsx`

```tsx
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { dark, light, resolveScheme, type Palette, type Scheme, type ThemePref } from "./theme";

const STORAGE_KEY = "rsn.theme";

interface ThemeCtx { colors: Palette; scheme: Scheme; pref: ThemePref; setPref: (p: ThemePref) => void }

const Ctx = createContext<ThemeCtx>({ colors: light, scheme: "light", pref: "system", setPref: () => {} });

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const system = useColorScheme();
  const [pref, setPrefState] = useState<ThemePref>("system");

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY)
      .then((v) => { if (v === "light" || v === "dark" || v === "system") setPrefState(v); })
      .catch(() => {});
  }, []);

  const setPref = useCallback((p: ThemePref) => {
    setPrefState(p);
    AsyncStorage.setItem(STORAGE_KEY, p).catch(() => {});
  }, []);

  const scheme = resolveScheme(pref, system);
  const value = useMemo<ThemeCtx>(
    () => ({ colors: scheme === "dark" ? dark : light, scheme, pref, setPref }),
    [scheme, pref, setPref],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useTheme() { return useContext(Ctx); }
```

- [ ] **Step 2:** `app/_layout.tsx`

```tsx
import React from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { LanguageProvider } from "../src/i18n";
import { ThemeProvider, useTheme } from "../src/theme-context";

export const unstable_settings = { initialRouteName: "(tabs)" };

function ThemedStack() {
  const { scheme, colors } = useTheme();
  return (
    <>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.bg } }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="reader" options={{ animation: "fade", presentation: "card" }} />
        <Stack.Screen name="search" options={{ animation: "slide_from_right" }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <ThemeProvider>
          <LanguageProvider>
            <ThemedStack />
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
```

- [ ] **Step 3:** `app.json`: `"userInterfaceStyle": "automatic"`, `"name": "Rayalaseema News"`.
- [ ] **Step 4:** `bun x tsc --noEmit` clean.
- [ ] **Step 5: Commit** `git commit -am "feat(reader): ThemeProvider + system dark mode"`

---

### Task 3: Settings — theme picker + grouped rows

**Files:** Create `src/components/SettingsRow.tsx`; Modify `app/(tabs)/settings.tsx`, `src/i18n/translations.ts`.

**Interfaces:** `SettingsGroup({title, children})`, `SettingsRow({label, value?, onPress?, icon?})`, `SettingsSegment<T extends string>({options:{value:T;label:string}[]; value:T; onChange})`. i18n (te/en) under `settings`: `appearance` (రూపం/Appearance), `themeSystem` (సిస్టమ్/System), `themeLight` (లైట్/Light), `themeDark` (డార్క్/Dark), `shareApp` (యాప్ షేర్ చేయండి/Share app). Fix `appName`: te `రాయలసీమ న్యూస్`, en `Rayalaseema News`.

- [ ] **Step 1:** Add translations + fix appName in both langs.
- [ ] **Step 2:** `SettingsRow.tsx`

```tsx
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../theme-context";
import { radius, spacing } from "../theme";

export function SettingsGroup({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={styles.group}>
      <Text style={[styles.title, { color: colors.textMuted }]}>{title}</Text>
      <View style={[styles.card, { backgroundColor: colors.surfaceAlt }]}>{children}</View>
    </View>
  );
}

export function SettingsRow({ label, value, onPress, icon }: {
  label: string; value?: string; onPress?: () => void; icon?: keyof typeof Ionicons.glyphMap;
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={!onPress} style={styles.row}>
      {icon ? <Ionicons name={icon} size={20} color={colors.text} style={{ marginRight: spacing.md }} /> : null}
      <Text style={[styles.label, { color: colors.text }]}>{label}</Text>
      {value ? <Text style={[styles.value, { color: colors.textMuted }]}>{value}</Text> : null}
      {onPress ? <Ionicons name="chevron-forward" size={18} color={colors.textFaint} /> : null}
    </Pressable>
  );
}

export function SettingsSegment<T extends string>({ options, value, onChange }: {
  options: { value: T; label: string }[]; value: T; onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.segment, { backgroundColor: colors.bg }]}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segBtn, active && { backgroundColor: colors.brand }]}>
            <Text style={[styles.segText, { color: active ? "#FFFFFF" : colors.text }]}>{o.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  group: { gap: spacing.sm },
  title: { fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 0.6, marginLeft: spacing.xs },
  card: { borderRadius: radius.md, overflow: "hidden" },
  row: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.lg, minHeight: 48 },
  label: { flex: 1, fontSize: 15, fontWeight: "500" },
  value: { fontSize: 14, marginRight: spacing.sm },
  segment: { flexDirection: "row", margin: spacing.sm, borderRadius: radius.sm, padding: 3, gap: 3 },
  segBtn: { flex: 1, paddingVertical: spacing.sm, borderRadius: radius.sm - 2, alignItems: "center" },
  segText: { fontSize: 13, fontWeight: "700" },
});
```

- [ ] **Step 3:** `app/(tabs)/settings.tsx`

```tsx
import React from "react";
import { View, ScrollView, StyleSheet, Share } from "react-native";
import Constants from "expo-constants";
import ScreenHeader from "../../src/components/ScreenHeader";
import { SettingsGroup, SettingsRow, SettingsSegment } from "../../src/components/SettingsRow";
import { useT } from "../../src/i18n";
import { LANGUAGE_NAMES, type Lang } from "../../src/i18n/translations";
import { useTheme } from "../../src/theme-context";
import { spacing, type ThemePref } from "../../src/theme";

const LANGS: Lang[] = ["te", "en"];

export default function SettingsScreen() {
  const { t, lang, setLang } = useT();
  const { colors, pref, setPref } = useTheme();
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const themeOptions: { value: ThemePref; label: string }[] = [
    { value: "system", label: t("settings.themeSystem") },
    { value: "light", label: t("settings.themeLight") },
    { value: "dark", label: t("settings.themeDark") },
  ];
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.body}>
        <SettingsGroup title={t("settings.appearance")}>
          <SettingsSegment options={themeOptions} value={pref} onChange={setPref} />
        </SettingsGroup>
        <SettingsGroup title={t("settings.language")}>
          <SettingsSegment options={LANGS.map((l) => ({ value: l, label: LANGUAGE_NAMES[l] }))} value={lang} onChange={setLang} />
        </SettingsGroup>
        <SettingsGroup title={t("settings.about")}>
          <SettingsRow label={t("settings.version")} value={version} />
          <SettingsRow label={t("appName")} />
          <SettingsRow label={t("settings.shareApp")} icon="share-social-outline"
            onPress={() => Share.share({ message: "https://rayalaseemanews.com" }).catch(() => {})} />
        </SettingsGroup>
      </ScrollView>
    </View>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1 }, body: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 } });
```

- [ ] **Step 4:** tsc; device: Dark → app black; kill+reopen → still dark.
- [ ] **Step 5: Commit** `git commit -am "feat(reader): settings theme picker + grouped rows"`

---

### Task 4: Themed ScreenHeader + tab bar

**Files:** Modify `src/components/ScreenHeader.tsx`, `app/(tabs)/_layout.tsx`, (maybe) `src/components/LanguageToggle.tsx`.

**Interfaces:** `ScreenHeader({ right?: React.ReactNode })` — wordmark left; `right` slot (default `LanguageToggle`).

- [ ] **Step 1:** `ScreenHeader.tsx`

```tsx
import React from "react";
import { View, StyleSheet, Image } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { LanguageToggle } from "./LanguageToggle";
import { useTheme } from "../theme-context";
import { spacing } from "../theme";

const logo = require("../../assets/logo-inverse.png");

// IG-style flat header: wordmark on the surface colour, no red bar, no border.
export default function ScreenHeader({ right }: { right?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 6, backgroundColor: colors.surface }]}>
      <View style={styles.row}>
        <Image source={logo} style={styles.logo} tintColor={scheme === "dark" ? "#FFFFFF" : colors.brand}
          resizeMode="contain" accessibilityLabel="Rayalaseema News" />
        <View style={styles.right}>{right ?? <LanguageToggle onDark={scheme === "dark"} />}</View>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  header: { paddingBottom: 6, paddingHorizontal: spacing.lg },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", height: 40 },
  logo: { width: 150, height: 30 },
  right: { flexDirection: "row", alignItems: "center", gap: spacing.lg },
});
```
Read `LanguageToggle.tsx`; if its light-mode text colour is hardcoded for a red bar, use `useTheme().colors.text` for inactive + `colors.brand` for active when `!onDark`.

- [ ] **Step 2:** `(tabs)/_layout.tsx`: `const { colors } = useTheme();` → `tintColor={colors.brand}`, `backgroundColor={Platform.OS === "android" ? colors.surface : undefined}`.
- [ ] **Step 3:** tsc; device light/dark header.
- [ ] **Step 4: Commit** `git commit -am "feat(reader): themed flat header + tab bar"`

---

### Task 5: Likes store (local) + test

**Files:** Create `src/lib/likes-pure.ts`, `src/lib/likes.ts`, `src/lib/likes.test.ts`.

**Interfaces:** `toggleId(ids: string[], id: string): string[]` (pure, in `likes-pure.ts`); `toggleLike(id): Promise<boolean>`; `likeOnly(id): Promise<boolean>`; `useLikes(): { isLiked(id): boolean; toggle: typeof toggleLike; likeOnly: typeof likeOnly }`. Storage key `liked-article-ids`.

- [ ] **Step 1: Test** `src/lib/likes.test.ts`

```ts
import { describe, expect, test } from "bun:test";
import { toggleId } from "./likes-pure";

describe("toggleId", () => {
  test("adds when missing, newest first", () => { expect(toggleId(["a"], "b")).toEqual(["b", "a"]); });
  test("removes when present", () => { expect(toggleId(["b", "a"], "a")).toEqual(["b"]); });
  test("does not mutate", () => { const i = ["a"]; toggleId(i, "b"); expect(i).toEqual(["a"]); });
});
```
- [ ] **Step 2:** `bun test src/lib/likes.test.ts` → FAIL.
- [ ] **Step 3:** `likes-pure.ts`:
```ts
export function toggleId(ids: string[], id: string): string[] {
  return ids.includes(id) ? ids.filter((x) => x !== id) : [id, ...ids];
}
```
`likes.ts`:
```ts
import { useCallback, useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Haptics from "expo-haptics";
import { toggleId } from "./likes-pure";

// Local-only likes (no accounts, no server counts). Same shape as bookmarks.ts.
const STORAGE_KEY = "liked-article-ids";
type Listener = () => void;
const listeners = new Set<Listener>();
let cache: string[] | null = null;

async function load(): Promise<string[]> {
  if (cache) return cache;
  try { const raw = await AsyncStorage.getItem(STORAGE_KEY); cache = raw ? (JSON.parse(raw) as string[]) : []; }
  catch { cache = []; }
  return cache;
}
async function persist(next: string[]) {
  cache = next;
  await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(() => {});
  listeners.forEach((l) => l());
}

export async function toggleLike(id: string): Promise<boolean> {
  const list = await load();
  const next = toggleId(list, id);
  const liked = next.length > list.length;
  if (liked) Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  else Haptics.selectionAsync().catch(() => {});
  await persist(next);
  return liked;
}

// Like without un-liking (double-tap semantics). True if state changed.
export async function likeOnly(id: string): Promise<boolean> {
  const list = await load();
  if (list.includes(id)) return false;
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  await persist([id, ...list]);
  return true;
}

export function useLikes() {
  const [ids, setIds] = useState<string[]>(cache ?? []);
  useEffect(() => {
    let mounted = true;
    const sync = () => mounted && setIds(cache ?? []);
    listeners.add(sync);
    load().then(sync);
    return () => { mounted = false; listeners.delete(sync); };
  }, []);
  const isLiked = useCallback((id: string) => ids.includes(id), [ids]);
  return { isLiked, toggle: toggleLike, likeOnly };
}
```
- [ ] **Step 4:** test PASS; tsc clean.
- [ ] **Step 5: Commit** `git add -A apps/reader && git commit -m "feat(reader): local likes store"`

---

### Task 6: PostCard + HeartBurst + Skeleton + HomeFeed + search stub

**Files:** Create `src/components/CategoryAvatar.tsx`, `HeartBurst.tsx`, `PostCard.tsx`, `Skeleton.tsx`, `HomeFeed.tsx`, `app/search.tsx`; Modify `app/(tabs)/index.tsx`, `app/category/[slug].tsx`, `src/i18n/translations.ts`. Dep: `cd apps/reader && bun x expo install expo-linear-gradient`.

**Interfaces:**
- `CategoryAvatar({ category: Category|null; size?: number })`
- `HeartBurst({ trigger: number })` — increment to replay.
- `PostCard({ article, liked, saved, onPress, onLike, onDoubleTapLike, onToggleSave })`
- `PostSkeleton()`, `StorySkeleton()`
- `HomeFeed` = `forwardRef<HomeFeedHandle, { category: string|null; ListHeaderComponent?: React.ReactElement|null }>`; `HomeFeedHandle.scrollToTopAndRefresh()`.
- i18n: `feed.more` (మరిన్ని / more), `search.soon` (శోధన త్వరలో… / Search coming soon).

- [ ] **Step 1:** install expo-linear-gradient; add i18n keys.
- [ ] **Step 2:** `CategoryAvatar.tsx`

```tsx
import React from "react";
import { View, Text, StyleSheet } from "react-native";
import type { Category } from "../api/client";
import { useT } from "../i18n";
import { categoryLabel } from "../lib/format";
import { useTheme } from "../theme-context";

export default function CategoryAvatar({ category, size = 32 }: { category: Category | null; size?: number }) {
  const { lang } = useT();
  const { colors } = useTheme();
  const bg = category?.color || colors.brand;
  const initial = categoryLabel(category, lang).trim().charAt(0) || "R";
  return (
    <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.text, { fontSize: size * 0.45 }]}>{initial}</Text>
    </View>
  );
}
const styles = StyleSheet.create({ circle: { alignItems: "center", justifyContent: "center" }, text: { color: "#FFFFFF", fontWeight: "800" } });
```

- [ ] **Step 3:** `HeartBurst.tsx`

```tsx
import React, { useEffect } from "react";
import { StyleSheet } from "react-native";
import Animated, { Easing, useAnimatedStyle, useSharedValue, withSequence, withTiming } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";

// IG double-tap heart: pops in, holds, fades. Replays whenever `trigger` changes.
export default function HeartBurst({ trigger }: { trigger: number }) {
  const scale = useSharedValue(0);
  const opacity = useSharedValue(0);
  useEffect(() => {
    if (!trigger) return;
    scale.value = withSequence(
      withTiming(1.2, { duration: 180, easing: Easing.out(Easing.back(2)) }),
      withTiming(1, { duration: 120 }), withTiming(1, { duration: 300 }), withTiming(0.6, { duration: 150 }),
    );
    opacity.value = withSequence(withTiming(1, { duration: 120 }), withTiming(1, { duration: 450 }), withTiming(0, { duration: 180 }));
  }, [trigger, scale, opacity]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }], opacity: opacity.value }));
  return (
    <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.center, style]}>
      <Ionicons name="heart" size={96} color="#FFFFFF" />
    </Animated.View>
  );
}
const styles = StyleSheet.create({ center: { alignItems: "center", justifyContent: "center" } });
```

- [ ] **Step 4:** `Skeleton.tsx`

```tsx
import React, { useEffect } from "react";
import { View, type ViewStyle } from "react-native";
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withTiming } from "react-native-reanimated";
import { useTheme } from "../theme-context";
import { spacing } from "../theme";

export function Skeleton({ style }: { style?: ViewStyle }) {
  const { colors } = useTheme();
  const o = useSharedValue(0.4);
  useEffect(() => { o.value = withRepeat(withTiming(1, { duration: 800 }), -1, true); }, [o]);
  const a = useAnimatedStyle(() => ({ opacity: o.value }));
  return <Animated.View style={[{ backgroundColor: colors.surfaceAlt, borderRadius: 6 }, style, a]} />;
}

export function PostSkeleton() {
  return (
    <View style={{ marginBottom: spacing.xl }}>
      <View style={{ flexDirection: "row", alignItems: "center", padding: spacing.md, gap: spacing.sm }}>
        <Skeleton style={{ width: 32, height: 32, borderRadius: 16 }} />
        <Skeleton style={{ width: 120, height: 12 }} />
      </View>
      <Skeleton style={{ width: "100%", aspectRatio: 16 / 9, borderRadius: 0 }} />
      <View style={{ padding: spacing.md, gap: spacing.sm }}>
        <Skeleton style={{ width: "90%", height: 16 }} />
        <Skeleton style={{ width: "70%", height: 16 }} />
        <Skeleton style={{ width: "95%", height: 12 }} />
      </View>
    </View>
  );
}

export function StorySkeleton() {
  return (
    <View style={{ flexDirection: "row", paddingHorizontal: spacing.md, gap: spacing.md, paddingVertical: spacing.sm }}>
      {[0, 1, 2, 3, 4].map((i) => <Skeleton key={i} style={{ width: 68, height: 68, borderRadius: 34 }} />)}
    </View>
  );
}
```

- [ ] **Step 5:** `PostCard.tsx`

```tsx
import React, { useCallback, useState } from "react";
import { View, Text, Pressable, Share, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { Ionicons } from "@expo/vector-icons";
import type { Article } from "../api/client";
import { useT } from "../i18n";
import { categoryLabel, stripHtml, timeAgo } from "../lib/format";
import { articleUrl } from "../lib/article-url";
import { useTheme } from "../theme-context";
import { spacing } from "../theme";
import CategoryAvatar from "./CategoryAvatar";
import HeartBurst from "./HeartBurst";

interface Props {
  article: Article; liked: boolean; saved: boolean;
  onPress: () => void; onLike: () => void; onDoubleTapLike: () => void; onToggleSave: () => void;
}

// Instagram post layout: [avatar · category · time · ⋯] / full-bleed media /
// [heart share … bookmark] / bold headline / 2-line summary "more".
function PostCard({ article, liked, saved, onPress, onLike, onDoubleTapLike, onToggleSave }: Props) {
  const { t, lang } = useT();
  const { colors } = useTheme();
  const summary = stripHtml(article.summary);
  const hasImage = !!article.featuredImage;
  const [aspect, setAspect] = useState(16 / 9);
  const [burst, setBurst] = useState(0);
  const accent = article.category?.color || colors.brand;

  const fireLike = useCallback(() => { setBurst((b) => b + 1); onDoubleTapLike(); }, [onDoubleTapLike]);
  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => runOnJS(fireLike)());
  const singleTap = Gesture.Tap().numberOfTaps(1).onEnd(() => runOnJS(onPress)());
  const taps = Gesture.Exclusive(doubleTap, singleTap);

  const onShare = () => {
    const url = articleUrl(article);
    Share.share({ message: url ? `${article.title}\n\n${url}` : article.title }).catch(() => {});
  };

  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderBottomColor: colors.divider }]}>
      <View style={styles.top}>
        <CategoryAvatar category={article.category} />
        <Text style={[styles.catName, { color: colors.text }]} numberOfLines={1}>
          {categoryLabel(article.category, lang) || t("appName")}
        </Text>
        <Text style={{ color: colors.textMuted }}>·</Text>
        <Text style={[styles.time, { color: colors.textMuted }]}>{timeAgo(article.publishedAt, lang)}</Text>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={10} onPress={onShare}>
          <Ionicons name="ellipsis-horizontal" size={20} color={colors.iconMuted} />
        </Pressable>
      </View>

      <GestureDetector gesture={taps}>
        <View style={[styles.media, { aspectRatio: hasImage ? aspect : 4 / 3, backgroundColor: colors.surfaceAlt }]}>
          {hasImage ? (
            <Image source={{ uri: article.featuredImage! }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150}
              onLoad={(e) => { const { width, height } = e.source; if (width && height) setAspect(height > width ? 4 / 5 : 16 / 9); }} />
          ) : (
            <LinearGradient colors={[accent, "#111111"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[StyleSheet.absoluteFill, styles.gradientText]}>
              <Text style={styles.gradientHeadline} numberOfLines={5}>{article.title}</Text>
            </LinearGradient>
          )}
          <HeartBurst trigger={burst} />
        </View>
      </GestureDetector>

      <View style={styles.actions}>
        <Pressable hitSlop={8} onPress={onLike}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={26} color={liked ? colors.heart : colors.iconMuted} />
        </Pressable>
        <Pressable hitSlop={8} onPress={onShare}>
          <Ionicons name="paper-plane-outline" size={24} color={colors.iconMuted} />
        </Pressable>
        <View style={{ flex: 1 }} />
        <Pressable hitSlop={8} onPress={onToggleSave}>
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={24} color={colors.iconMuted} />
        </Pressable>
      </View>

      <Pressable onPress={onPress} style={styles.textBlock}>
        <Text style={[styles.title, { color: colors.text }]} numberOfLines={3}>{article.title}</Text>
        {summary ? (
          <Text style={[styles.summary, { color: colors.textMuted }]} numberOfLines={2}>
            {summary} <Text style={{ color: colors.textFaint }}>{t("feed.more")}</Text>
          </Text>
        ) : null}
      </Pressable>
    </View>
  );
}
export default React.memo(PostCard);

const styles = StyleSheet.create({
  card: { borderBottomWidth: StyleSheet.hairlineWidth, paddingBottom: spacing.md },
  top: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.sm },
  catName: { fontSize: 14, fontWeight: "700", maxWidth: "55%" },
  time: { fontSize: 13 },
  media: { width: "100%", overflow: "hidden" },
  gradientText: { padding: spacing.xl, justifyContent: "flex-end" },
  gradientHeadline: { color: "#FFFFFF", fontSize: 24, lineHeight: 34, fontWeight: "800" },
  actions: { flexDirection: "row", alignItems: "center", paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: spacing.lg },
  textBlock: { paddingHorizontal: spacing.md, paddingTop: spacing.sm, gap: 4 },
  title: { fontSize: 17, lineHeight: 25, fontWeight: "700" },
  summary: { fontSize: 14, lineHeight: 21 },
});
```

- [ ] **Step 6:** `HomeFeed.tsx`

```tsx
import React, { forwardRef, useCallback, useImperativeHandle, useRef } from "react";
import { FlatList, RefreshControl, Text, View, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import * as Haptics from "expo-haptics";
import type { Article } from "../api/client";
import { useFeed } from "../lib/use-feed";
import { useBookmarks } from "../lib/bookmarks";
import { useLikes } from "../lib/likes";
import { setOpenArticle } from "../lib/article-store";
import { useT } from "../i18n";
import { useTheme } from "../theme-context";
import { spacing } from "../theme";
import PostCard from "./PostCard";
import { PostSkeleton } from "./Skeleton";

export interface HomeFeedHandle { scrollToTopAndRefresh: () => void }
interface Props { category: string | null; ListHeaderComponent?: React.ReactElement | null }

// Vertical Instagram-style feed. Tapping a post opens the native article
// screen; the reels reader is reached from the stories row.
const HomeFeed = forwardRef<HomeFeedHandle, Props>(function HomeFeed({ category, ListHeaderComponent }, ref) {
  const { t } = useT();
  const { colors } = useTheme();
  const router = useRouter();
  const feed = useFeed(category);
  const { isSaved, toggle: toggleSave } = useBookmarks();
  const { isLiked, toggle: toggleLike, likeOnly } = useLikes();
  const listRef = useRef<FlatList<Article>>(null);

  useImperativeHandle(ref, () => ({
    scrollToTopAndRefresh() { listRef.current?.scrollToOffset({ offset: 0, animated: true }); feed.refresh(); },
  }), [feed]);

  const open = useCallback((a: Article) => {
    setOpenArticle(a);
    router.push({ pathname: "/article/[id]", params: { id: a.id } });
  }, [router]);

  const onRefresh = useCallback(() => { Haptics.selectionAsync().catch(() => {}); feed.refresh(); }, [feed]);

  const renderItem = useCallback(({ item }: { item: Article }) => (
    <PostCard article={item} liked={isLiked(item.id)} saved={isSaved(item.id)}
      onPress={() => open(item)} onLike={() => { toggleLike(item.id); }}
      onDoubleTapLike={() => { likeOnly(item.id); }} onToggleSave={() => { toggleSave(item); }} />
  ), [isLiked, isSaved, open, toggleLike, likeOnly, toggleSave]);

  if (feed.loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.bg }}>
        {ListHeaderComponent}
        <PostSkeleton />
        <PostSkeleton />
      </View>
    );
  }

  return (
    <FlatList ref={listRef} style={{ backgroundColor: colors.bg }} data={feed.articles} keyExtractor={(a) => a.id}
      renderItem={renderItem} ListHeaderComponent={ListHeaderComponent}
      onEndReached={feed.loadMore} onEndReachedThreshold={0.6}
      refreshControl={<RefreshControl refreshing={feed.refreshing} onRefresh={onRefresh} tintColor={colors.brand} />}
      ListEmptyComponent={<View style={styles.center}><Text style={{ color: colors.textMuted }}>{feed.error ?? t("feed.empty")}</Text></View>}
      ListFooterComponent={feed.loadingMore ? <ActivityIndicator color={colors.brand} style={{ margin: spacing.lg }} /> : <View style={{ height: 96 }} />}
      removeClippedSubviews windowSize={7} />
  );
});
export default HomeFeed;
const styles = StyleSheet.create({ center: { padding: spacing.xl * 2, alignItems: "center" } });
```

- [ ] **Step 7:** `app/(tabs)/index.tsx`

```tsx
import React, { useCallback, useRef } from "react";
import { View, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import ScreenHeader from "../../src/components/ScreenHeader";
import HomeFeed, { type HomeFeedHandle } from "../../src/components/HomeFeed";
import { useTabPress } from "../../src/lib/use-tab-press";
import { useTheme } from "../../src/theme-context";

export default function FeedScreen() {
  const feedRef = useRef<HomeFeedHandle>(null);
  const router = useRouter();
  const { colors } = useTheme();
  useTabPress(useCallback(() => feedRef.current?.scrollToTopAndRefresh(), []));
  const right = (
    <Pressable hitSlop={8} onPress={() => router.push("/search")}>
      <Ionicons name="search-outline" size={24} color={colors.iconMuted} />
    </Pressable>
  );
  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScreenHeader right={right} />
      <HomeFeed ref={feedRef} category={null} />
    </View>
  );
}
const styles = StyleSheet.create({ screen: { flex: 1 } });
```

- [ ] **Step 8:** `app/category/[slug].tsx` — read file; replace `SwipeableArticleFeed` with `HomeFeed category={slug}`; theme colours via `useTheme`; keep back header.
- [ ] **Step 9:** `app/search.tsx`

```tsx
import React from "react";
import { View, Text, Pressable, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useT } from "../src/i18n";
import { useTheme } from "../src/theme-context";
import { spacing } from "../src/theme";

export default function SearchScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { t } = useT();
  const { colors } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, paddingTop: insets.top }}>
      <View style={styles.bar}>
        <Pressable onPress={() => router.back()} hitSlop={8}><Ionicons name="arrow-back" size={24} color={colors.iconMuted} /></Pressable>
      </View>
      <View style={styles.center}>
        <Ionicons name="search-outline" size={40} color={colors.textFaint} />
        <Text style={{ color: colors.textMuted, marginTop: spacing.md }}>{t("search.soon")}</Text>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({ bar: { height: 48, paddingHorizontal: spacing.lg, justifyContent: "center" }, center: { flex: 1, alignItems: "center", justifyContent: "center" } });
```

- [ ] **Step 10:** tsc; device: posts scroll, double-tap heart bursts + icon fills, persists after restart, dark ok, Telugu ok, category screen same look.
- [ ] **Step 11: Commit** `git add -A apps/reader && git commit -m "feat(reader): Instagram-style PostCard home feed, likes, skeletons"`

---

### Task 7: Web API — `isBreaking` + `?breaking=1`

**Files:** Modify `apps/web/src/app/api/articles/route.ts`, `apps/reader/src/api/client.ts`.

**Interfaces:** response articles gain `isBreaking: boolean` (from `Content.breaking`); `?breaking=1` → `breaking=true AND publishedAt >= now-24h`. Reader: `Article.isBreaking?: boolean`; `fetchArticles({ category?, breaking?, offset?, limit? })`.

- [ ] **Step 1:** route.ts

```ts
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@rayalaseema/db";

// GET /api/articles - fetch articles with optional filters
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const category = searchParams.get("category");
  const featured = searchParams.get("featured");
  const breaking = searchParams.get("breaking");
  const limit = parseInt(searchParams.get("limit") || "20");
  const offset = parseInt(searchParams.get("offset") || "0");

  const where: any = { type: "ARTICLE", status: "PUBLISHED" };
  if (category) where.category = { slug: category };
  if (featured === "true") where.featured = true;
  if (breaking === "1" || breaking === "true") {
    where.breaking = true;
    where.publishedAt = { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) };
  }

  const [rows, total] = await Promise.all([
    prisma.content.findMany({
      where,
      include: {
        category: { select: { id: true, name: true, nameEn: true, slug: true, color: true } },
        author: { select: { id: true, name: true } },
      },
      orderBy: { publishedAt: "desc" },
      take: limit,
      skip: offset,
    }),
    prisma.content.count({ where }),
  ]);

  const articles = rows.map((a: any) => ({ ...a, isBreaking: !!a.breaking }));

  return NextResponse.json({ articles, total, limit, offset }, {
    headers: { "Cache-Control": "public, s-maxage=60, stale-while-revalidate=30" },
  });
}
```
Confirm `breaking Boolean @default(false)` is on model `Content` (`packages/db/prisma/schema.prisma` ~L1255); adjust if not.

- [ ] **Step 2:** client.ts — `Article` gets `isBreaking?: boolean;`; `fetchArticles`:

```ts
export async function fetchArticles(opts: { category?: string; breaking?: boolean; offset?: number; limit?: number } = {}) {
  const params = new URLSearchParams({ limit: String(opts.limit ?? PAGE_SIZE), offset: String(opts.offset ?? 0) });
  if (opts.category) params.set("category", opts.category);
  if (opts.breaking) params.set("breaking", "1");
  const data = await get<ArticlesResponse>(`/api/articles?${params.toString()}`);
  return { articles: data.articles, hasMore: (data.offset ?? 0) + data.articles.length < (data.total ?? 0) };
}
```
- [ ] **Step 3:** web typecheck; local `curl "http://localhost:3000/api/articles?breaking=1&limit=5"` → only `isBreaking:true` ≤24h; reader tsc clean.
- [ ] **Step 4: Commit + deploy** `git commit -am "feat(api): isBreaking flag + breaking=1 filter for mobile stories"`; push main; verify `curl -s "https://rayalaseemanews.com/api/articles?breaking=1&limit=3" | head -c 400`.

---

### Task 8: StoriesRow

**Files:** Create `src/components/StoriesRow.tsx`; Modify `app/(tabs)/index.tsx`, `src/lib/feed-store.ts`, `src/i18n/translations.ts`.

**Interfaces:** `StoriesRow()` self-fetching (`fetchArticles({breaking:true,limit:10})`, `fetchCategories()`); `StorySkeleton` while loading; returns null if both empty. `ReaderPagination` gains `breaking?: boolean`. i18n `stories.breaking` (బ్రేకింగ్ / Breaking). Nav: breaking bubble → `setReaderFeed(breaking, i, {category:null, offset:0, hasMore:false, breaking:true})` + `router.push("/reader")`; category bubble → `setReaderFeed([], 0, {category: slug, offset:0, hasMore:true})` + `router.push({pathname:"/reader", params:{category: slug}})`.

- [ ] **Step 1:** feed-store: add `breaking?: boolean;` to `ReaderPagination`. Add i18n key.
- [ ] **Step 2:** `StoriesRow.tsx`

```tsx
import React, { useEffect, useState } from "react";
import { View, Text, Pressable, ScrollView, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { fetchArticles, fetchCategories, type Article, type Category } from "../api/client";
import { setReaderFeed } from "../lib/feed-store";
import { useT } from "../i18n";
import { categoryLabel } from "../lib/format";
import { useTheme } from "../theme-context";
import { spacing, storyGradient } from "../theme";
import { StorySkeleton } from "./Skeleton";

const SIZE = 66;
const RING = 3;
const LOGO = require("../../assets/icon-512.png");

function Ring({ ring, children }: { ring: readonly string[]; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <LinearGradient colors={[...ring] as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.ring}>
      <View style={[styles.ringInner, { backgroundColor: colors.bg }]}>{children}</View>
    </LinearGradient>
  );
}

export default function StoriesRow() {
  const router = useRouter();
  const { t, lang } = useT();
  const { colors } = useTheme();
  const [breaking, setBreaking] = useState<Article[] | null>(null);
  const [cats, setCats] = useState<Category[] | null>(null);

  useEffect(() => {
    fetchArticles({ breaking: true, limit: 10 }).then((r) => setBreaking(r.articles)).catch(() => setBreaking([]));
    fetchCategories().then(setCats).catch(() => setCats([]));
  }, []);

  if (breaking === null || cats === null) return <StorySkeleton />;
  if (breaking.length === 0 && cats.length === 0) return null;

  const openBreaking = (i: number) => {
    setReaderFeed(breaking, i, { category: null, offset: 0, hasMore: false, breaking: true });
    router.push("/reader");
  };
  const openCategory = (c: Category) => {
    setReaderFeed([], 0, { category: c.slug, offset: 0, hasMore: true });
    router.push({ pathname: "/reader", params: { category: c.slug } });
  };

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}
      style={{ borderBottomColor: colors.divider, borderBottomWidth: StyleSheet.hairlineWidth }}>
      {breaking.map((a, i) => (
        <Pressable key={a.id} style={styles.item} onPress={() => openBreaking(i)}>
          <Ring ring={storyGradient}>
            <Image source={a.featuredImage ? { uri: a.featuredImage } : LOGO} style={styles.thumb} contentFit="cover" />
          </Ring>
          <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>{t("stories.breaking")}</Text>
        </Pressable>
      ))}
      {cats.map((c) => {
        const accent = c.color || colors.brand;
        const label = categoryLabel(c, lang);
        return (
          <Pressable key={c.id} style={styles.item} onPress={() => openCategory(c)}>
            <Ring ring={[accent, accent]}>
              <View style={[styles.thumb, { backgroundColor: accent, alignItems: "center", justifyContent: "center" }]}>
                <Text style={styles.initial}>{label.trim().charAt(0)}</Text>
              </View>
            </Ring>
            <Text style={[styles.label, { color: colors.text }]} numberOfLines={1}>{label}</Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { paddingHorizontal: spacing.md, paddingVertical: spacing.sm, gap: spacing.md },
  item: { width: SIZE + 8, alignItems: "center", gap: 4 },
  ring: { width: SIZE + RING * 2, height: SIZE + RING * 2, borderRadius: (SIZE + RING * 2) / 2, alignItems: "center", justifyContent: "center" },
  ringInner: { width: SIZE + 2, height: SIZE + 2, borderRadius: (SIZE + 2) / 2, alignItems: "center", justifyContent: "center" },
  thumb: { width: SIZE - 4, height: SIZE - 4, borderRadius: (SIZE - 4) / 2 },
  initial: { color: "#FFFFFF", fontSize: 24, fontWeight: "800" },
  label: { fontSize: 11, maxWidth: SIZE + 8 },
});
```
- [ ] **Step 3:** index.tsx: `<HomeFeed ref={feedRef} category={null} ListHeaderComponent={<StoriesRow />} />`.
- [ ] **Step 4:** tsc; device: bubbles render; breaking tap opens reader (category tap completes in Task 9).
- [ ] **Step 5: Commit** `git commit -am "feat(reader): stories row (breaking + categories)"`

---

### Task 9: Reels reader restyle + params

**Files:** Modify `app/reader.tsx`, `src/components/ReaderCard.tsx`.

**Interfaces:** `ReaderCard` props `{ article, width, height, topInset, bottomInset, saved, liked, onToggleSave, onToggleLike, onDoubleTapLike }`. `reader.tsx` reads `useLocalSearchParams<{category?: string}>()`; if handed list empty and `category` present → fetch first page; `loadMore` passes `breaking: p.breaking`.

- [ ] **Step 1:** `ReaderCard.tsx`

```tsx
import React, { useCallback, useState } from "react";
import { View, Text, Pressable, StyleSheet, Share } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { Gesture, GestureDetector } from "react-native-gesture-handler";
import { runOnJS } from "react-native-reanimated";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { Article } from "../api/client";
import { useT } from "../i18n";
import { categoryLabel, stripHtml, timeAgo } from "../lib/format";
import { articleUrl } from "../lib/article-url";
import { setOpenArticle } from "../lib/article-store";
import { dark, radius, spacing } from "../theme";
import HeartBurst from "./HeartBurst";

const LOGO = require("../../assets/icon-512.png");
const c = dark; // reels reader is always dark

export default function ReaderCard({
  article, width, height, bottomInset, saved, liked, onToggleSave, onToggleLike, onDoubleTapLike,
}: {
  article: Article; width: number; height: number; topInset: number; bottomInset: number;
  saved: boolean; liked: boolean; onToggleSave: () => void; onToggleLike: () => void; onDoubleTapLike: () => void;
}) {
  const { t, lang } = useT();
  const router = useRouter();
  const summary = stripHtml(article.summary);
  const hasImage = !!article.featuredImage;
  const [burst, setBurst] = useState(0);
  const accent = article.category?.color || c.brand;

  const fire = useCallback(() => { setBurst((b) => b + 1); onDoubleTapLike(); }, [onDoubleTapLike]);
  const doubleTap = Gesture.Tap().numberOfTaps(2).onEnd(() => runOnJS(fire)());

  const onShare = () => {
    const url = articleUrl(article);
    Share.share({ message: url ? `${article.title}\n\n${url}` : article.title }).catch(() => {});
  };
  const onReadFull = () => {
    setOpenArticle(article);
    router.push({ pathname: "/article/[id]", params: { id: article.id } });
  };

  return (
    <View style={[styles.page, { width, height, backgroundColor: c.readerBg }]}>
      <GestureDetector gesture={doubleTap}>
        <View style={[styles.imageWrap, { height: height * 0.45 }]}>
          <Image source={hasImage ? { uri: article.featuredImage! } : LOGO} style={StyleSheet.absoluteFill}
            contentFit={hasImage ? "cover" : "contain"} transition={0} cachePolicy="memory-disk" />
          <LinearGradient colors={["transparent", c.readerBg]} style={styles.scrim} />
          <HeartBurst trigger={burst} />
        </View>
      </GestureDetector>

      <View style={[styles.content, { paddingBottom: bottomInset + spacing.xl }]}>
        <View style={styles.metaRow}>
          {article.category ? (
            <View style={[styles.pill, { backgroundColor: accent }]}>
              <Text style={styles.pillText}>{categoryLabel(article.category, lang)}</Text>
            </View>
          ) : null}
          <Text style={[styles.time, { color: c.readerMuted }]}>{timeAgo(article.publishedAt, lang)}</Text>
        </View>
        <Text style={[styles.title, { color: c.readerText }]}>{article.title}</Text>
        <Text style={[styles.summary, { color: c.readerMuted }]} numberOfLines={7}>{summary}</Text>
        <Pressable onPress={onReadFull} style={styles.readFull}>
          <Text style={[styles.readFullText, { color: c.brand }]}>{t("reader.readFull")}</Text>
          <Ionicons name="arrow-forward" size={16} color={c.brand} />
        </Pressable>
      </View>

      {/* IG Reels vertical action rail */}
      <View style={[styles.rail, { bottom: bottomInset + spacing.xl }]}>
        <Pressable onPress={onToggleLike} hitSlop={8}>
          <Ionicons name={liked ? "heart" : "heart-outline"} size={30} color={liked ? c.heart : "#FFFFFF"} />
        </Pressable>
        <Pressable onPress={onShare} hitSlop={8}><Ionicons name="paper-plane-outline" size={28} color="#FFFFFF" /></Pressable>
        <Pressable onPress={onToggleSave} hitSlop={8}>
          <Ionicons name={saved ? "bookmark" : "bookmark-outline"} size={28} color="#FFFFFF" />
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {},
  imageWrap: { width: "100%" },
  scrim: { position: "absolute", left: 0, right: 0, bottom: 0, height: "45%" },
  content: { flex: 1, paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingRight: 72, gap: spacing.sm },
  metaRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  pill: { paddingHorizontal: spacing.md, paddingVertical: 4, borderRadius: radius.pill },
  pillText: { color: "#FFFFFF", fontSize: 12, fontWeight: "800" },
  time: { fontSize: 12 },
  title: { fontSize: 26, lineHeight: 36, fontWeight: "800" },
  summary: { fontSize: 16, lineHeight: 25 },
  readFull: { flexDirection: "row", alignItems: "center", gap: 6, marginTop: "auto" },
  readFullText: { fontSize: 15, fontWeight: "700" },
  rail: { position: "absolute", right: spacing.md, alignItems: "center", gap: spacing.xl },
});
```

- [ ] **Step 2:** `reader.tsx` edits:
  - imports: `useEffect`, `useLocalSearchParams`, `ActivityIndicator`, `useLikes`, `useTheme`, `dark`.
  - `const { category } = useLocalSearchParams<{ category?: string }>();`
  - `const [loading, setLoading] = useState(false);` + effect: if `articles.length === 0 && category` → `setLoading(true); fetchArticles({ category }).then(({articles, hasMore}) => { setArticles(articles); pageRef.current = { category, offset: articles.length, hasMore }; }).catch(() => {}).finally(() => setLoading(false));`
  - `loadMore`: `fetchArticles({ category: p.category ?? undefined, breaking: p.breaking, offset: p.offset })`.
  - `renderPage`: from `useLikes()` pass `liked={isLiked(item.id)} onToggleLike={() => { toggleLike(item.id); }} onDoubleTapLike={() => { likeOnly(item.id); }}`.
  - Loading branch: `<View style={{flex:1, backgroundColor: dark.readerBg, alignItems:"center", justifyContent:"center"}}><ActivityIndicator color={dark.brand} /></View>` before the empty branch.
  - Replace `colors.*` in styles with `dark.*`; empty-state colours via `useTheme().colors` inline.
- [ ] **Step 3:** tsc; device: story tap → reader; category story fetches; paging; double-tap heart; rail visible; close works.
- [ ] **Step 4: Commit** `git commit -am "feat(reader): reels-style reader restyle, category/breaking params, likes"`

---

### Task 10: Categories grid

**Files:** Modify `app/(tabs)/categories.tsx`.

- [ ] **Step 1:** keep fetch/`useTabPress`; import `LinearGradient`, `useTheme`; screen bg `colors.bg`; tile:

```tsx
<Pressable style={({ pressed }) => [styles.tile, pressed && { opacity: 0.85 }]}
  onPress={() => router.push({ pathname: "/category/[slug]", params: { slug: item.slug } })}>
  <LinearGradient colors={[withAlpha(accent, 0.95), withAlpha(accent, 0.55), "#111111"]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
  <View style={styles.tileBadge}><Text style={styles.tileInitial}>{label.trim().charAt(0)}</Text></View>
  <Text style={styles.tileText} numberOfLines={2}>{label}</Text>
</Pressable>
```
styles: `tile: { flex: 1, aspectRatio: 1.4, borderRadius: radius.lg, overflow: "hidden", padding: spacing.md, justifyContent: "space-between" }`, `tileBadge: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" }`, `tileInitial: { color: "#FFF", fontWeight: "800", fontSize: 16 }`, `tileText: { color: "#FFF", fontSize: 16, fontWeight: "800" }`.
- [ ] **Step 2:** tsc; device light+dark.
- [ ] **Step 3: Commit** `git commit -am "feat(reader): gradient category grid"`

---

### Task 11: Saved — grid/list toggle

**Files:** Create `src/components/SavedGridTile.tsx`; Modify `app/(tabs)/saved.tsx`.

**Interfaces:** `SavedGridTile({ article, size, onPress })`. Saved screen: `mode: "grid"|"list"` persisted (`AsyncStorage` key `saved.mode`, default grid); toggle icon in `ScreenHeader right`; grid = `FlatList numColumns={3}` (size `(width-4)/3`, gap 2); list = `PostCard` (likes via `useLikes`); keep section filter sheet + FAB; tap → `setReaderFeed(filtered, index)` + `router.push("/reader")` (existing).

- [ ] **Step 1:** `SavedGridTile.tsx`

```tsx
import React from "react";
import { Pressable, Text, StyleSheet } from "react-native";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import type { Article } from "../api/client";
import { light, spacing } from "../theme";

export default function SavedGridTile({ article, size, onPress }: { article: Article; size: number; onPress: () => void }) {
  const accent = article.category?.color || light.brand;
  return (
    <Pressable onPress={onPress} style={{ width: size, height: size }}>
      {article.featuredImage ? (
        <Image source={{ uri: article.featuredImage }} style={StyleSheet.absoluteFill} contentFit="cover" />
      ) : (
        <LinearGradient colors={[accent, "#111111"]} style={[StyleSheet.absoluteFill, styles.pad]}>
          <Text style={styles.headline} numberOfLines={4}>{article.title}</Text>
        </LinearGradient>
      )}
    </Pressable>
  );
}
const styles = StyleSheet.create({ pad: { padding: spacing.sm, justifyContent: "flex-end" }, headline: { color: "#FFF", fontSize: 12, fontWeight: "700", lineHeight: 16 } });
```
- [ ] **Step 2:** Read `saved.tsx` fully; implement mode toggle + both renderers; theme colours; keep filter. `grep -rn SavedCard src app` → delete `SavedCard.tsx` if unused.
- [ ] **Step 3:** tsc; device: grid default, toggle persists, filter works, empty state themed.
- [ ] **Step 4: Commit** `git commit -am "feat(reader): saved grid/list toggle"`

---

### Task 12: Article screen refresh

**Files:** Modify `app/article/[id].tsx`, `src/components/ArticleBody.tsx`.

- [ ] **Step 1:** Read both. Changes: hero image full-bleed top w/ back + share circle buttons overlaid (`overlay` bg, white icons) + bottom scrim; no image → gradient block (category colour→#111, height 200) same buttons. Below: category pill, title 24/34 800, meta (author · time), `ArticleBody`. `ArticleBody`: static `colors.*` → `useTheme().colors`; Telugu line-height ≥ 1.6×. Sticky bottom bar (absolute, `surface` bg, hairline `divider` top, paddingBottom `insets.bottom`): heart (`useLikes`), share, bookmark.
- [ ] **Step 2:** tsc; device: from feed + reader; dark readable; Telugu ok; bar above gesture area.
- [ ] **Step 3: Commit** `git commit -am "feat(reader): article screen hero + themed body + action bar"`

---

### Task 13: Cleanup + final QA + build

- [ ] **Step 1:** `grep -rn "NewsCard\|SavedCard\|SwipeableArticleFeed\|ArticleFeedList\|CategoryChips" apps/reader/src apps/reader/app` → delete files with zero importers.
- [ ] **Step 2:** Remove `export const colors = light` from `theme.ts`; fix remaining importers to `useTheme`.
- [ ] **Step 3:** `bun test && bun x tsc --noEmit`.
- [ ] **Step 4: Device QA** (light+dark, te+en): home header/stories/posts/double-tap/save/share/refresh/infinite/tab-retap; story (breaking+category) → reader → swipe → read full → back; categories grid → feed; saved grid/list/filter/empty; settings theme+lang persist after kill; article page.
- [ ] **Step 5: Commit** `git commit -am "chore(reader): remove legacy card components, drop static colors alias"`
- [ ] **Step 6:** `cd apps/reader && eas build --profile preview --platform android` → install → smoke test.

---

## Self-review

- Spec coverage: §1→T1-4; §2→T6,T8; §3→T9; §4→T3,T10,T11,T12; §5→T5,T7; §6 respected (search stub); §7→per-task + T13; §8 order kept.
- Names consistent: `useTheme().colors`, `HomeFeed`/`HomeFeedHandle`, `useLikes().{isLiked,toggle,likeOnly}`, `fetchArticles({category,breaking,offset,limit})`, `ReaderPagination.breaking`, `storyGradient`, `surfaceAlt`.
- Risk: bun test importing RN modules avoided — tests import only `theme.ts` (no RN imports) and `likes-pure.ts`.

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
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    cache = raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    cache = [];
  }
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
    return () => {
      mounted = false;
      listeners.delete(sync);
    };
  }, []);
  const isLiked = useCallback((id: string) => ids.includes(id), [ids]);
  return { isLiked, toggle: toggleLike, likeOnly };
}

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

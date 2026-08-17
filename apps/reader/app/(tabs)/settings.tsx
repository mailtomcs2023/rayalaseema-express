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

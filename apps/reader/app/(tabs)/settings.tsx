import React from "react";
import { View, Text, ScrollView, StyleSheet, Share, Alert, ActivityIndicator } from "react-native";
import { Image } from "expo-image";
import Constants from "expo-constants";
import ScreenHeader from "../../src/components/ScreenHeader";
import { SettingsGroup, SettingsRow, SettingsSegment } from "../../src/components/SettingsRow";
import { useT } from "../../src/i18n";
import { LANGUAGE_NAMES, type Lang } from "../../src/i18n/translations";
import { useTheme } from "../../src/theme-context";
import { useAuth } from "../../src/lib/auth";
import { spacing, type ThemePref } from "../../src/theme";

const LANGS: Lang[] = ["te", "en"];

export default function SettingsScreen() {
  const { t, lang, setLang } = useT();
  const { colors, pref, setPref } = useTheme();
  const { user, ready, available, signingIn, signIn, signOut } = useAuth();
  const version = Constants.expoConfig?.version ?? "1.0.0";
  const themeOptions: { value: ThemePref; label: string }[] = [
    { value: "system", label: t("settings.themeSystem") },
    { value: "light", label: t("settings.themeLight") },
    { value: "dark", label: t("settings.themeDark") },
  ];
  const confirmSignOut = () =>
    Alert.alert(t("auth.signOut"), t("auth.signOutConfirm"), [
      { text: t("common.cancel"), style: "cancel" },
      { text: t("auth.signOut"), style: "destructive", onPress: () => { signOut(); } },
    ]);

  return (
    <View style={[styles.screen, { backgroundColor: colors.bg }]}>
      <ScreenHeader />
      <ScrollView contentContainerStyle={styles.body}>
        <SettingsGroup title={t("settings.account")}>
          {/* Nothing is shown until SecureStore has been read, so the row
              never flips from "sign in" to a profile a beat later. */}
          {!ready ? (
            <View style={styles.accountRow}><ActivityIndicator color={colors.brand} /></View>
          ) : user ? (
            <>
              <View style={styles.accountRow}>
                {user.avatarUrl ? (
                  <Image source={{ uri: user.avatarUrl }} style={styles.avatar} contentFit="cover" transition={100} />
                ) : (
                  <View style={[styles.avatar, styles.avatarFallback, { backgroundColor: colors.bg }]}>
                    <Text style={{ color: colors.textMuted, fontWeight: "700" }}>
                      {(user.name || "?").trim().charAt(0).toUpperCase()}
                    </Text>
                  </View>
                )}
                <View style={styles.accountText}>
                  <Text style={[styles.accountName, { color: colors.text }]} numberOfLines={1}>{user.name}</Text>
                  {user.email ? (
                    <Text style={[styles.accountEmail, { color: colors.textMuted }]} numberOfLines={1}>{user.email}</Text>
                  ) : null}
                </View>
              </View>
              <SettingsRow label={t("auth.signOut")} icon="log-out-outline" onPress={confirmSignOut} />
            </>
          ) : signingIn ? (
            <View style={styles.accountRow}><ActivityIndicator color={colors.brand} /></View>
          ) : available ? (
            <SettingsRow label={t("auth.signIn")} icon="logo-google" onPress={() => { signIn(); }} />
          ) : (
            // No OAuth client baked into this build - show why, not a dead row.
            <SettingsRow label={t("auth.signIn")} icon="logo-google" value={t("auth.unavailable")} />
          )}
        </SettingsGroup>
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
const styles = StyleSheet.create({
  screen: { flex: 1 },
  body: { padding: spacing.lg, gap: spacing.xl, paddingBottom: 120 },
  accountRow: { flexDirection: "row", alignItems: "center", gap: spacing.md, paddingHorizontal: spacing.lg, paddingVertical: spacing.md, minHeight: 56 },
  avatar: { width: 40, height: 40, borderRadius: 20 },
  avatarFallback: { alignItems: "center", justifyContent: "center" },
  accountText: { flex: 1, gap: 2 },
  accountName: { fontSize: 15, lineHeight: 22, fontWeight: "700" },
  accountEmail: { fontSize: 13, lineHeight: 19 },
});

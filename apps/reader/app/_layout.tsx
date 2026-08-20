import React from "react";
import { Stack } from "expo-router";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import { BottomSheetModalProvider } from "@gorhom/bottom-sheet";
import { LanguageProvider } from "../src/i18n";
import { AuthProvider } from "../src/lib/auth";
import { CommentsSheetHost } from "../src/components/CommentsSheet";
import { ThemeProvider, useTheme } from "../src/theme-context";

export const unstable_settings = { initialRouteName: "(tabs)" };

// Tabs own their own headers; the full-screen reader is a headerless modal-ish
// push presented over them.
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
            <AuthProvider>
              {/* One comments sheet for the whole app - every 💬 affordance
                  presents this same instance via useCommentsSheet(). */}
              <BottomSheetModalProvider>
                <CommentsSheetHost>
                  <ThemedStack />
                </CommentsSheetHost>
              </BottomSheetModalProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

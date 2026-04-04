import { useEffect } from "react";
import { View, Image, Dimensions } from "react-native";
import { useFonts } from "expo-font";
import { Stack, useRouter, useSegments } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import "@/global.css";

export { ErrorBoundary } from "expo-router";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const LOGO_SIZE = SCREEN_WIDTH * 0.3;

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

function useProtectedRoute() {
  const { session, isLoading } = useAuthStore();
  const segments = useSegments();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;

    const inAuthGroup = segments[0] === "(auth)";

    if (!session && !inAuthGroup) {
      router.replace("/(auth)/onboarding");
    } else if (session && inAuthGroup) {
      router.replace("/(tabs)");
    }
  }, [session, isLoading, segments]);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    SpaceMono: require("../assets/fonts/SpaceMono-Regular.ttf"),
  });
  const initialize = useAuthStore((state) => state.initialize);
  const isLoading = useAuthStore((state) => state.isLoading);
  const loadTheme = useThemeStore((state) => state.loadTheme);

  useEffect(() => {
    const unsubscribe = initialize();
    loadTheme();
    return unsubscribe;
  }, []);

  useEffect(() => {
    if (fontError) throw fontError;
  }, [fontError]);

  useEffect(() => {
    if (fontsLoaded) {
      SplashScreen.hideAsync();
    }
  }, [fontsLoaded]);

  // Show clean black + logo splash while loading
  if (!fontsLoaded || isLoading) {
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: "#0A0A0A",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        <Image
          source={require("../assets/images/logo-white.png")}
          style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
          resizeMode="contain"
        />
      </View>
    );
  }

  return <RootLayoutNav />;
}

function ThemeStatusBar() {
  const { theme } = useThemeStore();
  return <StatusBar style={theme === "dark" ? "light" : "dark"} />;
}

function RootLayoutNav() {

  useProtectedRoute();

  return (
    <>
      <ThemeStatusBar />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="compose" options={{ presentation: 'modal', headerShown: false }} />
        <Stack.Screen name="support" options={{ presentation: 'modal', headerShown: false }} />
      </Stack>
    </>
  );
}

import { create } from "zustand";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { ColorSchemeName } from "react-native";

interface ThemeState {
  theme: ColorSchemeName;
  setTheme: (theme: ColorSchemeName) => void;
  loadTheme: () => Promise<void>;
  toggleTheme: () => void;
}

const THEME_KEY = "@cryptonians_theme";

export const useThemeStore = create<ThemeState>((set, get) => ({
  theme: "dark",

  setTheme: (theme) => {
    set({ theme });
    AsyncStorage.setItem(THEME_KEY, theme || "dark");
  },

  loadTheme: async () => {
    try {
      const stored = await AsyncStorage.getItem(THEME_KEY);
      if (stored === "light" || stored === "dark") {
        set({ theme: stored });
      }
    } catch {
      // Default to dark
    }
  },

  toggleTheme: () => {
    const current = get().theme;
    const next = current === "dark" ? "light" : "dark";
    get().setTheme(next);
  },
}));

export const Colors = {
  // Brand
  brand: {
    black: "#0A0A0A",
    white: "#FFFFFF",
    accent: "#6C63FF", // Purple accent
    accentLight: "#8B83FF",
    accentDark: "#4F46E5",
  },

  light: {
    text: "#1A1A1A",
    textSecondary: "#6B7280",
    textMuted: "#9CA3AF",
    background: "#FFFFFF",
    backgroundSecondary: "#F3F4F6",
    card: "#FFFFFF",
    border: "#E5E7EB",
    inputBackground: "#F9FAFB",
    tint: "#6C63FF",
    tabIconDefault: "#9CA3AF",
    tabIconSelected: "#6C63FF",
    error: "#EF4444",
    success: "#10B981",
    warning: "#F59E0B",
  },

  dark: {
    text: "#FAFAFA",
    textSecondary: "#A1A1AA",
    textMuted: "#71717A",
    background: "#0A0A0A",
    backgroundSecondary: "#18181B",
    card: "#1C1C1E",
    border: "#2E2E30",
    inputBackground: "#1C1C1E",
    tint: "#8B83FF",
    tabIconDefault: "#71717A",
    tabIconSelected: "#8B83FF",
    error: "#F87171",
    success: "#34D399",
    warning: "#FBBF24",
  },
};

export type ThemeColors = typeof Colors.light;

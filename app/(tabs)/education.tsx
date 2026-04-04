import React from "react";
import { View, Text } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { BookOpen } from "lucide-react-native";

export default function EducationScreen() {
  const { theme } = useThemeStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <View className="px-5 pt-4 pb-3">
        <Text className="text-2xl font-bold" style={{ color: colors.text }}>
          Education
        </Text>
      </View>
      <View className="flex-1 items-center justify-center px-10">
        <View className="w-20 h-20 rounded-full items-center justify-center mb-4 bg-[#6C63FF]/10">
          <BookOpen size={36} color="#6C63FF" strokeWidth={1.5} />
        </View>
        <Text
          className="text-lg font-semibold mb-2 text-center"
          style={{ color: colors.text }}
        >
          Learning Resources
        </Text>
        <Text
          className="text-sm text-center"
          style={{ color: colors.textSecondary }}
        >
          Browse and contribute educational materials
        </Text>
      </View>
    </SafeAreaView>
  );
}

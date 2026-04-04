import React from "react";
import { View, Text, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { ArrowLeft } from "lucide-react-native";

export default function NotificationsScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      {/* Header */}
      <View className="flex-row items-center px-5 pt-4 pb-6 border-b border-gray-100 dark:border-[#2C2C2E]">
        <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-4">
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>
          Notifications
        </Text>
      </View>

      <View className="flex-1 px-5 justify-center items-center">
        <Text className="text-lg text-center" style={{ color: colors.textSecondary }}>
          You have no new notifications.
        </Text>
      </View>
    </SafeAreaView>
  );
}

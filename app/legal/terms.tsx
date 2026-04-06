import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";

export default function TermsOfServiceScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-5 py-4 border-b flex-row items-center" style={{ borderColor: theme === "dark" ? "#2C2C2E" : "#E5E7EB" }}>
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-[#6C63FF]/10 mr-3"
        >
          <ArrowLeft size={20} color="#6C63FF" />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>Terms of Service</Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-6 pb-20">
        <Text className="text-sm mb-6" style={{ color: colors.textSecondary }}>Last Updated: October 2026</Text>

        <Text className="text-base font-bold mb-2" style={{ color: colors.text }}>1. Acceptance of Terms</Text>
        <Text className="text-sm mb-6 leading-6" style={{ color: colors.textSecondary }}>
          By accessing or using Cryptonians, you agree to be bound by these Terms of Service. If you disagree with any part of the terms, you may not access our services.
        </Text>

        <Text className="text-base font-bold mb-2" style={{ color: colors.text }}>2. User Conduct & Niches</Text>
        <Text className="text-sm mb-6 leading-6" style={{ color: colors.textSecondary }}>
          Users are expected to communicate respectfully within Niches and Direct Messages. Spam, harassment, and sharing malicious links are strictly prohibited and may result in immediate account termination.
        </Text>

        <Text className="text-base font-bold mb-2" style={{ color: colors.text }}>3. Educational Material</Text>
        <Text className="text-sm mb-6 leading-6" style={{ color: colors.textSecondary }}>
          Materials uploaded to the Education Hub must not infringe on third-party copyrights. Cryptonians is not responsible for user-generated content, though administrators reserve the right to remove non-compliant documents.
        </Text>

        <Text className="text-base font-bold mb-2" style={{ color: colors.text }}>4. Account Security</Text>
        <Text className="text-sm mb-6 leading-6" style={{ color: colors.textSecondary }}>
          You are responsible for safeguarding your login credentials. Notify us immediately of any unauthorized use of your account.
        </Text>

        <Text className="text-base font-bold mb-2" style={{ color: colors.text }}>5. Moderation</Text>
        <Text className="text-sm mb-8 leading-6" style={{ color: colors.textSecondary }}>
          Moderators and administrators reserve the right to revoke membership from specific Niches, delete posts, and ban accounts violating community guidelines.
        </Text>

        <View className="items-center mb-12">
          <Text className="text-xs font-bold text-[#6C63FF]">Cryptonians Hub</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

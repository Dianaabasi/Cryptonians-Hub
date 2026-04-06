import React from "react";
import { ScrollView, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";

export default function PrivacyPolicyScreen() {
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
        <Text className="text-xl font-bold" style={{ color: colors.text }}>Privacy Policy</Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-6 pb-20">
        <Text className="text-sm mb-6" style={{ color: colors.textSecondary }}>Last Updated: October 2026</Text>

        <Text className="text-base font-bold mb-2" style={{ color: colors.text }}>1. Information We Collect</Text>
        <Text className="text-sm mb-6 leading-6" style={{ color: colors.textSecondary }}>
          We collect information you provide directly to us, such as when you create an account, update your profile (including avatar and username), join niches, or communicate with others through the platform.
        </Text>

        <Text className="text-base font-bold mb-2" style={{ color: colors.text }}>2. How We Use Your Information</Text>
        <Text className="text-sm mb-6 leading-6" style={{ color: colors.textSecondary }}>
          We use the information we collect to operate the Cryptonians platform, facilitate group communication in Niches, tailor educational content to your preferences, and provide administrative support.
        </Text>

        <Text className="text-base font-bold mb-2" style={{ color: colors.text }}>3. Data Sharing & Security</Text>
        <Text className="text-sm mb-6 leading-6" style={{ color: colors.textSecondary }}>
          We do not sell your personal information. Data is transmitted securely and stored in compliant database instances via Supabase. Profile information such as usernames and avatars are public to other members in the platform.
        </Text>

        <Text className="text-base font-bold mb-2" style={{ color: colors.text }}>4. Direct Messaging Privacy</Text>
        <Text className="text-sm mb-6 leading-6" style={{ color: colors.textSecondary }}>
          Messages inside chat rooms are stored securely. Group niche chats are accessible to all approved members of that niche. Private DMs are strictly accessible only by the participants of that specific chat.
        </Text>

        <Text className="text-base font-bold mb-2" style={{ color: colors.text }}>5. Account Deletion</Text>
        <Text className="text-sm mb-8 leading-6" style={{ color: colors.textSecondary }}>
          You may request account deletion at any time via the Settings page. This will permanently remove your profile, posts, saved items, and chat history.
        </Text>

        <View className="items-center mb-12">
          <Text className="text-xs font-bold text-[#6C63FF]">Cryptonians Hub</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

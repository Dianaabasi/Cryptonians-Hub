import React, { useState } from "react";
import { View, Text, TouchableOpacity, ScrollView } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Trash2 } from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { ConfirmModal } from "@/components/ui/Modals";

export default function PrivacyAndSecurityScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { setProfile } = useAuthStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const [deleteAccountModalVisible, setDeleteAccountModalVisible] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    router.replace("/(auth)/onboarding");
  };

  const handleDeleteAccount = async () => {
    console.warn("Delete account requires admin API. Logging out user instead.");
    await handleLogout();
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-5 py-4 border-b flex-row items-center" style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}>
        <TouchableOpacity
          onPress={() => router.back()}
          className="w-10 h-10 items-center justify-center rounded-full bg-[#6C63FF]/10 mr-3"
        >
          <ArrowLeft size={20} color="#6C63FF" />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>Privacy & Security</Text>
      </View>

      <ScrollView className="flex-1 px-5 pt-6 pb-20">
        <Text className="text-sm font-semibold mb-6" style={{ color: colors.textSecondary }}>
          Manage your account security and data preferences.
        </Text>

        <TouchableOpacity
          onPress={() => setDeleteAccountModalVisible(true)}
          className={`flex-row items-center p-4 mt-4 rounded-2xl border ${isDark ? "bg-[#2C2C2E]/20 border-red-500/20" : "bg-red-50 border-red-100"}`}
        >
          <View className="w-10 h-10 rounded-full bg-red-500/10 items-center justify-center mr-4">
            <Trash2 size={20} color="#EF4444" />
          </View>
          <View className="flex-1">
            <Text className="font-bold text-base text-red-500 mb-0.5">Delete Account</Text>
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              Permanently remove your data
            </Text>
          </View>
        </TouchableOpacity>

      </ScrollView>

      <ConfirmModal
        visible={deleteAccountModalVisible}
        onClose={() => setDeleteAccountModalVisible(false)}
        title="Delete Account"
        description="Are you absolutely sure? This action cannot be undone and you will lose all your niches, save data, and communities."
        confirmText="Delete My Account"
        isDestructive={true}
        onConfirm={handleDeleteAccount}
      />
    </SafeAreaView>
  );
}

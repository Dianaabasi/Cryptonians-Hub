import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { ConfirmModal } from "@/components/ui/Modals";
import Constants from "expo-constants";
import { useRouter, useFocusEffect } from "expo-router";
import {
  Bell,
  ChevronRight,
  FileText,
  HelpCircle,
  Info,
  LogOut,
  Moon,
  Shield
} from "lucide-react-native";
import React, { useState, useCallback } from "react";
import {
  Image,
  ScrollView,
  Switch,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function SettingsScreen() {
  const router = useRouter();
  const { profile, setProfile } = useAuthStore();
  const { theme, toggleTheme } = useThemeStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const [logoutModalVisible, setLogoutModalVisible] = useState(false);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    router.replace("/(auth)/onboarding");
  };

  const [supportDot, setSupportDot] = useState(false);
  const isStaff = profile?.role === "admin" || profile?.role === "mod";

  // Check for unread support activity
  const checkSupportDot = useCallback(async () => {
    if (!profile?.id) return;
    if (isStaff) {
      // Admin/mod: any open ticket means action needed
      const { count } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      setSupportDot((count ?? 0) > 0);
    } else {
      // Member: any ticket marked as in_progress indicates a staff reply
      const { count } = await supabase
        .from("support_tickets")
        .select("id", { count: "exact", head: true })
        .eq("user_id", profile.id)
        .eq("status", "in_progress");
      setSupportDot((count ?? 0) > 0);
    }
  }, [profile?.id, profile?.role]);

  useFocusEffect(useCallback(() => { checkSupportDot(); }, [checkSupportDot]));


  const OptionRow = ({ icon: Icon, title, onPress, rightElement }: any) => (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      className={`flex-row items-center justify-between p-4 mb-2 rounded-2xl ${isDark ? "bg-[#1C1C1E]" : "bg-white border border-gray-100"}`}
    >
      <View className="flex-row items-center">
        <View className="w-10 h-10 rounded-full bg-[#6C63FF]/10 items-center justify-center mr-3">
          <Icon size={20} color="#6C63FF" />
        </View>
        <Text
          className="font-semibold text-base"
          style={{ color: colors.text }}
        >
          {title}
        </Text>
        {title.includes("Support") && supportDot && (
          <View className="w-2 h-2 rounded-full bg-[#6C63FF] ml-2" />
        )}
      </View>
      {rightElement || <ChevronRight size={20} color={colors.textSecondary} />}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <ScrollView
        className="flex-1 px-5 pt-4 pb-32"
        showsVerticalScrollIndicator={false}
      >
        <Text
          className="text-2xl font-bold mb-6"
          style={{ color: colors.text }}
        >
          Settings
        </Text>

        {/* Profile Card */}
        <TouchableOpacity
          onPress={() => router.push(`/profile/${profile?.id}`)}
          className={`flex-row p-4 rounded-3xl mb-6 items-center ${isDark ? "bg-[#1C1C1E] border border-[#2C2C2E]" : "bg-white border border-gray-100"}`}
        >
          <View
            className="w-16 h-16 rounded-full mr-4 items-center justify-center"
            style={{ backgroundColor: isDark ? "#2C2C2E" : "#F3F4F6" }}
          >
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                className="w-16 h-16 rounded-full"
              />
            ) : (
              <Text
                className="text-xl font-bold"
                style={{ color: colors.textSecondary }}
              >
                {profile?.username?.charAt(0).toUpperCase()}
              </Text>
            )}
          </View>

          <View className="flex-1">
            <Text
              className="text-lg font-bold mb-0.5"
              style={{ color: colors.text }}
            >
              {profile?.full_name}
            </Text>
            <Text className="text-sm" style={{ color: colors.textSecondary }}>
              @{profile?.username}
            </Text>
          </View>

          <ChevronRight size={20} color={colors.textSecondary} />
        </TouchableOpacity>

        {/* Account Settings */}
        <Text
          className="text-xs font-bold uppercase tracking-wider mb-3 ml-2 mt-2"
          style={{ color: colors.textSecondary }}
        >
          Account
        </Text>
        <OptionRow
          icon={Shield}
          title="Privacy & Security"
          onPress={() => {}}
        />

        {/* Preferences */}
        <Text
          className="text-xs font-bold uppercase tracking-wider mb-3 ml-2 mt-4"
          style={{ color: colors.textSecondary }}
        >
          Preferences
        </Text>
        <OptionRow
          icon={Bell}
          title="Notifications"
          onPress={() => router.push("/notifications")}
        />
        <OptionRow
          icon={Moon}
          title="Dark Mode"
          rightElement={
            <Switch
              value={isDark}
              onValueChange={toggleTheme}
              trackColor={{ false: "#767577", true: "#6C63FF" }}
            />
          }
        />

        {/* Legal & Support */}
        <Text
          className="text-xs font-bold uppercase tracking-wider mb-3 ml-2 mt-4"
          style={{ color: colors.textSecondary }}
        >
          Support & Legal
        </Text>
        <OptionRow
          icon={HelpCircle}
          title={isStaff ? "Support Inbox" : "Support"}
          onPress={() => router.push("/support")}
        />
        <OptionRow
          icon={FileText}
          title="Terms of Service"
          onPress={() => {}}
        />
        <OptionRow icon={Info} title="Privacy Policy" onPress={() => {}} />

        {/* Log Out */}
        <TouchableOpacity
          onPress={() => setLogoutModalVisible(true)}
          className={`flex-row items-center justify-center p-4 mt-8 rounded-2xl border ${isDark ? "bg-[#2C2C2E]/50 border-red-500/20" : "bg-red-50 border-red-100"}`}
        >
          <LogOut size={20} color="#EF4444" />
          <Text className="font-bold text-lg text-red-500 ml-2">Log Out</Text>
        </TouchableOpacity>

        {/* App Version */}
        <View className="items-center mt-8 pb-10">
          <Text
            className="text-xs font-medium"
            style={{ color: colors.textSecondary }}
          >
            Cryptonians v{Constants.expoConfig?.version || "1.0.0"}
          </Text>
        </View>
      </ScrollView>

      <ConfirmModal
        visible={logoutModalVisible}
        onClose={() => setLogoutModalVisible(false)}
        title="Log Out"
        description="Are you sure you want to log out of your Cryptonians account?"
        confirmText="Log Out"
        isDestructive={true}
        onConfirm={handleLogout}
      />
    </SafeAreaView>
  );
}

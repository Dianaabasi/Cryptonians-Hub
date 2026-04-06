import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { Colors } from "@/constants/Colors";
import { ArrowLeft, Bell, MessageSquare, BookOpen, UserPlus, Info, Check } from "lucide-react-native";
import { supabase } from "@/lib/supabase";

interface AppNotification {
  id: string;
  type: string;
  reference_id: string;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
  actor_id: string | null;
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { profile } = useAuthStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchNotifications = async () => {
    if (!profile?.id) return;
    try {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      setNotifications(data as AppNotification[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchNotifications();
  }, [profile?.id]);

  const markAllAsRead = async () => {
    if (!profile?.id) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("user_id", profile.id).eq("read", false);
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [profile?.id]);

  const getIconForType = (type: string) => {
    switch (type) {
      case "new_message":
        return <MessageSquare size={20} color="#3B82F6" />;
      case "new_material":
      case "material_approved":
        return <BookOpen size={20} color="#10B981" />;
      case "new_post":
        return <Bell size={20} color="#6C63FF" />;
      case "niche_request":
        return <UserPlus size={20} color="#F59E0B" />;
      default:
        return <Info size={20} color={colors.textSecondary} />;
    }
  };

  const getIconBackground = (type: string) => {
    switch (type) {
      case "new_message": return isDark ? "bg-blue-500/10" : "bg-blue-50";
      case "new_material":
      case "material_approved": return isDark ? "bg-emerald-500/10" : "bg-emerald-50";
      case "new_post": return isDark ? "bg-[#6C63FF]/10" : "bg-[#6C63FF]/5";
      case "niche_request": return isDark ? "bg-amber-500/10" : "bg-amber-50";
      default: return isDark ? "bg-gray-800" : "bg-gray-100";
    }
  };

  const handleNotificationPress = (notif: AppNotification) => {
    // Navigate based on type
    if (notif.type === "new_message" && notif.reference_id) {
      router.push(`/chat/${notif.reference_id}` as any);
    } else if ((notif.type === "new_material" || notif.type === "material_approved") && notif.reference_id) {
      router.push(`/education/viewer/${notif.reference_id}` as any);
    } else if (notif.type === "new_post" && notif.reference_id) {
      router.push(`/niche/${notif.reference_id}` as any);
    }
    // Mark securely as read when pressed
    if (!notif.read) {
      markAsRead(notif.id);
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    return (
      <TouchableOpacity 
        onPress={() => handleNotificationPress(item)}
        className={`flex-row p-4 border-b ${!item.read ? (isDark ? "bg-[#1C1C1E]" : "bg-blue-50/30") : ""}`}
        style={{ borderColor: isDark ? "#2C2C2E" : "#F3F4F6" }}
      >
        <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${getIconBackground(item.type)}`}>
          {getIconForType(item.type)}
        </View>

        <View className="flex-1 justify-center">
          <View className="flex-row items-baseline justify-between mb-1 text-right">
            <Text className="font-bold text-sm flex-1 mr-2" style={{ color: colors.text }}>
              {item.title}
            </Text>
            <Text className="text-[10px]" style={{ color: colors.textSecondary }}>
              {new Date(item.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
            </Text>
          </View>
          
          <Text className="text-xs" style={{ color: colors.textSecondary, lineHeight: 18 }}>
            {item.message}
          </Text>
        </View>

        {!item.read && (
          <TouchableOpacity 
            onPress={() => markAsRead(item.id)}
            className={`ml-3 self-center p-2 rounded-full ${isDark ? "bg-[#2C2C2E]" : "bg-[#6C63FF]/10"}`}
          >
            <Check size={16} color="#6C63FF" />
          </TouchableOpacity>
        )}
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <View className="flex-row items-center justify-between px-5 pt-4 pb-4 border-b" style={{ borderColor: isDark ? "#2C2C2E" : "#F3F4F6" }}>
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2">
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-xl font-bold" style={{ color: colors.text }}>
            Notifications
          </Text>
        </View>
        <TouchableOpacity onPress={markAllAsRead}>
          <Text className="text-sm font-bold text-[#6C63FF]">Mark all read</Text>
        </TouchableOpacity>
      </View>

      {loading ? (
        <View className="flex-1 justify-center items-center">
          <ActivityIndicator size="large" color="#6C63FF" />
        </View>
      ) : notifications.length > 0 ? (
        <FlatList
          data={notifications}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />
          }
        />
      ) : (
        <View className="flex-1 justify-center items-center px-5">
          <View className={`w-20 h-20 rounded-full items-center justify-center mb-4 ${isDark ? "bg-[#1C1C1E]" : "bg-gray-100"}`}>
            <Bell size={32} color={colors.textSecondary} />
          </View>
          <Text className="text-lg font-bold mb-2" style={{ color: colors.text }}>
            All caught up!
          </Text>
          <Text className="text-sm border-gray-100 text-center" style={{ color: colors.textSecondary }}>
            You have no new notifications right now.
          </Text>
        </View>
      )}
    </SafeAreaView>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import { View, Text, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl, Modal } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useThemeStore } from "@/stores/themeStore";
import { useAuthStore } from "@/stores/authStore";
import { Colors } from "@/constants/Colors";
import { ArrowLeft, Bell, MessageSquare, BookOpen, UserPlus, Info, Check, Heart, AtSign, MessageCircle, Trash2, AlertTriangle } from "lucide-react-native";
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
  const [showClearModal, setShowClearModal] = useState(false);

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

    if (!profile?.id) return;
    const channel = supabase.channel(`public:notifications:${profile.id}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${profile.id}` }, () => {
        fetchNotifications();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [profile?.id]);

  const markAllAsRead = async () => {
    if (!profile?.id) return;
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
    await supabase.from("notifications").update({ read: true }).eq("user_id", profile.id).eq("read", false);
  };

  const confirmClearAll = async () => {
    if (!profile?.id) return;
    setShowClearModal(false);
    setNotifications([]);
    await supabase.from("notifications").delete().eq("user_id", profile.id);
  };

  const markAsRead = async (id: string) => {
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    await supabase.from("notifications").update({ read: true }).eq("id", id);
  };

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNotifications();
  }, [profile?.id]);

  const getIconForType = (type: string, title?: string) => {
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
      case "post_like":
        return <Heart size={20} color="#EF4444" />;
      case "post_comment":
      case "comment_reply":
        return <MessageCircle size={20} color="#6C63FF" />;
      case "mention":
        return <AtSign size={20} color="#10B981" />;
      case "system":
        if (title === "New Like") return <Heart size={20} color="#EF4444" />;
        if (title === "New Comment" || title === "New Reply") return <MessageCircle size={20} color="#6C63FF" />;
        return <Info size={20} color={colors.textSecondary} />;
      default:
        return <Info size={20} color={colors.textSecondary} />;
    }
  };

  const getIconBackground = (type: string, title?: string) => {
    switch (type) {
      case "new_message": return isDark ? "bg-blue-500/10" : "bg-blue-50";
      case "new_material":
      case "material_approved": return isDark ? "bg-emerald-500/10" : "bg-emerald-50";
      case "new_post":
      case "post_comment":
      case "comment_reply": return isDark ? "bg-[#6C63FF]/10" : "bg-[#6C63FF]/5";
      case "niche_request": return isDark ? "bg-amber-500/10" : "bg-amber-50";
      case "post_like": return isDark ? "bg-red-500/10" : "bg-red-50";
      case "mention": return isDark ? "bg-emerald-500/10" : "bg-emerald-50";
      case "system":
        if (title === "New Like") return isDark ? "bg-red-500/10" : "bg-red-50";
        if (title === "New Comment" || title === "New Reply") return isDark ? "bg-[#6C63FF]/10" : "bg-[#6C63FF]/5";
        return isDark ? "bg-gray-800" : "bg-gray-100";
      default: return isDark ? "bg-gray-800" : "bg-gray-100";
    }
  };

  const handleNotificationPress = (notif: AppNotification) => {
    if (!notif.read) markAsRead(notif.id);

    if (notif.type === "new_message" && notif.reference_id) {
      router.push(`/chat/${notif.reference_id}` as any);
    } else if ((notif.type === "new_material" || notif.type === "material_approved") && notif.reference_id) {
      router.push(`/education/viewer/${notif.reference_id}` as any);
    } else if (notif.type === "new_post" && notif.reference_id) {
      router.push(`/post/${notif.reference_id}` as any);
    } else if (
      (notif.type === "post_like" || notif.type === "post_comment" ||
       notif.type === "comment_reply" || notif.type === "mention" ||
       (notif.type === "system" && (notif.title === "New Like" || notif.title === "New Comment" || notif.title === "New Reply"))) &&
      notif.reference_id
    ) {
      router.push(`/post/${notif.reference_id}` as any);
    }
  };

  const renderItem = ({ item }: { item: AppNotification }) => {
    return (
      <TouchableOpacity
        onPress={() => handleNotificationPress(item)}
        className={`flex-row p-4 border-b ${!item.read ? (isDark ? "bg-[#1C1C1E]" : "bg-blue-50/30") : ""}`}
        style={{ borderColor: isDark ? "#2C2C2E" : "#F3F4F6" }}
      >
        <View className={`w-12 h-12 rounded-full items-center justify-center mr-4 ${getIconBackground(item.type, item.title)}`}>
          {getIconForType(item.type, item.title)}
        </View>

        <View className="flex-1 justify-center">
          <View className="flex-row items-baseline justify-between mb-1">
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
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 pt-4 pb-4 border-b" style={{ borderColor: isDark ? "#2C2C2E" : "#F3F4F6" }}>
        <View className="flex-row items-center">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2 mr-2">
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-xl font-bold" style={{ color: colors.text }}>
            Notifications
          </Text>
        </View>
        {notifications.length > 0 && (
          <View className="flex-row items-center gap-4">
            <TouchableOpacity onPress={markAllAsRead}>
              <Text className="text-sm font-semibold text-[#6C63FF]">Mark All as Read</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowClearModal(true)} className="p-1">
              <Trash2 size={18} color="#EF4444" />
            </TouchableOpacity>
          </View>
        )}
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
          <Text className="text-sm text-center" style={{ color: colors.textSecondary }}>
            You have no new notifications right now.
          </Text>
        </View>
      )}

      {/* ── Clear All Confirmation Modal ── */}
      <Modal visible={showClearModal} transparent animationType="fade" onRequestClose={() => setShowClearModal(false)}>
        <TouchableOpacity
          activeOpacity={1}
          className="flex-1 bg-black/60 justify-center items-center px-6"
          onPress={() => setShowClearModal(false)}
        >
          <View
            className="w-full rounded-3xl p-8 shadow-2xl items-center border"
            style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFF", borderColor: isDark ? "#2C2C2E" : "#F3F4F6" }}
          >
            {/* Icon */}
            <View className="w-16 h-16 rounded-full bg-red-500/15 items-center justify-center mb-5">
              <AlertTriangle size={30} color="#EF4444" />
            </View>

            <Text className="text-xl font-bold mb-2 text-center" style={{ color: colors.text }}>
              Clear All Notifications
            </Text>
            <Text className="text-sm text-center mb-8 leading-6" style={{ color: colors.textSecondary }}>
              This will permanently delete all your notifications. This action cannot be undone.
            </Text>

            <View className="w-full flex-row gap-3">
              <TouchableOpacity
                className="flex-1 py-3.5 rounded-2xl items-center border"
                style={{ borderColor: isDark ? "#3C3C3E" : "#E5E7EB", backgroundColor: isDark ? "#2C2C2E" : "#F3F4F6" }}
                onPress={() => setShowClearModal(false)}
              >
                <Text className="font-semibold text-base" style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                className="flex-1 py-3.5 rounded-2xl items-center bg-red-500"
                onPress={confirmClearAll}
              >
                <Text className="font-semibold text-base text-white">Clear All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

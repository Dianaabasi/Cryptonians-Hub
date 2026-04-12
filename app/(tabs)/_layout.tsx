import React, { useEffect, useCallback } from "react";
import { Tabs } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import {
  Home,
  MessageCircle,
  Users,
  BookOpen,
  Settings,
} from "lucide-react-native";
import { useThemeStore } from "@/stores/themeStore";
import { useUIStore } from "@/stores/uiStore";
import { Colors } from "@/constants/Colors";

export default function TabLayout() {
  const { theme } = useThemeStore();
  const { profile } = useAuthStore();
  const { isTabBarVisible, unreadDmCount, setUnreadDmCount } = useUIStore();

  const fetchGlobalUnreadChats = useCallback(async () => {
    if (!profile?.id) return;
    try {
      // Only look at direct (1-on-1) chat rooms — exclude niche group chats
      const { data: directRooms } = await supabase
        .from("chat_rooms")
        .select("id")
        .eq("is_direct", true);

      if (!directRooms?.length) {
        setUnreadDmCount(0);
        return;
      }

      const directRoomIds = directRooms.map((r) => r.id);

      const { data: participations } = await supabase
        .from("chat_participants")
        .select("chat_id, last_read_at")
        .eq("user_id", profile.id)
        .in("chat_id", directRoomIds);

      if (!participations?.length) {
        setUnreadDmCount(0);
        return;
      }

      const chatIds = participations.map((p) => p.chat_id);

      const { data: recentMsgs } = await supabase
        .from("chat_messages")
        .select("chat_id, created_at, sender_id")
        .in("chat_id", chatIds)
        .order("created_at", { ascending: false });

      if (!recentMsgs) return;

      const latestPerChat = new Map();
      for (const m of recentMsgs) {
        if (!latestPerChat.has(m.chat_id)) latestPerChat.set(m.chat_id, m);
      }

      let unread = 0;
      for (const p of participations) {
        const msg = latestPerChat.get(p.chat_id);
        if (!msg || msg.sender_id === profile.id) continue;
        if (
          !p.last_read_at ||
          new Date(msg.created_at) > new Date(p.last_read_at)
        ) {
          unread++;
        }
      }
      setUnreadDmCount(unread);
    } catch (err) {
      console.error("Global chat unread check error:", err);
    }
  }, [profile?.id]);

  useEffect(() => {
    fetchGlobalUnreadChats();
  }, [fetchGlobalUnreadChats]);
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.tabIconSelected,
        tabBarInactiveTintColor: colors.tabIconDefault,
        tabBarStyle: {
          display: isTabBarVisible ? "flex" : "none",
          position: "absolute",
          bottom: 20,
          left: 20,
          right: 20,
          backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
          borderTopWidth: 0,
          borderRadius: 30,
          height: 65,
          paddingBottom: 0,
          shadowColor: "#000",
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.15,
          shadowRadius: 15,
          elevation: 10,
        },
        tabBarLabelStyle: {
          fontSize: 10,
          fontWeight: "600",
          marginTop: 2,
        },
        tabBarItemStyle: {
          justifyContent: "center",
          alignItems: "center",
          paddingTop: 8,
          paddingBottom: 8,
        },
        tabBarBadgeStyle: {
          backgroundColor: "#6C63FF",
          color: "#FFF",
          fontSize: 10,
          minWidth: 18,
          height: 18,
          lineHeight: 18,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: "Home",
          tabBarIcon: ({ color, size }) => (
            <Home size={size} color={color} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="chats"
        options={{
          title: "Chats",
          tabBarBadge: unreadDmCount > 0 ? unreadDmCount : undefined,
          tabBarIcon: ({ color, size }) => (
            <MessageCircle size={size} color={color} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="niches"
        options={{
          title: "Niches",
          tabBarIcon: ({ color, size }) => (
            <Users size={size} color={color} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="education"
        options={{
          title: "Education",
          tabBarIcon: ({ color, size }) => (
            <BookOpen size={size} color={color} strokeWidth={1.8} />
          ),
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: "Settings",
          tabBarIcon: ({ color, size }) => (
            <Settings size={size} color={color} strokeWidth={1.8} />
          ),
        }}
      />
    </Tabs>
  );
}

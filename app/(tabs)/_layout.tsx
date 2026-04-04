import React from "react";
import { Tabs } from "expo-router";
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
  const { isTabBarVisible, unreadDmCount } = useUIStore();
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

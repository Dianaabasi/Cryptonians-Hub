import React, { useState, useEffect, useCallback } from "react";
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
  Modal,
  TextInput,
  FlatList,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { AppModal, useAppModal } from "@/components/ui/AppModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { useUIStore } from "@/stores/uiStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { SkeletonChatRow } from "@/components/ui/SkeletonLoader";
import { MessageSquare, Plus, Search, X, Check, ChevronRight } from "lucide-react-native";

interface ChatRoom {
  id: string;
  is_direct: boolean;
  name?: string;
  participants?: any[];
  latest_message?: any;
}

interface UserResult {
  id: string;
  full_name: string;
  username: string;
  avatar_url: string | null;
}

export default function ChatsScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { profile } = useAuthStore();
  const { setTabBarVisible, setUnreadDmCount } = useUIStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const [chats, setChats] = useState<ChatRoom[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // New chat modal state
  const [newChatVisible, setNewChatVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<UserResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [startingChat, setStartingChat] = useState<string | null>(null);
  const [localSearchQuery, setLocalSearchQuery] = useState("");
  const { showModal, modalProps } = useAppModal();

  const fetchChats = async () => {
    if (!profile?.id) return;
    try {
      // Only fetch DIRECT (1-on-1) chat rooms via RLS
      const { data, error } = await supabase
        .from("chat_rooms")
        .select(`
          id,
          is_direct,
          name,
          participants:chat_participants(user:profiles(id, full_name, username, avatar_url))
        `)
        .eq("is_direct", true)
        .order("created_at", { ascending: false });

      if (error) {
        console.error("fetchChats error:", JSON.stringify(error));
        return;
      }

      // Fetch latest message per chat
      const chatIds = data?.map((c) => c.id) || [];
      let messagesMap: Record<string, any> = {};

      if (chatIds.length > 0) {
        const { data: messages } = await supabase
          .from("chat_messages")
          .select("id, chat_id, content, created_at, sender_id, media_type")
          .in("chat_id", chatIds)
          .order("created_at", { ascending: false });

        if (messages) {
          messages.forEach((msg) => {
            if (!messagesMap[msg.chat_id]) {
              messagesMap[msg.chat_id] = msg;
            }
          });
        }

        // Fetch my last_read_at per chat to determine unread state
        const { data: myParticipations } = await supabase
          .from("chat_participants")
          .select("chat_id, last_read_at")
          .eq("user_id", profile.id)
          .in("chat_id", chatIds);

        if (myParticipations) {
          myParticipations.forEach((p) => {
            if (messagesMap[p.chat_id]) {
              messagesMap[p.chat_id]._my_last_read_at = p.last_read_at;
            }
          });
        }
      }

      const formatted = (data || []).map((c: any) => ({
        ...c,
        latest_message: messagesMap[c.id],
      }));

      // Sort by latest message date descending
      formatted.sort((a, b) => {
        const dateA = new Date(
          a.latest_message?.created_at || "2000-01-01"
        ).getTime();
        const dateB = new Date(
          b.latest_message?.created_at || "2000-01-01"
        ).getTime();
        return dateB - dateA;
      });

      setChats(formatted);

      // Update tab badge: only count unread DMs (is_direct=true is already ensured by fetchChats query)
      const unread = formatted.filter((c) => {
        const msg = c.latest_message;
        if (!msg || msg.sender_id === profile?.id) return false;
        // Only count messages from others that we haven't read yet
        return msg._my_last_read_at
          ? new Date(msg.created_at) > new Date(msg._my_last_read_at)
          : true;
      }).length;
      setUnreadDmCount(unread);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchChats();
    }, [profile?.id])
  );

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchChats();
  }, [profile?.id]);

  // --- Search users by username ---
  const handleSearch = async (text: string) => {
    setSearchQuery(text);
    if (text.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    setSearching(true);
    try {
      const isAdminOrMod = profile?.role === "admin" || profile?.role === "mod";

      let query = supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, role")
        .ilike("username", `%${text.trim()}%`)
        .not("id", "eq", profile?.id) // exclude self
        .limit(10);

      // Members can only search other members;
      // Admins and mods can search everyone
      if (!isAdminOrMod) {
        query = query.eq("role", "member");
      }

      const { data } = await query;
      setSearchResults(data || []);
    } finally {
      setSearching(false);
    }
  };

  // --- Start or open existing DM with a user ---
  const handleStartChat = async (targetUser: UserResult) => {
    if (!profile?.id) return;
    setStartingChat(targetUser.id);

    try {
      const { data: chatId, error } = await supabase
        .rpc("create_direct_chat", { other_user_id: targetUser.id });

      if (error) throw error;

      setNewChatVisible(false);
      router.push(`/chat/${chatId}` as any);
    } catch (e: any) {
      console.error(e);
      showModal({ title: "Error", message: e?.message || "Could not start chat. Please try again.", variant: "error" });
    } finally {
      setStartingChat(null);
    }
  };

  const getChatMeta = (chat: ChatRoom) => {
    if (chat.is_direct && chat.participants) {
      const other = chat.participants.find(
        (p: any) => p.user?.id !== profile?.id
      );
      if (other?.user) {
        return {
          title: other.user.full_name || other.user.username,
          subtitle: `@${other.user.username}`,
          avatar: other.user.avatar_url,
          initials: (other.user.full_name || other.user.username)
            .charAt(0)
            .toUpperCase(),
        };
      }
    }
    return { title: chat.name || "Chat", subtitle: "", avatar: null, initials: "C" };
  };

  const getRelativeTime = (dateString: string) => {
    if (!dateString) return "";
    const diff = Math.floor(
      (Date.now() - new Date(dateString).getTime()) / 1000
    );
    if (diff < 60) return "now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
    return `${Math.floor(diff / 86400)}d`;
  };

  const filteredChats = chats.filter((chat) => {
    if (!localSearchQuery.trim()) return true;
    const meta = getChatMeta(chat);
    if (!meta) return true;
    const q = localSearchQuery.toLowerCase();
    return (
      (meta.title && meta.title.toLowerCase().includes(q)) ||
      (meta.subtitle && meta.subtitle.toLowerCase().includes(q))
    );
  });

  const renderChatRow = (chat: ChatRoom) => {
    const meta = getChatMeta(chat);
    const msg = chat.latest_message;
    const isMyMessage = msg?.sender_id === profile?.id;

    // Unread = last message is from the other person AND it was sent after I last read the chat
    const isUnread =
      msg &&
      !isMyMessage &&
      msg._my_last_read_at
        ? new Date(msg.created_at) > new Date(msg._my_last_read_at)
        : msg && !isMyMessage; // no last_read_at recorded = treat as unread

    // Message preview label (handle media types)
    const getPreviewText = () => {
      if (!msg) return `Say hello to ${meta.title}!`;
      if (msg.media_type === "image") return "📷 Photo";
      if (msg.media_type === "audio") return "🎤 Voice note";
      return msg.content || "";
    };

    return (
      <TouchableOpacity
        key={chat.id}
        onPress={() => router.push(`/chat/${chat.id}` as any)}
        className="flex-row items-center py-4 border-b"
        style={{ borderColor: isDark ? "#2C2C2E" : "#F3F4F6" }}
      >
        {/* Avatar */}
        <View
          className={`w-14 h-14 rounded-full mr-4 items-center justify-center ${
            isDark ? "bg-[#2C2C2E]" : "bg-gray-100"
          }`}
        >
          {meta.avatar ? (
            <Image source={{ uri: meta.avatar }} className="w-full h-full rounded-full" />
          ) : (
            <Text className="text-xl font-bold" style={{ color: colors.textSecondary }}>
              {meta.initials}
            </Text>
          )}

          {/* Unread dot */}
          {isUnread && (
            <View className="absolute top-0 right-0 w-3.5 h-3.5 rounded-full bg-[#6C63FF] border-2"
              style={{ borderColor: colors.background }}
            />
          )}
        </View>

        {/* Content */}
        <View className="flex-1 justify-center">
          <View className="flex-row justify-between items-center mb-0.5">
            <Text
              className={`text-base flex-1 mr-2 ${isUnread ? "font-bold" : "font-semibold"}`}
              style={{ color: colors.text }}
              numberOfLines={1}
            >
              {meta.title}
            </Text>
            {msg && (
              <Text className="text-xs" style={{ color: isUnread ? "#6C63FF" : colors.textSecondary }}>
                {getRelativeTime(msg.created_at)}
              </Text>
            )}
          </View>

          <View className="flex-row items-center">
            {/* Delivery tick for my messages */}
            {isMyMessage && (
              <Check size={13} color={colors.textSecondary} style={{ marginRight: 3 }} />
            )}
            <Text
              className={`text-sm flex-1 ${isUnread ? "font-semibold" : "font-normal"}`}
              style={{ color: isUnread ? colors.text : colors.textSecondary }}
              numberOfLines={1}
            >
              {getPreviewText()}
            </Text>
          </View>
        </View>
      </TouchableOpacity>
    );
  };


  // ─── New Chat Modal ───────────────────────────────────────────────────────
  const renderNewChatModal = () => (
    <Modal
      visible={newChatVisible}
      animationType="slide"
      transparent
      onRequestClose={() => setNewChatVisible(false)}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        <View className="flex-1 justify-end">
          {/* Backdrop */}
          <TouchableOpacity
            className="absolute inset-0 bg-black/50"
            activeOpacity={1}
            onPress={() => setNewChatVisible(false)}
          />

          <View
            className="rounded-t-3xl overflow-hidden"
            style={{
              backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF",
              maxHeight: "80%",
            }}
          >
            {/* Handle */}
            <View className="items-center pt-3 pb-2">
              <View
                className="w-10 h-1 rounded-full"
                style={{ backgroundColor: isDark ? "#3C3C3E" : "#D1D5DB" }}
              />
            </View>

            {/* Header */}
            <View className="flex-row items-center justify-between px-5 pb-4">
              <Text className="text-xl font-bold" style={{ color: colors.text }}>
                New Message
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setNewChatVisible(false);
                  setSearchQuery("");
                  setSearchResults([]);
                }}
                className="p-2 -mr-2"
              >
                <X size={22} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {/* Search Input */}
            <View className="px-5 pb-4">
              <View
                className="flex-row items-center px-4 py-3 rounded-2xl"
                style={{
                  backgroundColor: isDark ? "#2C2C2E" : "#F3F4F6",
                }}
              >
                <Search size={18} color={colors.textSecondary} />
                <TextInput
                  value={searchQuery}
                  onChangeText={handleSearch}
                  placeholder="Search by username..."
                  placeholderTextColor={colors.textSecondary}
                  autoFocus
                  autoCapitalize="none"
                  autoCorrect={false}
                  className="flex-1 ml-3 text-base"
                  style={{ color: colors.text }}
                />
                {searching && (
                  <ActivityIndicator size="small" color="#6C63FF" />
                )}
              </View>
            </View>

            {/* Results */}
            <FlatList
              data={searchResults}
              keyExtractor={(item) => item.id}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 40 }}
              ListEmptyComponent={
                searchQuery.length >= 2 && !searching ? (
                  <View className="py-10 items-center">
                    <Text
                      className="text-base text-center"
                      style={{ color: colors.textSecondary }}
                    >
                      No users found for "{searchQuery}"
                    </Text>
                  </View>
                ) : searchQuery.length === 0 ? (
                  <View className="py-10 items-center">
                    <Text
                      className="text-base text-center"
                      style={{ color: colors.textSecondary }}
                    >
                      Type a username to find someone
                    </Text>
                  </View>
                ) : null
              }
              renderItem={({ item }) => (
                <TouchableOpacity
                  onPress={() => handleStartChat(item)}
                  disabled={startingChat === item.id}
                  className="flex-row items-center py-3 border-b"
                  style={{ borderColor: isDark ? "#2C2C2E" : "#F3F4F6" }}
                >
                  <View
                    className={`w-12 h-12 rounded-full mr-4 items-center justify-center ${
                      isDark ? "bg-[#2C2C2E]" : "bg-gray-100"
                    }`}
                  >
                    {item.avatar_url ? (
                      <Image
                        source={{ uri: item.avatar_url }}
                        className="w-full h-full rounded-full"
                      />
                    ) : (
                      <Text
                        className="text-lg font-bold"
                        style={{ color: colors.textSecondary }}
                      >
                        {item.full_name?.charAt(0).toUpperCase() ??
                          item.username?.charAt(0).toUpperCase()}
                      </Text>
                    )}
                  </View>
                  <View className="flex-1">
                    <Text
                      className="font-bold text-base"
                      style={{ color: colors.text }}
                    >
                      {item.full_name}
                    </Text>
                    <Text
                      className="text-sm"
                      style={{ color: colors.textSecondary }}
                    >
                      @{item.username}
                    </Text>
                  </View>
                  {startingChat === item.id ? (
                    <ActivityIndicator size="small" color="#6C63FF" />
                  ) : (
                    <ChevronRight size={20} color="#6C63FF" />

                  )}
                </TouchableOpacity>
              )}
            />
          </View>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );

  // ─── Main Screen ──────────────────────────────────────────────────────────
  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-5 pt-4 pb-2 flex-row justify-between items-center z-10">
        <Text className="text-2xl font-bold" style={{ color: colors.text }}>
          Messages
        </Text>
        <TouchableOpacity
          onPress={() => setNewChatVisible(true)}
          className="w-10 h-10 rounded-full bg-[#6C63FF]/10 items-center justify-center"
        >
          <Plus size={22} color="#6C63FF" />
        </TouchableOpacity>
      </View>

      {/* Search Bar */}
      <View className="px-5 mb-4">
        <View
          className={`flex-row items-center px-4 py-1.5 rounded-full ${
            isDark ? "bg-[#1C1C1E]" : "bg-gray-100"
          }`}
        >
          <Search size={18} color={colors.textSecondary} />
          <TextInput
            className="ml-2 flex-1 font-medium text-base h-10"
            style={{ color: colors.text }}
            placeholder="Search messages..."
            placeholderTextColor={colors.textSecondary}
            value={localSearchQuery}
            onChangeText={setLocalSearchQuery}
          />
        </View>
      </View>

      {loading ? (
        <View className="flex-1 px-5 pt-2">
          <SkeletonChatRow isDark={isDark} />
          <SkeletonChatRow isDark={isDark} />
          <SkeletonChatRow isDark={isDark} />
          <SkeletonChatRow isDark={isDark} />
          <SkeletonChatRow isDark={isDark} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5"
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => setTabBarVisible(false)}
          onScrollEndDrag={() => setTabBarVisible(true)}
          onMomentumScrollBegin={() => setTabBarVisible(false)}
          onMomentumScrollEnd={() => setTabBarVisible(true)}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor="#6C63FF"
            />
          }
        >
          {filteredChats.length > 0 ? (
            filteredChats.map(renderChatRow)
          ) : (
            <View className="py-20 items-center justify-center">
              <View className="w-20 h-20 rounded-full bg-[#6C63FF]/10 items-center justify-center mb-4">
                <MessageSquare size={36} color="#6C63FF" />
              </View>
              <Text
                className="text-lg text-center font-bold mb-2"
                style={{ color: colors.text }}
              >
                No messages yet
              </Text>
              <Text
                className="text-center text-base px-8"
                style={{ color: colors.textSecondary }}
              >
                Start a conversation with another Cryptonian using the{" "}
                <Text style={{ color: "#6C63FF" }}>+</Text> button above.
              </Text>
            </View>
          )}
          <View className="h-32" />
        </ScrollView>
      )}

      {renderNewChatModal()}
      <AppModal {...modalProps} />
    </SafeAreaView>
  );
}

import React, { useState, useEffect, useCallback } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl,
  Image, ActivityIndicator, Modal, Platform
} from "react-native";
import { AppModal, useAppModal } from "@/components/ui/AppModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter, useFocusEffect } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Hash, ShieldAlert, Bell, Plus, Camera, UserCheck, X, CheckCircle, XCircle, Users } from "lucide-react-native";
import { PostCard, PostType } from "@/components/ui/PostCard";
import { SkeletonNicheDetail } from "@/components/ui/SkeletonLoader";

function RequestsModal({
  visible,
  onClose,
  nicheId,
  isDark,
  colors,
  onActionComplete,
}: {
  visible: boolean;
  onClose: () => void;
  nicheId: string | null;
  isDark: boolean;
  colors: any;
  onActionComplete: () => void;
}) {
  const [requests, setRequests] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { showModal, modalProps: reqModalProps } = useAppModal();

  useEffect(() => {
    if (visible && nicheId) {
      loadRequests();
    }
  }, [visible, nicheId]);

  const loadRequests = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("niche_join_requests")
        .select(`
          id,
          user_id,
          profiles(full_name, avatar_url, username)
        `)
        .eq("niche_id", nicheId)
        .eq("status", "pending")
        .order("created_at", { ascending: true });

      if (error) throw error;
      setRequests(data || []);
    } catch (e) {
      console.error(e);
      showModal({ title: "Error", message: "Could not load requests.", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleAction = async (requestId: string, userId: string, action: "approve" | "reject") => {
    if (!nicheId) return;
    setProcessingId(requestId);
    try {
      if (action === "approve") {
        // Add to memberships
        const { error: joinError } = await supabase
          .from("niche_memberships")
          .insert({ niche_id: nicheId, user_id: userId });
        if (joinError) throw joinError;

        // Auto-add to chat room if exists
        const { data: nicheRoom } = await supabase
          .from("chat_rooms")
          .select("id")
          .eq("niche_id", nicheId)
          .eq("is_direct", false)
          .limit(1)
          .maybeSingle();

        if (nicheRoom) {
          await supabase
            .from("chat_participants")
            .insert({ chat_id: nicheRoom.id, user_id: userId });
        }
      }

      // 3. Remove the request
      const { error: deleteError } = await supabase
        .from("niche_join_requests")
        .delete()
        .eq("id", requestId);
      if (deleteError) throw deleteError;

      // Update UI
      setRequests((prev) => prev.filter((r) => r.id !== requestId));
      onActionComplete();
      
      // Auto close if empty
      if (requests.length <= 1) {
        onClose();
      }
    } catch (e) {
      console.error(e);
      showModal({ title: "Error", message: `Could not ${action} request.`, variant: "error" });
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View className="flex-1 justify-end bg-black/50">
        <TouchableOpacity className="flex-1" activeOpacity={1} onPress={onClose} />
        <View className="rounded-t-3xl p-6 min-h-[50%]" style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFF", paddingBottom: Platform.OS === "ios" ? 40 : 24 }}>
          <View className="w-10 h-1 rounded-full bg-gray-400/40 self-center mb-6" />
          
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold" style={{ color: colors.text }}>Join Requests</Text>
            <TouchableOpacity onPress={onClose} className="p-2 -mr-2 bg-[#6C63FF]/10 rounded-full">
              <X size={16} color="#6C63FF" />
            </TouchableOpacity>
          </View>

          {loading ? (
            <View className="py-10 items-center justify-center">
              <ActivityIndicator size="large" color="#6C63FF" />
            </View>
          ) : requests.length === 0 ? (
            <View className="py-10 items-center justify-center">
              <UserCheck size={40} color={isDark ? "#2C2C2E" : "#E5E7EB"} />
              <Text className="text-sm mt-4 text-center" style={{ color: colors.textSecondary }}>No pending requests.</Text>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} className="max-h-[60vh]">
              {requests.map((req) => {
                const profile = Array.isArray(req.profiles) ? req.profiles[0] : req.profiles;
                return (
                  <View key={req.id} className={`flex-row items-center p-3 mb-3 rounded-2xl border ${isDark ? "border-[#2C2C2E]" : "border-gray-100"}`}>
                    <View className="w-12 h-12 rounded-full overflow-hidden mr-3 bg-gray-200">
                      {profile?.avatar_url ? (
                        <Image source={{ uri: profile.avatar_url }} className="w-full h-full" />
                      ) : (
                        <View className="w-full h-full items-center justify-center bg-[#6C63FF]/20">
                          <Text className="text-[#6C63FF] font-bold text-lg">{profile?.full_name?.charAt(0) || "?"}</Text>
                        </View>
                      )}
                    </View>
                    <View className="flex-1">
                      <Text className="font-bold text-base" style={{ color: colors.text }} numberOfLines={1}>{profile?.full_name}</Text>
                      <Text className="text-xs" style={{ color: colors.textSecondary }} numberOfLines={1}>@{profile?.username}</Text>
                    </View>
                    <View className="flex-row gap-2">
                       <TouchableOpacity 
                         onPress={() => handleAction(req.id, req.user_id, "reject")}
                         disabled={processingId === req.id}
                         className={`w-10 h-10 items-center justify-center rounded-full bg-gray-100 ${isDark ? "bg-[#2C2C2E]" : ""}`}
                       >
                         <XCircle size={20} color={colors.textSecondary} />
                       </TouchableOpacity>
                       <TouchableOpacity 
                         onPress={() => handleAction(req.id, req.user_id, "approve")}
                         disabled={processingId === req.id}
                         className="w-10 h-10 items-center justify-center rounded-full bg-[#6C63FF]/15"
                       >
                         {processingId === req.id ? <ActivityIndicator size="small" color="#6C63FF" /> : <CheckCircle size={20} color="#6C63FF" />}
                       </TouchableOpacity>
                    </View>
                  </View>
                );
              })}
            </ScrollView>
          )}
        </View>
      </View>
      <AppModal {...reqModalProps} />
    </Modal>
  );
}

interface NicheData {
  id: string;
  name: string;
  description: string;
  banner_url: string | null;
  isMember: boolean;
  hasPendingRequest?: boolean;
  pendingCount?: number;
  membersCount?: number;
}

export default function NicheDetailsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useThemeStore();
  const { profile } = useAuthStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const [activeTab, setActiveTab] = useState<"FEED" | "CHAT" | "ANNOUNCEMENTS">("FEED");
  const [niche, setNiche] = useState<NicheData | null>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [announcements, setAnnouncements] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joining, setJoining] = useState(false);
  const [uploadingBanner, setUploadingBanner] = useState(false);
  const [showRequests, setShowRequests] = useState(false);
  const [hasUnreadNicheChat, setHasUnreadNicheChat] = useState(false);
  const { showModal, modalProps } = useAppModal();

  const isAdminOrMod = profile?.role === "admin" || profile?.role === "mod";

  const fetchNicheData = async () => {
    if (!id || !profile) return;
    try {
      const { data: nicheData } = await supabase
        .from("niches")
        .select("*")
        .eq("id", id)
        .single();

      if (!nicheData) return;

      const { data: membership } = await supabase
        .from("niche_memberships")
        .select("*")
        .eq("niche_id", id)
        .eq("user_id", profile.id)
        .maybeSingle();

      const { data: request } = await supabase
        .from("niche_join_requests")
        .select("*")
        .eq("niche_id", id)
        .eq("user_id", profile.id)
        .eq("status", "pending")
        .maybeSingle();

      const { count: membersCount } = await supabase
        .from("niche_memberships")
        .select("*", { count: 'exact', head: true })
        .eq("niche_id", id);

      let pendingCount = 0;
      if (profile.role === "admin" || profile.role === "mod") {
        const { count } = await supabase
           .from("niche_join_requests")
           .select("*", { count: 'exact', head: true })
           .eq("niche_id", id)
           .eq("status", "pending");
        pendingCount = count || 0;
      }

      setNiche({ 
        ...nicheData, 
        isMember: !!membership,
        hasPendingRequest: !!request,
        pendingCount: pendingCount,
        membersCount: membersCount || 0
      });

      // Fetch normal (non-announcement) posts
      const { data: normalPosts } = await supabase
        .from("posts")
        .select(`
          id, content, image_url, is_job_post, is_announcement, created_at,
          author:author_id(id, full_name, username, avatar_url, role),
          likes:likes(count),
          comments:comments(count)
        `)
        .eq("niche_id", id)
        .not("is_announcement", "is", true)
        .order("created_at", { ascending: false });

      if (normalPosts) {
        setPosts(normalPosts.map((p) => ({
          ...p,
          author: Array.isArray(p.author) ? p.author[0] : p.author,
          likes_count: (p.likes as any)?.[0]?.count ?? 0,
          comments_count: (p.comments as any)?.[0]?.count ?? 0,
          has_liked: false,
        })) as PostType[]);
      }

      // Fetch announcements
      const { data: annoData } = await supabase
        .from("posts")
        .select(`
          id, content, image_url, is_job_post, is_announcement, created_at,
          author:author_id(id, full_name, username, avatar_url, role),
          likes:likes(count),
          comments:comments(count)
        `)
        .eq("niche_id", id)
        .eq("is_announcement", true)
        .order("created_at", { ascending: false });

      if (annoData) {
        setAnnouncements(annoData.map((p) => ({
          ...p,
          author: Array.isArray(p.author) ? p.author[0] : p.author,
          likes_count: (p.likes as any)?.[0]?.count ?? 0,
          comments_count: (p.comments as any)?.[0]?.count ?? 0,
          has_liked: false,
        })) as PostType[]);
      }
      // Check for unread niche group chat messages
      if (membership && profile) {
        const { data: groupRoom } = await supabase
          .from("chat_rooms")
          .select("id")
          .eq("niche_id", id)
          .eq("is_direct", false)
          .limit(1)
          .maybeSingle();

        if (groupRoom) {
          const { data: myPart } = await supabase
            .from("chat_participants")
            .select("last_read_at")
            .eq("chat_id", groupRoom.id)
            .eq("user_id", profile.id)
            .maybeSingle();

          const { data: latestMsg } = await supabase
            .from("chat_messages")
            .select("created_at, sender_id")
            .eq("chat_id", groupRoom.id)
            .order("created_at", { ascending: false })
            .limit(1)
            .maybeSingle();

          if (latestMsg && latestMsg.sender_id !== profile.id) {
            const isUnread = !myPart?.last_read_at ||
              new Date(latestMsg.created_at) > new Date(myPart.last_read_at);
            setHasUnreadNicheChat(isUnread);
          } else {
            setHasUnreadNicheChat(false);
          }
        }
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      fetchNicheData();
    }, [id, profile?.id])
  );

  const onRefresh = () => { setRefreshing(true); fetchNicheData(); };

  // ─── Join / Leave ─────────────────────────────────────────────────────────
  const handleToggleMembership = async () => {
    if (!niche || !profile) return;
    setJoining(true);
    try {
      if (niche.isMember) {
        // Remove from niche group chat participants
        const { data: nicheRoom } = await supabase
          .from("chat_rooms")
          .select("id")
          .eq("niche_id", niche.id)
          .eq("is_direct", false)
          .limit(1)
          .maybeSingle();

        if (nicheRoom) {
          await supabase
            .from("chat_participants")
            .delete()
            .match({ chat_id: nicheRoom.id, user_id: profile.id });
        }

        await supabase
          .from("niche_memberships")
          .delete()
          .match({ niche_id: niche.id, user_id: profile.id });

        setNiche({ ...niche, isMember: false });
      } else {
        if (isAdminOrMod) {
          await supabase
            .from("niche_memberships")
            .insert({ niche_id: niche.id, user_id: profile.id });
          setNiche({ ...niche, isMember: true });
        } else {
          await supabase
            .from("niche_join_requests")
            .insert({ niche_id: niche.id, user_id: profile.id });
          setNiche({ ...niche, hasPendingRequest: true });
        }
      }
    } finally {
      setJoining(false);
    }
  };

  // ─── Banner Upload ────────────────────────────────────────────────────────
  const handleBannerUpload = async () => {
    if (!isAdminOrMod || !niche) return;
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [16, 9],
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets[0].base64) return;

    setUploadingBanner(true);
    try {
      const ext = result.assets[0].uri.split(".").pop() || "jpeg";
      const filename = `niche-${niche.id}-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("niches")
        .upload(filename, decode(result.assets[0].base64), {
          contentType: `image/${ext}`,
          upsert: true,
        });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("niches").getPublicUrl(filename);

      const { error: updateError } = await supabase
        .from("niches")
        .update({ banner_url: urlData.publicUrl })
        .eq("id", niche.id);

      if (updateError) throw updateError;

      setNiche({ ...niche, banner_url: urlData.publicUrl });
    } catch (e: any) {
      showModal({ title: "Upload Failed", message: e.message || "Could not upload banner.", variant: "error" });
    } finally {
      setUploadingBanner(false);
    }
  };

  // ─── Enter Live Chat (auto-enroll in group chat) ──────────────────────────
  const handleOpenChat = async () => {
    if (!niche || !profile) return;

    // Find or create the niche's group chat room
    let chatRoomId: string | null = null;

    const { data: existing } = await supabase
      .from("chat_rooms")
      .select("id")
      .eq("niche_id", niche.id)
      .eq("is_direct", false)
      .limit(1)
      .maybeSingle();

    if (existing) {
      chatRoomId = existing.id;
    } else {
      const { data: newRoom } = await supabase
        .from("chat_rooms")
        .insert({ niche_id: niche.id, is_direct: false, name: `${niche.name} Chat` })
        .select()
        .single();
      if (newRoom) chatRoomId = newRoom.id;
    }

    if (!chatRoomId) return;

    // Auto-add user to participants if not already there
    const { data: alreadyIn } = await supabase
      .from("chat_participants")
      .select("user_id")
      .eq("chat_id", chatRoomId)
      .eq("user_id", profile.id)
      .maybeSingle();

    if (!alreadyIn) {
      await supabase
        .from("chat_participants")
        .insert({ chat_id: chatRoomId, user_id: profile.id });
    }

    router.push(`/chat/${chatRoomId}` as any);
  };

  // ─── Render ───────────────────────────────────────────────────────────────
  if (!niche && loading) {
    return (
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        <ScrollView showsVerticalScrollIndicator={false}>
          <SkeletonNicheDetail isDark={isDark} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const tabBorderColor = isDark ? "#2C2C2E" : "#E5E7EB";

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* ── Banner ── */}
      <View className="relative">
        {niche?.banner_url ? (
          <Image
            source={{ uri: niche.banner_url }}
            className="w-full h-36"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-36 bg-[#6C63FF]/15 items-center justify-center">
            <Hash size={40} color="#6C63FF" />
          </View>
        )}

        {/* Back button */}
        <TouchableOpacity
          onPress={() => router.back()}
          className="absolute top-3 left-3 w-9 h-9 rounded-full bg-black/50 items-center justify-center"
        >
          <ArrowLeft size={20} color="#FFF" />
        </TouchableOpacity>

        {/* Requests Badge Admin Only */}
        {isAdminOrMod && niche?.pendingCount !== undefined && niche.pendingCount > 0 && (
          <TouchableOpacity
            onPress={() => setShowRequests(true)}
            className="absolute top-3 right-14 flex-row items-center bg-red-500 pl-2 pr-3 py-1.5 rounded-full z-20"
          >
            <Users size={14} color="#FFF" />
            <Text className="text-white text-xs font-bold ml-1.5">{niche.pendingCount}</Text>
          </TouchableOpacity>
        )}

        {/* Camera upload for admins/mods */}
        {isAdminOrMod && (
          <TouchableOpacity
            onPress={handleBannerUpload}
            disabled={uploadingBanner}
            className="absolute top-3 right-3 w-9 h-9 rounded-full bg-black/50 items-center justify-center"
          >
            {uploadingBanner ? (
              <ActivityIndicator size="small" color="#FFF" />
            ) : (
              <Camera size={18} color="#FFF" />
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Niche Header ── */}
      <View className="px-5 py-3 flex-row justify-between items-center border-b" style={{ borderColor: tabBorderColor }}>
        <View className="flex-1 mr-3">
          <Text className="text-lg font-bold" style={{ color: colors.text }} numberOfLines={1}>
            {niche?.name}
          </Text>
          <Text className="text-xs mb-1" style={{ color: colors.textSecondary }} numberOfLines={1}>
            {niche?.description}
          </Text>
          {niche?.membersCount !== undefined && (
            <View className="flex-row items-center">
              <Users size={12} color={colors.textSecondary} style={{ opacity: 0.7 }} />
              <Text className="text-[10px] font-bold ml-1" style={{ color: colors.textSecondary, opacity: 0.7 }}>
                {niche.membersCount} {niche.membersCount === 1 ? 'Member' : 'Members'}
              </Text>
            </View>
          )}
        </View>

        {niche?.hasPendingRequest && !niche?.isMember ? (
          <TouchableOpacity
            disabled={true}
            className={`px-4 py-2 rounded-full border ${isDark ? "border-[#2C2C2E]" : "border-gray-200"}`}
          >
            <Text className="font-bold text-sm" style={{ color: colors.textSecondary }}>
              Request Sent
            </Text>
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            onPress={handleToggleMembership}
            disabled={joining}
            className={`px-4 py-2 rounded-full border ${niche?.isMember ? (isDark ? "border-[#2C2C2E]" : "border-gray-200") : "border-[#6C63FF] bg-[#6C63FF]"}`}
          >
            {joining ? (
              <ActivityIndicator size="small" color={niche?.isMember ? colors.text : "#FFF"} />
            ) : (
              <Text className={`font-bold text-sm ${niche?.isMember ? "" : "text-white"}`} style={niche?.isMember ? { color: colors.textSecondary } : {}}>
                {niche?.isMember ? "Joined" : "Join"}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* ── Tabs ── */}
      <View className="flex-row border-b" style={{ borderColor: tabBorderColor }}>
        <TouchableOpacity
          className={`flex-1 items-center pb-3 pt-3 border-b-2 ${activeTab === "FEED" ? "border-[#6C63FF]" : "border-transparent"}`}
          onPress={() => setActiveTab("FEED")}
        >
          <Text className={`font-bold text-sm ${activeTab === "FEED" ? "text-[#6C63FF]" : "text-gray-500"}`}>
            Community
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 items-center pb-3 pt-3 border-b-2 border-transparent relative`}
          onPress={handleOpenChat}
        >
          <Text className="font-bold text-sm text-gray-500">Live Chat</Text>
          {hasUnreadNicheChat && (
            <View
              className="absolute top-2.5 right-[28%] w-2 h-2 rounded-full bg-[#6C63FF]"
            />
          )}
        </TouchableOpacity>

        <TouchableOpacity
          className={`flex-1 items-center pb-3 pt-3 border-b-2 ${activeTab === "ANNOUNCEMENTS" ? "border-amber-500" : "border-transparent"}`}
          onPress={() => setActiveTab("ANNOUNCEMENTS")}
        >
          <Text className={`font-bold text-sm ${activeTab === "ANNOUNCEMENTS" ? "text-amber-500" : "text-gray-500"}`}>
            Announce
          </Text>
        </TouchableOpacity>
      </View>

      {/* ── Content ── */}
      <View className="flex-1">
        <ScrollView
          className="flex-1 px-5 pt-4"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />}
        >
          {activeTab === "FEED" && (
            <View>
              {posts.length > 0 ? (
                posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={post}
                    onDelete={(deletedId) => setPosts((prev) => prev.filter((p) => p.id !== deletedId))}
                  />
                ))
              ) : (
                <View className="py-20 items-center">
                  <Hash size={48} color={isDark ? "#2C2C2E" : "#E5E7EB"} />
                  <Text className="text-lg text-center mt-4" style={{ color: colors.textSecondary }}>
                    No posts yet. Start the conversation!
                  </Text>
                </View>
              )}
              <View className="h-28" />
            </View>
          )}

          {activeTab === "ANNOUNCEMENTS" && (
            <View>
              {announcements.length > 0 ? (
                announcements.map((post) => (
                  <View key={post.id} className="relative">
                    <View className="absolute top-4 right-4 z-10 px-2 py-1 rounded-md bg-amber-500/20 flex-row items-center border border-amber-500/30">
                      <ShieldAlert size={12} color="#F59E0B" />
                      <Text className="text-[10px] font-bold text-amber-500 uppercase ml-1">Official</Text>
                    </View>
                    <PostCard
                      post={post}
                      onDelete={(deletedId) => setAnnouncements((prev) => prev.filter((p) => p.id !== deletedId))}
                    />
                  </View>
                ))
              ) : (
                <View className="py-20 items-center">
                  <ShieldAlert size={48} color={isDark ? "#2C2C2E" : "#E5E7EB"} />
                  <Text className="text-lg text-center mt-4" style={{ color: colors.textSecondary }}>
                    No official announcements currently.
                  </Text>
                </View>
              )}
              <View className="h-28" />
            </View>
          )}
        </ScrollView>

        {/* ── Floating FABs ── */}
        {activeTab === "FEED" && niche?.isMember && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/compose", params: { nicheId: id } } as any)}
            className="absolute bottom-6 right-5 w-14 h-14 bg-[#6C63FF] rounded-full items-center justify-center elevation-5"
            style={{ shadowColor: "#6C63FF", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
          >
            <Plus size={26} color="#FFF" />
          </TouchableOpacity>
        )}

        {activeTab === "ANNOUNCEMENTS" && isAdminOrMod && (
          <TouchableOpacity
            onPress={() => router.push({ pathname: "/compose", params: { nicheId: id, isAnnouncement: "true" } } as any)}
            className="absolute bottom-6 right-5 w-14 h-14 bg-amber-500 rounded-full items-center justify-center elevation-5"
            style={{ shadowColor: "#F59E0B", shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } }}
          >
            <Bell size={22} color="#FFF" />
          </TouchableOpacity>
        )}
      </View>

      <RequestsModal
        visible={showRequests}
        onClose={() => setShowRequests(false)}
        nicheId={niche?.id || null}
        isDark={isDark}
        colors={colors}
        onActionComplete={fetchNicheData}
      />
      <AppModal {...modalProps} />
    </SafeAreaView>
  );
}

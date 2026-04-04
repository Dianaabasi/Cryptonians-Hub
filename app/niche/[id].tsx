import React, { useState, useEffect } from "react";
import {
  View, Text, TouchableOpacity, ScrollView, RefreshControl,
  Image, ActivityIndicator, Alert
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Hash, ShieldAlert, Bell, Plus, Camera } from "lucide-react-native";
import { PostCard, PostType } from "@/components/ui/PostCard";
import { SkeletonNicheDetail } from "@/components/ui/SkeletonLoader";

interface NicheData {
  id: string;
  name: string;
  description: string;
  banner_url: string | null;
  isMember: boolean;
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
        .single();

      setNiche({ ...nicheData, isMember: !!membership });

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
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchNicheData(); }, [id, profile?.id]);

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
        await supabase
          .from("niche_memberships")
          .insert({ niche_id: niche.id, user_id: profile.id });
        setNiche({ ...niche, isMember: true });
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
      Alert.alert("Upload Failed", e.message || "Could not upload banner.");
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
          <Text className="text-xs" style={{ color: colors.textSecondary }} numberOfLines={1}>
            {niche?.description}
          </Text>
        </View>

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
          className={`flex-1 items-center pb-3 pt-3 border-b-2 border-transparent`}
          onPress={handleOpenChat}
        >
          <Text className="font-bold text-sm text-gray-500">Live Chat</Text>
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
    </SafeAreaView>
  );
}

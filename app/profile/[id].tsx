import React, { useState, useEffect } from "react";
import {
  View, Text, Image, FlatList, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView
} from "react-native";
import { AppModal, useAppModal } from "@/components/ui/AppModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as Clipboard from "expo-clipboard";
import * as Linking from "expo-linking";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, MapPin, Link as LinkIcon, Edit3, Copy, Wallet,
  Mail, Phone, Info, MessageSquare, ShieldCheck, X, Hash
} from "lucide-react-native";
import { PostCard, PostType } from "@/components/ui/PostCard";
import { SkeletonCard, SkeletonProfile } from "@/components/ui/SkeletonLoader";

interface JoinedNiche {
  niche_id: string;
  niches: {
    id: string;
    name: string;
    description: string | null;
    banner_url: string | null;
  };
}

export default function ProfileScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useThemeStore();
  const { profile: currentUserProfile, setProfile: setCurrentUserProfile } = useAuthStore();

  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<any>(null);
  const [posts, setPosts] = useState<PostType[]>([]);
  const [joinedNiches, setJoinedNiches] = useState<JoinedNiche[]>([]);
  const [activeTab, setActiveTab] = useState<"posts" | "niches">("posts");
  const [startingChat, setStartingChat] = useState(false);

  // Role management modal
  const [roleModalVisible, setRoleModalVisible] = useState(false);
  const [updatingRole, setUpdatingRole] = useState(false);
  const { showModal, modalProps } = useAppModal();

  const isOwnProfile = currentUserProfile?.id === id;
  const isCurrentUserAdmin = currentUserProfile?.role === "admin";
  const canManageRole = isCurrentUserAdmin && !isOwnProfile;

  // Message button visibility:
  // - Admin/Mod → can message anyone
  // - Member → can message other members only (not admin/mod)
  const viewerRole = currentUserProfile?.role;
  const profileRole = profile?.role;
  const canMessageUsers =
    !isOwnProfile &&
    (viewerRole === "admin" || viewerRole === "mod" ||
      (viewerRole === "member" && profileRole === "member"));

  useEffect(() => {
    if (isOwnProfile && currentUserProfile) setProfile(currentUserProfile);
  }, [currentUserProfile, isOwnProfile]);

  useEffect(() => {
    if (id) fetchAll();
  }, [id]);

  const fetchAll = async () => {
    try {
      setLoading(true);

      let targetId = id;
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

      // Fetch profile (for other users)
      if (!isOwnProfile) {
        let query = supabase.from("profiles").select("*");
        if (isUUID) query = query.eq("id", id);
        else query = query.eq("username", id);

        const { data: pData } = await query.single();
        if (pData) {
          setProfile(pData);
          targetId = pData.id;
        } else {
          setLoading(false);
          return;
        }
      }

      // Fetch posts
      const { data: postsData } = await supabase
        .from("posts")
        .select(`
          id, content, image_url, is_job_post, is_announcement, created_at,
          author:author_id(id, full_name, username, avatar_url, role),
          likes:likes(count),
          comments:comments(count)
        `)
        .eq("author_id", targetId)
        .order("created_at", { ascending: false });

      if (postsData) {
        setPosts(postsData.map((p: any) => ({
          ...p,
          author: Array.isArray(p.author) ? p.author[0] : p.author,
          likes_count: p.likes?.[0]?.count || 0,
          comments_count: p.comments?.[0]?.count || 0,
        })) as PostType[]);
      }

      // Fetch joined niches
      const { data: nichesData } = await supabase
        .from("niche_memberships")
        .select(`
          niche_id,
          niches(id, name, description, banner_url)
        `)
        .eq("user_id", targetId);

      if (nichesData) {
        setJoinedNiches(nichesData.map((m: any) => ({
          ...m,
          niches: Array.isArray(m.niches) ? m.niches[0] : m.niches,
        })));
      }
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async (text: string, label: string) => {
    await Clipboard.setStringAsync(text);
    showModal({ title: `${label} Copied`, message: `${text} copied to clipboard!`, variant: "success" });
  };

  const handleMessageUser = async () => {
    if (!profile || !currentUserProfile || !canMessageUsers) return;
    setStartingChat(true);
    try {
      // Use SECURITY DEFINER RPC to create room + add both participants atomically
      const { data: chatId, error } = await supabase
        .rpc("create_direct_chat", { other_user_id: profile.id });

      if (error) throw error;
      router.push(`/chat/${chatId}` as any);
    } catch (e: any) {
      console.error(e);
      showModal({ title: "Error", message: e?.message || "Could not start chat.", variant: "error" });
    } finally {
      setStartingChat(false);
    }
  };

  const handleSetRole = async (newRole: "admin" | "mod" | "member") => {
    if (!profile) return;
    setUpdatingRole(true);
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ role: newRole })
        .eq("id", profile.id);

      if (error) throw error;
      setProfile({ ...profile, role: newRole });
      setRoleModalVisible(false);
      showModal({ title: "Role Updated", message: `${profile.full_name} is now a ${newRole}.`, variant: "success" });
    } catch (e: any) {
      showModal({ title: "Error", message: e.message || "Could not update role.", variant: "error" });
    } finally {
      setUpdatingRole(false);
    }
  };

  // ─── Role Badge ───────────────────────────────────────────────────────────
  const RoleBadge = ({ role }: { role: string }) => {
    if (role === "admin") {
      return (
        <View className="bg-amber-500 px-2 py-0.5 rounded-md ml-2">
          <Text className="text-white text-xs font-bold uppercase">Admin</Text>
        </View>
      );
    }
    if (role === "mod") {
      return (
        <View className="bg-[#6C63FF] px-2 py-0.5 rounded-md ml-2">
          <Text className="text-white text-xs font-bold uppercase">Mod</Text>
        </View>
      );
    }
    return null;
  };

  // ─── Role Management Modal ────────────────────────────────────────────────
  const renderRoleModal = () => (
    <Modal
      visible={roleModalVisible}
      transparent
      animationType="slide"
      onRequestClose={() => setRoleModalVisible(false)}
    >
      <View className="flex-1 justify-end bg-black/60">
        <View
          className="rounded-t-3xl px-5 pt-4 pb-10"
          style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFFFFF" }}
        >
          {/* Handle */}
          <View className="items-center mb-4">
            <View className="w-10 h-1 rounded-full bg-gray-400" />
          </View>

          <View className="flex-row items-center justify-between mb-6">
            <Text className="text-xl font-bold" style={{ color: colors.text }}>
              Manage Role
            </Text>
            <TouchableOpacity onPress={() => setRoleModalVisible(false)}>
              <X size={22} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text className="text-sm mb-4" style={{ color: colors.textSecondary }}>
            Set the role for <Text className="font-bold" style={{ color: colors.text }}>{profile?.full_name}</Text>
          </Text>

          {updatingRole ? (
            <ActivityIndicator size="large" color="#6C63FF" className="py-8" />
          ) : (
            <View className="gap-3">
              <TouchableOpacity
                onPress={() => handleSetRole("admin")}
                className={`flex-row items-center p-4 rounded-2xl ${profile?.role === "admin" ? "bg-amber-500" : isDark ? "bg-[#2C2C2E]" : "bg-gray-100"}`}
              >
                <ShieldCheck size={22} color={profile?.role === "admin" ? "#FFF" : "#F59E0B"} />
                <View className="ml-3 flex-1">
                  <Text className={`font-bold text-base ${profile?.role === "admin" ? "text-white" : ""}`} style={profile?.role !== "admin" ? { color: colors.text } : {}}>
                    Admin
                  </Text>
                  <Text className={`text-xs ${profile?.role === "admin" ? "text-white/80" : ""}`} style={profile?.role !== "admin" ? { color: colors.textSecondary } : {}}>
                    Full platform management access
                  </Text>
                </View>
                {profile?.role === "admin" && <Text className="text-white text-xs font-bold">CURRENT</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSetRole("mod")}
                className={`flex-row items-center p-4 rounded-2xl ${profile?.role === "mod" ? "bg-[#6C63FF]" : isDark ? "bg-[#2C2C2E]" : "bg-gray-100"}`}
              >
                <ShieldCheck size={22} color={profile?.role === "mod" ? "#FFF" : "#6C63FF"} />
                <View className="ml-3 flex-1">
                  <Text className={`font-bold text-base ${profile?.role === "mod" ? "text-white" : ""}`} style={profile?.role !== "mod" ? { color: colors.text } : {}}>
                    Moderator
                  </Text>
                  <Text className={`text-xs ${profile?.role === "mod" ? "text-white/80" : ""}`} style={profile?.role !== "mod" ? { color: colors.textSecondary } : {}}>
                    Can delete posts, manage niches
                  </Text>
                </View>
                {profile?.role === "mod" && <Text className="text-white text-xs font-bold">CURRENT</Text>}
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => handleSetRole("member")}
                className={`flex-row items-center p-4 rounded-2xl ${profile?.role === "member" ? (isDark ? "bg-[#2C2C2E] border border-gray-600" : "bg-gray-200") : isDark ? "bg-[#2C2C2E]" : "bg-gray-100"}`}
              >
                <View className="w-6 h-6 rounded-full bg-gray-400 items-center justify-center mr-3">
                  <Text className="text-white text-xs font-bold">M</Text>
                </View>
                <View className="flex-1">
                  <Text className="font-bold text-base" style={{ color: colors.text }}>Member</Text>
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>Standard user access</Text>
                </View>
                {profile?.role === "member" && <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>CURRENT</Text>}
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>
    </Modal>
  );

  // ─── Header ───────────────────────────────────────────────────────────────
  const renderHeader = () => {
    if (!profile) return null;

    return (
      <View>
        <View className="h-32 bg-[#6C63FF]/20" />

        <View className="px-5 pb-6">
          <View className="flex-row justify-between items-end -mt-12 mb-3">
            <View
              className="w-24 h-24 rounded-full border-4 items-center justify-center"
              style={{ borderColor: colors.background, backgroundColor: isDark ? "#2C2C2E" : "#F3F4F6" }}
            >
              {profile.avatar_url ? (
                <Image source={{ uri: profile.avatar_url }} className="w-full h-full rounded-full" />
              ) : (
                <Text className="text-3xl font-bold" style={{ color: colors.textSecondary }}>
                  {profile.username?.charAt(0).toUpperCase()}
                </Text>
              )}
            </View>

            <View className="flex-row gap-2 items-center">
              {canManageRole && (
                <TouchableOpacity
                  onPress={() => setRoleModalVisible(true)}
                  className="flex-row items-center border border-amber-500/50 px-3 py-1.5 rounded-full bg-amber-500/10"
                >
                  <ShieldCheck size={14} color="#F59E0B" />
                  <Text className="font-semibold text-sm text-amber-500 ml-1">Role</Text>
                </TouchableOpacity>
              )}

              {isOwnProfile ? (
                <TouchableOpacity
                  onPress={() => router.push("/profile/edit")}
                  className="flex-row items-center border px-4 py-1.5 rounded-full"
                  style={{ borderColor: colors.border }}
                >
                  <Edit3 size={14} color={colors.text} />
                  <Text className="font-semibold text-sm ml-1.5" style={{ color: colors.text }}>Edit</Text>
                </TouchableOpacity>
              ) : canMessageUsers ? (
                <TouchableOpacity
                  onPress={handleMessageUser}
                  disabled={startingChat}
                  className="flex-row items-center px-4 py-1.5 rounded-full bg-[#6C63FF]"
                >
                  {startingChat ? (
                    <ActivityIndicator size="small" color="#FFF" />
                  ) : (
                    <>
                      <MessageSquare size={14} color="#FFF" />
                      <Text className="font-bold text-sm text-white ml-1.5">Message</Text>
                    </>
                  )}
                </TouchableOpacity>
              ) : null}
            </View>
          </View>

          {/* Name + Badge */}
          <View className="flex-row items-center mb-1">
            <Text className="text-2xl font-bold mr-1" style={{ color: colors.text }}>
              {profile.full_name}
            </Text>
            <RoleBadge role={profile.role} />
          </View>

          <Text className="text-base mb-4" style={{ color: colors.textSecondary }}>
            @{profile.username}
          </Text>

          {profile.bio && (
            <Text className="text-base leading-6 mb-4" style={{ color: colors.text }}>
              {profile.bio}
            </Text>
          )}

          {/* Public Info */}
          <View className="flex-row flex-wrap gap-x-4 gap-y-2 mb-4">
            {profile.country && (
              <View className="flex-row items-center">
                <MapPin size={14} color={colors.textSecondary} />
                <Text className="ml-1 text-sm" style={{ color: colors.textSecondary }}>{profile.country}</Text>
              </View>
            )}
            {profile.x_username && (
              <TouchableOpacity onPress={() => Linking.openURL(`https://x.com/${profile.x_username}`)} className="flex-row items-center">
                <LinkIcon size={14} color={colors.textSecondary} />
                <Text className="ml-1 text-sm font-semibold" style={{ color: "#6C63FF" }}>x.com/{profile.x_username}</Text>
              </TouchableOpacity>
            )}
            {profile.role_in_space && (
              <View className="flex-row items-center">
                <Info size={14} color={colors.textSecondary} />
                <Text className="ml-1 text-sm" style={{ color: colors.textSecondary }}>{profile.role_in_space}</Text>
              </View>
            )}
          </View>

          {/* Wallet Address */}
          {profile.wallet_address && (
            <TouchableOpacity
              onPress={() => copyToClipboard(profile.wallet_address, "Wallet Address")}
              className={`flex-row items-center p-3 mb-4 rounded-xl ${isDark ? "bg-[#1C1C1E] border border-[#2C2C2E]" : "bg-gray-50 border border-gray-100"}`}
            >
              <Wallet size={18} color="#6C63FF" />
              <Text className="flex-1 mx-3 font-medium text-xs" numberOfLines={1} ellipsizeMode="middle" style={{ color: colors.text }}>
                {profile.wallet_address}
              </Text>
              <Copy size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          )}

          {/* Private Info (own profile only) */}
          {isOwnProfile && (
            <View className={`p-4 rounded-xl ${isDark ? "bg-[#1C1C1E]/50 border border-[#2C2C2E]" : "bg-gray-50 border border-gray-100"}`}>
              <Text className="text-xs font-bold uppercase mb-3" style={{ color: colors.textSecondary }}>Private Information</Text>
              {profile.email && (
                <View className="flex-row items-center mb-2">
                  <Mail size={14} color={colors.textSecondary} />
                  <Text className="ml-2 text-sm" style={{ color: colors.text }}>{profile.email}</Text>
                </View>
              )}
              {profile.phone_number && (
                <View className="flex-row items-center mb-2">
                  <Phone size={14} color={colors.textSecondary} />
                  <Text className="ml-2 text-sm" style={{ color: colors.text }}>{profile.phone_number}</Text>
                </View>
              )}
              {profile.referral_id && (
                <View className="flex-row items-center">
                  <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>REF:</Text>
                  <Text className="ml-2 text-sm" style={{ color: colors.text }}>{profile.referral_id}</Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Tabs */}
        <View className="flex-row border-b" style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}>
          <TouchableOpacity
            onPress={() => setActiveTab("posts")}
            className={`flex-1 py-4 items-center border-b-2 ${activeTab === "posts" ? "border-[#6C63FF]" : "border-transparent"}`}
          >
            <Text className={`font-bold ${activeTab === "posts" ? "text-[#6C63FF]" : "opacity-60"}`} style={activeTab !== "posts" ? { color: colors.text } : {}}>
              Posts
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setActiveTab("niches")}
            className={`flex-1 py-4 items-center border-b-2 ${activeTab === "niches" ? "border-[#6C63FF]" : "border-transparent"}`}
          >
            <Text className={`font-bold ${activeTab === "niches" ? "text-[#6C63FF]" : "opacity-60"}`} style={activeTab !== "niches" ? { color: colors.text } : {}}>
              Niches{joinedNiches.length > 0 ? ` (${joinedNiches.length})` : ""}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Niches tab content (rendered inline in header since FlatList handles posts) */}
        {activeTab === "niches" && (
          <View className="px-5 pt-4">
            {joinedNiches.length > 0 ? (
              joinedNiches.map((m) => (
                <TouchableOpacity
                  key={m.niche_id}
                  onPress={() => router.push(`/niche/${m.niches.id}` as any)}
                  className={`flex-row items-center mb-4 p-4 rounded-2xl ${isDark ? "bg-[#1C1C1E] border border-[#2C2C2E]" : "bg-white border border-gray-100"}`}
                >
                  {/* Banner thumbnail */}
                  <View className={`w-12 h-12 rounded-xl mr-3 items-center justify-center overflow-hidden ${isDark ? "bg-[#2C2C2E]" : "bg-gray-100"}`}>
                    {m.niches.banner_url ? (
                      <Image source={{ uri: m.niches.banner_url }} className="w-full h-full" resizeMode="cover" />
                    ) : (
                      <Hash size={22} color="#6C63FF" />
                    )}
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-base" style={{ color: colors.text }} numberOfLines={1}>
                      {m.niches.name}
                    </Text>
                    {m.niches.description && (
                      <Text className="text-xs" style={{ color: colors.textSecondary }} numberOfLines={1}>
                        {m.niches.description}
                      </Text>
                    )}
                  </View>
                  <View className="bg-[#6C63FF]/10 px-2 py-1 rounded-full">
                    <Text className="text-[#6C63FF] text-xs font-bold">Member</Text>
                  </View>
                </TouchableOpacity>
              ))
            ) : (
              <View className="py-16 items-center">
                <Hash size={40} color={isDark ? "#2C2C2E" : "#E5E7EB"} />
                <Text className="text-center text-base mt-4" style={{ color: colors.textSecondary }}>
                  {isOwnProfile ? "You haven't" : `${profile?.full_name?.split(" ")[0]} hasn't`} joined any Niches yet.
                </Text>
              </View>
            )}
            <View className="h-32" />
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Back Button */}
      <View className="absolute top-12 left-4 z-10 w-10 h-10 rounded-full bg-black/50 items-center justify-center">
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}>
          <ArrowLeft size={24} color="#FFF" />
        </TouchableOpacity>
      </View>

      {loading && !profile ? (
        <ScrollView showsVerticalScrollIndicator={false}>
          <SkeletonProfile isDark={isDark} />
        </ScrollView>
      ) : (
        <FlatList
          data={activeTab === "posts" ? posts : []}
          keyExtractor={(item, index) => item.id || index.toString()}
          showsVerticalScrollIndicator={false}
          ListHeaderComponent={renderHeader}
          contentContainerStyle={{ paddingBottom: 100 }}
          renderItem={({ item }) =>
            activeTab === "posts" ? (
              <View className="px-5 mt-4">
                <PostCard
                  post={item}
                  onDelete={(deletedId) => setPosts((prev) => prev.filter((p) => p.id !== deletedId))}
                />
              </View>
            ) : null
          }
          ListEmptyComponent={
            activeTab === "posts" ? (
              <View className="py-20 items-center px-8">
                <Text className="text-center text-lg" style={{ color: colors.textSecondary }}>
                  {profile?.full_name?.split(" ")[0]} hasn't posted anything yet.
                </Text>
              </View>
            ) : null
          }
        />
      )}

      {renderRoleModal()}
      <AppModal {...modalProps} />
    </SafeAreaView>
  );
}

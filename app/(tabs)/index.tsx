import React, { useState, useEffect, useCallback } from "react";
import { View, Text, Image, TouchableOpacity, RefreshControl, FlatList } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Link, useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { useUIStore } from "@/stores/uiStore";
import { Colors } from "@/constants/Colors";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import { Headphones, Edit3, Bell, Plus } from "lucide-react-native";
import { PostCard, PostType } from "@/components/ui/PostCard";
import { supabase } from "@/lib/supabase";

export default function HomeScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { profile } = useAuthStore();
  const { setTabBarVisible } = useUIStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const [posts, setPosts] = useState<PostType[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [supportDot, setSupportDot] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // Check for unread support activity & notifications
  const checkUnreadActivity = useCallback(async () => {
    if (!profile?.id) return;
    
    // Check notifications
    const { count: notifCount } = await supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("read", false);
    setUnreadCount(notifCount ?? 0);

    const isStaff = profile.role === "admin" || profile.role === "mod";
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

  useFocusEffect(useCallback(() => { checkUnreadActivity(); }, [checkUnreadActivity]));

  const fetchPosts = async () => {
    try {
      let query = supabase
        .from("posts")
        .select(`
          id, content, image_url, is_job_post, is_announcement, created_at,
          niche:niches(id, name),
          author:author_id(id, full_name, username, avatar_url, role),
          likes:likes(count), comments:comments(count)
        `)
        .order("created_at", { ascending: false });

      if (profile?.id) {
        // Fetch niche memberships
        const { data: memberships } = await supabase
          .from("niche_memberships")
          .select("niche_id")
          .eq("user_id", profile.id);
          
        const nicheIds = memberships?.map((m) => m.niche_id) || [];

        if (nicheIds.length > 0) {
          query = query.or(`niche_id.is.null,niche_id.in.(${nicheIds.join(",")})`);
        } else {
          query = query.is("niche_id", null);
        }

        // Exclude reported posts
        const { data: reported } = await supabase
          .from("reported_posts")
          .select("post_id")
          .eq("user_id", profile.id);
        
        const reportedIds = reported?.map(r => r.post_id) || [];
        if (reportedIds.length > 0) {
          query = query.filter("id", "not.in", `(${reportedIds.join(",")})`);
        }
      } else {
         query = query.is("niche_id", null);
      }

      const { data, error } = await query;

      if (error) {
        console.error("Error fetching posts:", JSON.stringify(error));
        return;
      }

      if (data) {
        setPosts(
          data.map((p) => ({
            ...p,
            niche: Array.isArray(p.niche) ? p.niche[0] : p.niche,
            author: Array.isArray(p.author) ? p.author[0] : p.author,
            likes_count: (p.likes as any)?.[0]?.count ?? 0,
            comments_count: (p.comments as any)?.[0]?.count ?? 0,
            has_liked: false,
          })) as PostType[]
        );
      }
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Runs once on mount AND again when profile loads (profile starts as null)
  useEffect(() => {
    fetchPosts();

    const channel = supabase.channel('public:posts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts' }, () => {
        fetchPosts(); // silently pull new content when a post drops
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [profile?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchPosts();
  }, [profile?.id]);

  const renderHeader = () => (
    <View>
      {/* Header */}
      <View className="flex-row items-center justify-between pt-4 pb-4">
        <Image
          source={
            isDark
              ? require("@/assets/images/logo_white.png")
              : require("@/assets/images/logo_black.png")
          }
          className="w-20 h-20 -ml-2"
          resizeMode="contain"
        />
        <View className="flex-row items-center">
          <Link href="/notifications" asChild>
            <TouchableOpacity className="p-2 mr-2 relative">
              <Bell size={24} color={colors.text} />
              {unreadCount > 0 && (
                <View className="absolute top-1 right-2 w-4 h-4 bg-red-500 rounded-full items-center justify-center border-2 border-white dark:border-[#1C1C1E]">
                  <Text className="text-[8px] font-bold text-white text-center w-full">{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
          </Link>
          <Link href="/support" asChild>
            <TouchableOpacity className="p-2 -mr-2">
              <View>
                <Headphones size={24} color={colors.text} />
                {supportDot && (
                  <View
                    className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2"
                    style={{ backgroundColor: "#6C63FF", borderColor: colors.background }}
                  />
                )}
              </View>
            </TouchableOpacity>
          </Link>
        </View>
      </View>

      {/* Create Post Entry */}
      <Link href="/compose" asChild>
        <TouchableOpacity
          className={`flex-row items-center px-4 py-3 mb-6 rounded-2xl ${
            isDark
              ? "bg-[#1C1C1E] border border-[#2C2C2E]"
              : "bg-white border border-gray-100"
          }`}
        >
          <View
            className={`w-10 h-10 rounded-full mr-3 items-center justify-center ${
              isDark ? "bg-[#2C2C2E]" : "bg-gray-100"
            }`}
          >
            {profile?.avatar_url ? (
              <Image
                source={{ uri: profile.avatar_url }}
                className="w-10 h-10 rounded-full"
              />
            ) : (
              <Text
                className="text-lg font-bold"
                style={{ color: colors.textSecondary }}
              >
                {profile?.username?.charAt(0).toUpperCase() ?? "C"}
              </Text>
            )}
          </View>
          <Text className="flex-1 text-base" style={{ color: colors.textSecondary }}>
            What's happening in the Cryptoverse?
          </Text>
          <View className="p-2 bg-[#6C63FF]/10 rounded-full">
            <Edit3 size={18} color="#6C63FF" />
          </View>
        </TouchableOpacity>
      </Link>

      {/* Feed Title */}
      <Text className="text-lg font-bold mb-4" style={{ color: colors.text }}>
        Your Feed
      </Text>
      
      {loading && (
        <View>
          <SkeletonCard isDark={isDark} />
          <SkeletonCard isDark={isDark} />
          <SkeletonCard isDark={isDark} />
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <FlatList
        data={loading ? [] : posts}
        keyExtractor={(item) => item.id}
        className="flex-1 px-5"
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScrollBeginDrag={() => setTabBarVisible(false)}
        onScrollEndDrag={() => setTabBarVisible(true)}
        onMomentumScrollBegin={() => setTabBarVisible(false)}
        onMomentumScrollEnd={() => setTabBarVisible(true)}
        ListHeaderComponent={renderHeader}
        ListEmptyComponent={
          !loading ? (
            <View className="py-20 items-center justify-center">
              <Text
                className="text-center text-lg"
                style={{ color: colors.textSecondary }}
              >
                No posts yet. Be the first to share something!
              </Text>
            </View>
          ) : null
        }
        contentContainerStyle={{ paddingBottom: 100 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.textSecondary}
          />
        }
        renderItem={({ item }) => (
          <PostCard
            post={item}
            onDelete={(deletedId) =>
              setPosts((prev) => prev.filter((p) => p.id !== deletedId))
            }
          />
        )}
      />

      {/* Floating Action Button */}
      <Link href="/compose" asChild>
        <TouchableOpacity
          className="absolute bottom-[100px] right-6 w-14 h-14 bg-[#6C63FF] rounded-full items-center justify-center shadow-lg elevation-5"
          style={{ zIndex: 10, shadowColor: "#6C63FF" }}
        >
          <Plus size={28} color="#FFF" />
        </TouchableOpacity>
      </Link>
    </SafeAreaView>
  );
}

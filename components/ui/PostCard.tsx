import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity, Pressable } from "react-native";
import { useRouter } from "expo-router";
import * as Linking from "expo-linking";
import { LinkPreview } from "@flyerhq/react-native-link-preview";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { Heart, MessageCircle, MoreHorizontal, Flag, Pin } from "lucide-react-native";
import { PostOptionsModal, ConfirmModal } from "./Modals";

export interface PostType {
  id: string;
  author: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
    role: string;
  };
  niche?: {
    id: string;
    name: string;
  };
  content: string;
  image_url: string | null;
  is_job_post: boolean;
  is_announcement?: boolean;
  created_at: string;
  likes_count?: number;
  comments_count?: number;
}

interface PostCardProps {
  post: PostType;
  onDelete?: (id: string) => void;
  onReport?: (id: string) => void;
  hideCommentLink?: boolean;
  onImagePress?: (url: string) => void;
  onLikesPress?: () => void;
}

export function PostCard({ post, onDelete, onReport, hideCommentLink = false, onImagePress, onLikesPress }: PostCardProps) {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { profile } = useAuthStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  // Initialize with the data fetched natively in index.tsx
  const [likesCount, setLikesCount] = useState(post.likes_count || 0);
  const [commentsCount, setCommentsCount] = useState(post.comments_count || 0);
  const [hasLiked, setHasLiked] = useState(false);

  // Modals state
  const [optionsVisible, setOptionsVisible] = useState(false);
  const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
  const [reportConfirmVisible, setReportConfirmVisible] = useState(false);

  useEffect(() => {
    // If we passed initial count as 0, update it if the prop changes
    if (post.likes_count !== undefined) setLikesCount(post.likes_count);
    if (post.comments_count !== undefined) setCommentsCount(post.comments_count);
    checkIfLiked();
  }, [post.id, post.likes_count, post.comments_count]);

  const checkIfLiked = async () => {
    if (profile?.id) {
      const { data } = await supabase
        .from('likes')
        .select('*')
        .eq('post_id', post.id)
        .eq('user_id', profile.id)
        .single();
      if (data) setHasLiked(true);
    }
  };

  const handleLike = async () => {
    if (!profile?.id) return;
    
    const currentlyLiked = hasLiked;
    setHasLiked(!currentlyLiked);
    setLikesCount(prev => prev + (currentlyLiked ? -1 : 1));

    if (currentlyLiked) {
      await supabase.from('likes').delete().match({ post_id: post.id, user_id: profile.id });
    } else {
      await supabase.from('likes').insert({ post_id: post.id, user_id: profile.id });
    }
  };

  const navigateToDetails = () => {
    if (!hideCommentLink) {
      router.push(`/post/${post.id}`);
    }
  };

  const confirmDelete = async () => {
    await supabase.from("posts").delete().eq("id", post.id);
    if (onDelete) onDelete(post.id);
  };

  const confirmReport = async () => {
    if (!profile?.id) return;
    await supabase.from("reported_posts").insert({ post_id: post.id, user_id: profile.id });
    if (onReport) onReport(post.id);
  };

  const getRelativeTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return "Just now";
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h`;
    return `${Math.floor(diffInSeconds / 86400)}d`;
  };

  const renderContentWithMentions = (text: string) => {
    const regex = /(https?:\/\/[^\s]+|@[a-zA-Z0-9_]+)/g;
    const parts = text.split(regex);

    return parts.map((part, index) => {
      if (part.match(/^https?:\/\/[^\s]+/)) {
        return (
          <Text 
            key={index} 
            style={{ color: "#6C63FF", textDecorationLine: "underline" }}
            onPress={(e) => {
              e.stopPropagation();
              Linking.openURL(part).catch(() => {});
            }}
          >
            {part}
          </Text>
        );
      }
      if (part.match(/^@[a-zA-Z0-9_]+/)) {
        const username = part.slice(1);
        return (
          <Text 
            key={index} 
            style={{ color: "#6C63FF", fontWeight: "600" }}
            onPress={(e) => {
              e.stopPropagation();
              router.push(`/profile/${username}` as any);
            }}
          >
            {part}
          </Text>
        );
      }
      return <Text key={index} style={{ color: colors.text }}>{part}</Text>;
    });
  };

  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const match = post.content.match(urlRegex);
  const firstUrl = match ? match[0] : null;

  const isJob = post.is_job_post;
  const isOwnerOrAdmin = post.author.id === profile?.id || profile?.role === 'admin' || profile?.role === 'mod';

  return (
    <>
      <TouchableOpacity 
        activeOpacity={0.9}
        onPress={navigateToDetails}
        className={`mb-4 rounded-3xl overflow-hidden ${isDark ? "bg-[#1C1C1E] border border-[#2C2C2E]" : "bg-white border border-gray-100"}`}
      >
        {isJob && (
          <View className="bg-[#6C63FF]/10 px-4 py-2 flex-row items-center border-b border-[#6C63FF]/20">
            <Pin size={14} color="#6C63FF" />
            <Text className="text-[#6C63FF] text-xs font-bold ml-1 uppercase tracking-wider">
              Job Opportunity
            </Text>
          </View>
        )}
        
        {post.is_announcement && (
          <View className="bg-amber-500/10 px-4 py-2 flex-row items-center border-b border-amber-500/20">
             <Flag size={14} color="#F59E0B" />
             <Text className="text-amber-500 text-xs font-bold ml-1 uppercase tracking-wider">
               Official Announcement
             </Text>
          </View>
        )}

        <View className="p-4">
          {/* Header */}
          <View className="flex-row justify-between items-center mb-3">
            <TouchableOpacity 
              className="flex-row items-center flex-1"
              onPress={() => router.push(`/profile/${post.author.id}`)}
            >
              <View className={`w-10 h-10 rounded-full mr-3 items-center justify-center ${isDark ? "bg-[#2C2C2E]" : "bg-gray-100"}`}>
                {post.author.avatar_url ? (
                  <Image source={{ uri: post.author.avatar_url }} className="w-10 h-10 rounded-full" />
                ) : (
                  <Text className="text-lg font-bold" style={{ color: colors.textSecondary }}>
                    {post.author.username.charAt(0).toUpperCase()}
                  </Text>
                )}
              </View>
              <View className="flex-1">
                <View className="flex-row items-center">
                  <Text className="font-bold text-base mr-1" style={{ color: colors.text }} numberOfLines={1}>
                    {post.author.full_name}
                  </Text>
                  {post.author.role === 'admin' ? (
                    <View className="bg-amber-500 px-1.5 py-0.5 rounded text-center ml-1">
                      <Text className="text-white text-[10px] font-bold uppercase">admin</Text>
                    </View>
                  ) : post.author.role === 'mod' ? (
                    <View className="bg-[#6C63FF] px-1.5 py-0.5 rounded text-center ml-1">
                      <Text className="text-white text-[10px] font-bold uppercase">mod</Text>
                    </View>
                  ) : null}
                </View>
                <View className="flex-row items-center">
                  <Text className="text-xs" style={{ color: colors.textSecondary }}>
                    @{post.author.username} • {getRelativeTime(post.created_at)}
                  </Text>
                </View>
              </View>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={() => setOptionsVisible(true)} 
              className="p-2 -mr-2"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MoreHorizontal size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          {/* Niche Tag */}
          {post.niche && (
            <View className="flex-row mb-2">
              <View className={`px-2 py-1 rounded-md ${isDark ? "bg-[#2C2C2E]" : "bg-gray-100"}`}>
                <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>
                  in <Text style={{ color: "#6C63FF" }}>{post.niche.name}</Text>
                </Text>
              </View>
            </View>
          )}

          {/* Content */}
          {post.content ? (
            <Text 
              className={`text-base leading-6 mb-3 ${isJob ? "font-medium" : ""}`} 
            >
              {renderContentWithMentions(post.content.trim())}
            </Text>
          ) : null}
          
          {/* Image OR Link Preview */}
          {post.image_url ? (
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => onImagePress ? onImagePress(post.image_url as string) : undefined}
              disabled={!onImagePress}
            >
              <Image 
                source={{ uri: post.image_url }} 
                className="w-full h-48 rounded-xl mb-4 bg-gray-800"
                resizeMode="cover"
              />
            </TouchableOpacity>
          ) : firstUrl ? (
            <TouchableOpacity 
              activeOpacity={0.9} 
              onPress={() => Linking.openURL(firstUrl)}
              className="mb-4 rounded-xl overflow-hidden border" 
              style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB", backgroundColor: isDark ? "#1C1C1E" : "#F9FAFB" }}
            >
              <LinkPreview 
                text={firstUrl} 
                requestTimeout={3000}
                containerStyle={{ padding: 0 }}
                textContainerStyle={{ padding: 12 }}
                renderTitle={(title) => (
                  <Text style={{ color: colors.text, fontWeight: 'bold', fontSize: 16, marginBottom: 4 }} numberOfLines={2}>
                    {title}
                  </Text>
                )}
                renderDescription={(desc) => (
                  <Text style={{ color: colors.textSecondary, fontSize: 14 }} numberOfLines={3}>
                    {desc}
                  </Text>
                )}
              />
            </TouchableOpacity>
          ) : null}

          {/* Actions */}
          <View className={`flex-row pt-3 border-t ${isDark ? "border-[#2C2C2E]" : "border-gray-100"}`}>
            <TouchableOpacity 
              onPress={handleLike}
              className="flex-row items-center mr-6 p-1 z-10"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Heart 
                size={20} 
                color={hasLiked ? "#EF4444" : colors.textSecondary} 
                fill={hasLiked ? "#EF4444" : "transparent"} 
              />
              <TouchableOpacity onPress={onLikesPress} disabled={!onLikesPress}>
                <Text 
                  className={`ml-1.5 font-medium ${hasLiked ? "text-red-500" : ""}`}
                  style={!hasLiked ? { color: colors.textSecondary } : undefined}
                >
                  {likesCount} {likesCount === 1 ? 'Like' : 'Likes'}
                </Text>
              </TouchableOpacity>
            </TouchableOpacity>

            <TouchableOpacity 
              onPress={navigateToDetails}
              className="flex-row items-center p-1 z-10"
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <MessageCircle size={20} color={colors.textSecondary} />
              <Text className="ml-1.5 font-medium" style={{ color: colors.textSecondary }}>
                {commentsCount}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      </TouchableOpacity>

      {/* Modals */}
      <PostOptionsModal 
        visible={optionsVisible}
        onClose={() => setOptionsVisible(false)}
        isOwnerOrAdmin={isOwnerOrAdmin}
        onDeleteRequest={() => setDeleteConfirmVisible(true)}
        onReportRequest={() => setReportConfirmVisible(true)}
      />

      <ConfirmModal
        visible={deleteConfirmVisible}
        onClose={() => setDeleteConfirmVisible(false)}
        title="Delete Post"
        description="Are you sure you want to permanently delete this post? This action cannot be undone."
        confirmText="Delete"
        isDestructive={true}
        onConfirm={confirmDelete}
      />

      <ConfirmModal
        visible={reportConfirmVisible}
        onClose={() => setReportConfirmVisible(false)}
        title="Report Post"
        description="Flag this post for moderator review?"
        confirmText="Report"
        isDestructive={true}
        onConfirm={confirmReport}
      />
    </>
  );
}

import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  ActivityIndicator,
  FlatList,
  Image,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Send } from "lucide-react-native";
import { PostCard, PostType } from "@/components/ui/PostCard";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";

interface CommentType {
  id: string;
  content: string;
  created_at: string;
  author: {
    id: string;
    full_name: string;
    username: string;
    avatar_url: string | null;
    role: string;
  };
}

export default function PostDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useThemeStore();
  const { profile } = useAuthStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const [post, setPost] = useState<PostType | null>(null);
  const [comments, setComments] = useState<CommentType[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [newComment, setNewComment] = useState("");
  const [postingComment, setPostingComment] = useState(false);

  useEffect(() => {
    if (id) {
      fetchPostAndComments();
    }
  }, [id]);

  const fetchPostAndComments = async () => {
    try {
      setLoading(true);
      // Fetch Post
      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select(`
          id, content, image_url, is_job_post, created_at,
          author:author_id (id, full_name, username, avatar_url, role)
        `)
        .eq("id", id)
        .single();

      if (postError) throw postError;

      if (postData) {
        setPost({
          ...postData,
          author: Array.isArray(postData.author) ? postData.author[0] : postData.author,
          likes_count: 0,
          comments_count: 0,
          has_liked: false,
        } as PostType);
      }

      // Fetch Comments
      const { data: commentsData } = await supabase
        .from("comments")
        .select(`
          id, content, created_at,
          author:author_id (id, full_name, username, avatar_url, role)
        `)
        .eq("post_id", id)
        .order("created_at", { ascending: true });

      if (commentsData) {
        setComments(
          commentsData.map(c => ({
            ...c,
            author: Array.isArray(c.author) ? c.author[0] : c.author,
          })) as CommentType[]
        );
      }
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Could not load post details.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !profile?.id) return;

    setPostingComment(true);
    try {
      const { data, error } = await supabase
        .from("comments")
        .insert({
          post_id: id,
          author_id: profile.id,
          content: newComment.trim(),
        })
        .select(`
          id, content, created_at,
          author:author_id (id, full_name, username, avatar_url, role)
        `)
        .single();

      if (error) throw error;

      if (data) {
        setComments((prev) => [
          ...prev,
          {
            ...data,
            author: Array.isArray(data.author) ? data.author[0] : data.author,
          } as CommentType,
        ]);
        setNewComment("");
      }
    } catch (error) {
      Alert.alert("Error", "Could not post your comment.");
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = (commentId: string, authorId: string) => {
    if (authorId !== profile?.id && profile?.role !== 'admin' && profile?.role !== 'mod') return;
    
    Alert.alert("Confirm Delete", "Delete this comment?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
          await supabase.from("comments").delete().eq("id", commentId);
          setComments(prev => prev.filter(c => c.id !== commentId));
      }}
    ]);
  };

  const renderComment = ({ item }: { item: CommentType }) => {
    const isOwner = item.author.id === profile?.id;
    const canDelete = isOwner || profile?.role === 'admin' || profile?.role === 'mod';

    return (
      <TouchableOpacity
        activeOpacity={0.9}
        onLongPress={() => canDelete ? handleDeleteComment(item.id, item.author.id) : null}
        className={`px-5 py-3 border-b ${isDark ? "border-[#2C2C2E]" : "border-gray-100"}`}
      >
        <TouchableOpacity 
          className="flex-row items-start"
          onPress={() => router.push(`/profile/${item.author.id}`)}
        >
          <View className={`w-8 h-8 rounded-full mr-3 items-center justify-center overflow-hidden ${isDark ? "bg-[#2C2C2E]" : "bg-gray-200"}`}>
             {item.author.avatar_url ? (
                <Image source={{ uri: item.author.avatar_url }} className="w-full h-full" />
             ) : (
                <Text className="text-sm font-bold" style={{ color: colors.textSecondary }}>
                  {item.author.username.charAt(0).toUpperCase()}
                </Text>
             )}
          </View>
          <View className="flex-1">
            <View className="flex-row items-center mb-1">
              <Text className="font-bold text-sm" style={{ color: colors.text }}>
                {item.author.full_name}
              </Text>
              <Text className="text-xs ml-2" style={{ color: colors.textSecondary }}>
                @{item.author.username}
              </Text>
              {item.author.role === 'admin' || item.author.role === 'mod' ? (
                <View className="bg-[#6C63FF]/20 px-1 py-0.5 rounded ml-2">
                  <Text className="text-[#6C63FF] text-[9px] font-bold uppercase">{item.author.role}</Text>
                </View>
              ) : null}
            </View>
            <Text className="text-base" style={{ color: colors.text }}>
              {item.content}
            </Text>
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        className="flex-1"
      >
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b" style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}>
          <TouchableOpacity onPress={() => router.back()} className="p-2 mr-3">
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-lg font-bold" style={{ color: colors.text }}>
            Post
          </Text>
        </View>

        {loading ? (
          <View className="p-5">
             <SkeletonCard isDark={isDark} />
          </View>
        ) : (
          <FlatList
            data={comments}
            keyExtractor={(item) => item.id}
            renderItem={renderComment}
            ListHeaderComponent={
              post ? (
                <View className="p-5 pb-2 border-b" style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}>
                  <PostCard post={post} 
                    hideCommentLink 
                    onDelete={() => {
                      router.back();
                    }} 
                  />
                  <Text className="font-bold text-lg mt-4 mb-2" style={{ color: colors.text }}>
                    Comments ({comments.length})
                  </Text>
                </View>
              ) : null
            }
            ListEmptyComponent={
              <View className="py-10 items-center">
                <Text className="text-center" style={{ color: colors.textSecondary }}>No comments yet.</Text>
              </View>
            }
          />
        )}

        {/* Comment Input */}
        <View className="flex-row items-end px-4 py-3 border-t" style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}>
          <TextInput
            value={newComment}
            onChangeText={setNewComment}
            placeholder="Add a comment..."
            placeholderTextColor={colors.textSecondary}
            multiline
            className="flex-1 px-4 py-3 rounded-2xl text-base max-h-32"
            style={{ 
              backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6",
              color: colors.text 
            }}
          />
          <TouchableOpacity 
            onPress={handlePostComment}
            disabled={!newComment.trim() || postingComment}
            className={`p-3 ml-2 rounded-full ${!newComment.trim() ? "opacity-50" : ""}`}
            style={{ backgroundColor: "#6C63FF" }}
          >
            {postingComment ? (
              <ActivityIndicator color="#FFF" size="small" />
            ) : (
              <Send size={20} color="#FFF" />
            )}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

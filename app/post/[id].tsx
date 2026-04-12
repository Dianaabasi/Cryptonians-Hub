import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  FlatList,
  Image,
} from "react-native";
import { AppModal, useAppModal } from "@/components/ui/AppModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Send, Heart, X } from "lucide-react-native";
import { PostCard, PostType } from "@/components/ui/PostCard";
import { SkeletonCard } from "@/components/ui/SkeletonLoader";
import { Modal } from "react-native";

// Internal component for handling individual comment likes efficiently
function CommentLikeButton({ commentId, initialCount }: { commentId: string; initialCount: number }) {
  const { profile } = useAuthStore();
  const { theme } = useThemeStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  
  const [likesCount, setLikesCount] = useState(initialCount);
  const [hasLiked, setHasLiked] = useState(false);

  useEffect(() => {
    setLikesCount(initialCount);
    checkIfLiked();
  }, [commentId, initialCount]);

  const checkIfLiked = async () => {
    if (profile?.id) {
      const { data } = await supabase
        .from('comment_likes')
        .select('id')
        .eq('comment_id', commentId)
        .eq('user_id', profile.id)
        .maybeSingle();
      if (data) setHasLiked(true);
    }
  };

  const handleLike = async () => {
    if (!profile?.id) return;
    
    const currentlyLiked = hasLiked;
    setHasLiked(!currentlyLiked);
    setLikesCount(prev => prev + (currentlyLiked ? -1 : 1));

    if (currentlyLiked) {
      await supabase.from('comment_likes').delete().match({ comment_id: commentId, user_id: profile.id });
    } else {
      await supabase.from('comment_likes').insert({ comment_id: commentId, user_id: profile.id });
    }
  };

  return (
    <TouchableOpacity 
      onPress={handleLike}
      className="flex-row items-center p-1"
      hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
    >
      <Heart 
        size={14} 
        color={hasLiked ? "#EF4444" : colors.textSecondary} 
        fill={hasLiked ? "#EF4444" : "transparent"} 
      />
      {likesCount > 0 && (
        <Text 
          className={`ml-1 text-xs ${hasLiked ? "text-red-500" : ""}`}
          style={!hasLiked ? { color: colors.textSecondary } : undefined}
        >
          {likesCount}
        </Text>
      )}
    </TouchableOpacity>
  );
}

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
  likes_count: number;
  replies?: {
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
  }[];
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

  // Modals state
  const [imageModalVisible, setImageModalVisible] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [likesModalVisible, setLikesModalVisible] = useState(false);
  const [postLikers, setPostLikers] = useState<any[]>([]);
  const [loadingLikers, setLoadingLikers] = useState(false);
  const [replyingTo, setReplyingTo] = useState<{ id: string; username: string } | null>(null);
  const { showModal, modalProps } = useAppModal();

  useEffect(() => {
    if (id) {
      fetchPostAndComments();
    }
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const channel = supabase.channel(`public:post:${id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments', filter: `post_id=eq.${id}` }, fetchPostAndComments)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comment_replies' }, fetchPostAndComments)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [id]);

  const fetchPostAndComments = async () => {
    try {
      setLoading(true);
      // Fetch Post
      const { data: postData, error: postError } = await supabase
        .from("posts")
        .select(`
          id, content, image_url, is_job_post, created_at,
          author:author_id (id, full_name, username, avatar_url, role),
          likes:likes(count),
          comments:comments(count)
        `)
        .eq("id", id)
        .single();

      if (postError) throw postError;

      if (postData) {
        setPost({
          ...postData,
          author: Array.isArray(postData.author) ? postData.author[0] : postData.author,
          likes_count: (postData.likes as any)?.[0]?.count ?? 0,
          comments_count: (postData.comments as any)?.[0]?.count ?? 0,
          has_liked: false,
        } as PostType);
      }

      // Fetch Comments
      const { data: commentsData } = await supabase
        .from("comments")
        .select(`
          id, content, created_at,
          author:author_id (id, full_name, username, avatar_url, role),
          likes:comment_likes(count),
          replies:comment_replies(
            id, content, created_at,
            author:author_id(id, full_name, username, avatar_url, role)
          )
        `)
        .eq("post_id", id)
        .order("created_at", { ascending: true });

      if (commentsData) {
        setComments(
          commentsData.map(c => ({
            ...c,
            author: Array.isArray(c.author) ? c.author[0] : c.author,
            likes_count: (c.likes as any)?.[0]?.count ?? 0,
            replies: c.replies?.map((r: any) => ({
              ...r,
              author: Array.isArray(r.author) ? r.author[0] : r.author,
            })).sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
          })) as CommentType[]
        );
      }
    } catch (err) {
      console.error(err);
      showModal({ title: "Error", message: "Could not load post details.", variant: "error" });
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const fetchPostLikers = async () => {
    setLoadingLikers(true);
    setLikesModalVisible(true);
    try {
      const { data } = await supabase
        .from("likes")
        .select(`
          user:user_id(id, full_name, username, avatar_url, role)
        `)
        .eq("post_id", id)
        .order("created_at", { ascending: false });

      if (data) {
        setPostLikers(data.map(d => Array.isArray(d.user) ? d.user[0] : d.user));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingLikers(false);
    }
  };

  const handlePostComment = async () => {
    if (!newComment.trim() || !profile?.id) return;

    setPostingComment(true);
    try {
      let insertedId = null;
      if (replyingTo) {
        const { data, error } = await supabase
          .from("comment_replies")
          .insert({
            comment_id: replyingTo.id,
            author_id: profile.id,
            content: newComment.trim(),
          }).select("id").single();
        if (error) throw error;
        insertedId = data?.id;
      } else {
        const { data, error } = await supabase
          .from("comments")
          .insert({
            post_id: id,
            author_id: profile.id,
            content: newComment.trim(),
          }).select("id").single();
        if (error) throw error;
        insertedId = data?.id;
      }

      if (insertedId) {
        const mentions = newComment.match(/@([a-zA-Z0-9_]+)/g);
        if (mentions && mentions.length > 0) {
          const usernames = mentions.map((m) => m.slice(1));
          await supabase.rpc("bulk_notify_mentions", {
            p_usernames: usernames,
            p_actor_id: profile.id,
            p_reference_id: insertedId,
            p_type: replyingTo ? "new_reply" : "new_comment",
            p_title: "You were mentioned!",
            p_message: replyingTo ? "Someone tagged you in a reply." : "Someone tagged you in a comment.",
          });
        }
      }

      setNewComment("");
      setReplyingTo(null);
      fetchPostAndComments();
    } catch (error) {
      showModal({ title: "Error", message: "Could not post your comment.", variant: "error" });
    } finally {
      setPostingComment(false);
    }
  };

  const handleDeleteComment = (commentId: string, authorId: string) => {
    if (authorId !== profile?.id && profile?.role !== 'admin' && profile?.role !== 'mod') return;
    
    showModal({
      title: "Confirm Delete",
      message: "Delete this comment?",
      variant: "confirm",
      buttons: [
        { text: "Cancel", style: "cancel", onPress: () => {} },
        { text: "Delete", style: "destructive", onPress: async () => {
          await supabase.from("comments").delete().eq("id", commentId);
          setComments(prev => prev.filter(c => c.id !== commentId));
        }},
      ],
    });
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
            <Text className="text-base mb-1" style={{ color: colors.text }}>
              {item.content}
            </Text>
            <View className="flex-row items-center mt-1">
              <CommentLikeButton commentId={item.id} initialCount={item.likes_count || 0} />
              <TouchableOpacity onPress={() => setReplyingTo({ id: item.id, username: item.author.username })} className="ml-4 p-1">
                <Text style={{ color: colors.textSecondary, fontSize: 12, fontWeight: '500' }}>Reply</Text>
              </TouchableOpacity>
            </View>

            {item.replies && item.replies.length > 0 && (
              <View className="mt-3 pl-3 border-l-2" style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}>
                {item.replies.map((reply) => (
                  <View key={reply.id} className="mb-3">
                    <TouchableOpacity 
                      className="flex-row items-center mb-1"
                      onPress={() => router.push(`/profile/${reply.author.id}`)}
                    >
                      <View className={`w-6 h-6 rounded-full mr-2 items-center justify-center overflow-hidden ${isDark ? "bg-[#3A3A3C]" : "bg-gray-300"}`}>
                        {reply.author.avatar_url ? (
                          <Image source={{ uri: reply.author.avatar_url }} className="w-full h-full" />
                        ) : (
                          <Text className="text-[10px] font-bold" style={{ color: colors.textSecondary }}>
                            {reply.author.username.charAt(0).toUpperCase()}
                          </Text>
                        )}
                      </View>
                      <Text className="font-bold text-xs" style={{ color: colors.text }}>{reply.author.full_name}</Text>
                      <Text className="text-[10px] ml-1.5" style={{ color: colors.textSecondary }}>@{reply.author.username}</Text>
                    </TouchableOpacity>
                    <Text className="text-sm ml-8" style={{ color: colors.text }}>{reply.content}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  return (
    <>
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
                  <PostCard 
                    post={post} 
                    hideCommentLink 
                    onDelete={() => router.back()} 
                    onImagePress={(url) => {
                      setSelectedImage(url);
                      setImageModalVisible(true);
                    }}
                    onLikesPress={fetchPostLikers}
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

        {/* Reply Indicator Banner */}
        {replyingTo && (
          <View className="px-5 py-2 flex-row justify-between items-center" style={{ backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6" }}>
            <Text className="font-medium text-xs text-[#6C63FF]">
              Replying to @{replyingTo.username}
            </Text>
            <TouchableOpacity onPress={() => setReplyingTo(null)}>
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Comment Input */}
        <View className="flex-row items-end px-4 py-3 border-t" style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}>
          <TextInput
            value={newComment}
            onChangeText={setNewComment}
            placeholder={replyingTo ? "Write a reply..." : "Add a comment..."}
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

      {/* Image Fullscreen Modal */}
      <Modal
        visible={imageModalVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setImageModalVisible(false)}
      >
        <View className="flex-1 bg-black justify-center items-center">
          <TouchableOpacity 
            className="absolute top-12 right-5 z-10 p-2 bg-black/50 rounded-full"
            onPress={() => setImageModalVisible(false)}
          >
            <X size={24} color="#FFF" />
          </TouchableOpacity>
          {selectedImage && (
            <Image 
              source={{ uri: selectedImage }} 
              className="w-full h-full"
              resizeMode="contain"
            />
          )}
        </View>
      </Modal>

      {/* Who Liked Dropdown / Popup Modal */}
      <Modal
        visible={likesModalVisible}
        transparent={true}
        animationType="slide"
        onRequestClose={() => setLikesModalVisible(false)}
      >
        <TouchableOpacity 
          activeOpacity={1} 
          onPress={() => setLikesModalVisible(false)}
          className="flex-1 justify-end bg-black/40"
        >
          <TouchableOpacity 
            activeOpacity={1} 
            className={`w-full max-h-[70%] rounded-t-3xl pt-2 pb-8 ${isDark ? "bg-[#1C1C1E]" : "bg-white"}`}
          >
            <View className="items-center mb-4">
              <View className={`w-12 h-1 rounded-full ${isDark ? "bg-[#3A3A3C]" : "bg-gray-300"}`} />
            </View>
            <View className="px-5 border-b pb-3 mb-2" style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}>
              <Text className="text-xl font-bold text-center" style={{ color: colors.text }}>Liked by</Text>
            </View>
            
            {loadingLikers ? (
              <View className="py-10 items-center justify-center">
                <ActivityIndicator color="#6C63FF" />
              </View>
            ) : postLikers.length === 0 ? (
              <View className="py-10 items-center justify-center">
                <Text style={{ color: colors.textSecondary }}>No likes yet.</Text>
              </View>
            ) : (
              <FlatList
                data={postLikers}
                keyExtractor={(item, index) => item?.id || index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity 
                    onPress={() => {
                      setLikesModalVisible(false);
                      router.push(`/profile/${item.id}`);
                    }}
                    className={`flex-row items-center px-5 py-3 border-b ${isDark ? "border-[#2C2C2E]" : "border-gray-50"}`}
                  >
                    <View className={`w-10 h-10 rounded-full mr-3 items-center justify-center overflow-hidden ${isDark ? "bg-[#2C2C2E]" : "bg-gray-200"}`}>
                      {item.avatar_url ? (
                        <Image source={{ uri: item.avatar_url }} className="w-full h-full" />
                      ) : (
                        <Text className="text-base font-bold" style={{ color: colors.textSecondary }}>
                          {item.username?.charAt(0).toUpperCase()}
                        </Text>
                      )}
                    </View>
                    <View>
                      <Text className="font-bold text-base" style={{ color: colors.text }}>{item.full_name}</Text>
                      <Text className="text-sm" style={{ color: colors.textSecondary }}>@{item.username}</Text>
                    </View>
                  </TouchableOpacity>
                )}
              />
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
    <AppModal {...modalProps} />
    </>
  );
}

import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TextInput, TouchableOpacity, FlatList,
  KeyboardAvoidingView, Platform, ActivityIndicator, Image,
  Pressable, Modal
} from "react-native";
import { AppModal, useAppModal } from "@/components/ui/AppModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import {
  useAudioPlayer, useAudioPlayerStatus,
  useAudioRecorder, useAudioRecorderState,
  RecordingPresets,
  setAudioModeAsync,
  requestRecordingPermissionsAsync,
} from "expo-audio";
import { decode } from "base64-arraybuffer";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import {
  ArrowLeft, Send, Hash, Check, CheckCheck,
  ImageIcon, Mic, Square, Play, Pause, X, Trash2, Copy, Reply
} from "lucide-react-native";
import { Swipeable, GestureHandlerRootView } from "react-native-gesture-handler";
import * as Clipboard from "expo-clipboard";
import { useAudioStore } from "@/stores/audioStore";

// ─── Types ────────────────────────────────────────────────────────────────────
interface Message {
  id: string;
  chat_id?: string;
  sender_id: string;
  content: string;
  media_url?: string | null;
  media_type?: "image" | "audio" | null;
  reply_to_id?: string | null;
  reply_to_content?: string;
  created_at: string;
  is_optimistic?: boolean;
  sender?: { id: string; full_name: string; username: string; avatar_url: string };
}

// ─── Audio Player ─────────────────────────────────────────────────────────────
function AudioPlayer({ uri, isMe, isDark, colors }: {
  uri: string; isMe: boolean; isDark: boolean; colors: any;
}) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);

  const { currentUri, isPlaying, setAudio, togglePlayPause } = useAudioStore();
  const isActive = currentUri === uri;
  
  const playing = isActive ? isPlaying : false;
  const duration = (status.duration ?? 0) * 1000;

  const formatTime = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  };

  const togglePlay = async () => {
    if (isActive) {
      togglePlayPause();
    } else {
      setAudio(uri);
    }
  };

  const progress = duration > 0 ? (status.currentTime ?? 0) / (status.duration ?? 1) : 0;
  const bgColor = isMe ? "rgba(255,255,255,0.15)" : isDark ? "#3C3C3E" : "#E5E7EB";
  const accentColor = isMe ? "#FFF" : "#6C63FF";
  const subColor = isMe ? "rgba(255,255,255,0.7)" : colors.textSecondary;

  return (
    <View className="flex-row items-center gap-3" style={{ minWidth: 180 }}>
      <TouchableOpacity
        onPress={togglePlay}
        className="w-9 h-9 rounded-full items-center justify-center"
        style={{ backgroundColor: bgColor }}
      >
        {playing
          ? <Pause size={16} color={accentColor} />
          : <Play size={16} color={accentColor} style={{ marginLeft: 2 }} />
        }
      </TouchableOpacity>

      {/* Progress bar */}
      <View className="flex-1 h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: bgColor }}>
        <View
          className="h-full rounded-full"
          style={{ width: `${progress * 100}%`, backgroundColor: accentColor }}
        />
      </View>

      <Text className="text-xs font-medium" style={{ color: subColor }}>
        {playing ? "Playing..." : formatTime(duration)}
      </Text>
    </View>
  );
}

// ─── Image fullscreen viewer ──────────────────────────────────────────────────
function ImageViewer({ uri, onClose }: { uri: string; onClose: () => void }) {
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View className="flex-1 bg-black/95 items-center justify-center">
        <TouchableOpacity
          onPress={onClose}
          className="absolute top-12 right-5 z-10 w-10 h-10 rounded-full bg-white/10 items-center justify-center"
        >
          <X size={22} color="#FFF" />
        </TouchableOpacity>
        <Image source={{ uri }} style={{ width: "100%", height: "80%" }} resizeMode="contain" />
      </View>
    </Modal>
  );
}

// ─── Main Chat Screen ─────────────────────────────────────────────────────────
export default function ChatRoomScreen() {
  const { id: routeId } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useThemeStore();
  const { profile } = useAuthStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(true);
  const [chatId, setChatId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputText, setInputText] = useState("");
  const [title, setTitle] = useState("Chat");
  const [isGroupChat, setIsGroupChat] = useState(false);
  const [otherAvatarUrl, setOtherAvatarUrl] = useState<string | null>(null);

  // Read receipts
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(null);

  // Media
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Voice recording — expo-audio hooks
  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recorderState = useAudioRecorderState(recorder, 500);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const MAX_RECORDING_SECS = 60;

  const flatListRef = useRef<FlatList>(null);
  const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
  const [replyingToMessage, setReplyingToMessage] = useState<Message | null>(null);
  const { showModal, modalProps } = useAppModal();

  useEffect(() => {
    if (routeId) resolveChatRoom();
  }, [routeId]);

  useEffect(() => {
    if (!chatId) return;
    fetchMessages();
    markAsRead(chatId);

    // Make channel topic unique per mount to survive Expo Fast Refresh / Strict Mode
    const channelName = `chat_${chatId}_${Date.now()}`;
    const channel = supabase
      .channel(channelName)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `chat_id=eq.${chatId}` }, async (payload) => {
        const newMsg = payload.new as Message;
        
        // If it's a reply, fetch the reply_to_content to embed it smoothly
        if (newMsg.reply_to_id) {
           const { data: related } = await supabase.from("chat_messages").select("content").eq("id", newMsg.reply_to_id).single();
           if (related) newMsg.reply_to_content = related.content;
        }

        appendIncomingMessage(newMsg);
        markAsRead(chatId);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "chat_participants", filter: `chat_id=eq.${chatId}` }, () => {
        fetchOtherReadAt(chatId);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [chatId]);

  // Auto-stop recording at 60s
  useEffect(() => {
    if (isRecording) {
      recordingTimerRef.current = setInterval(() => {
        setRecordingSeconds((s) => {
          if (s + 1 >= MAX_RECORDING_SECS) {
            stopRecording(true);
            return 0;
          }
          return s + 1;
        });
      }, 1000);
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      setRecordingSeconds(0);
    }
    return () => { if (recordingTimerRef.current) clearInterval(recordingTimerRef.current); };
  }, [isRecording]);

  // ─── Room resolver ──────────────────────────────────────────────────────
  const resolveChatRoom = async () => {
    try {
      setChatId(routeId);
      const { data: room } = await supabase
        .from("chat_rooms")
        .select("id, name, is_direct, niche_id, niches(name)")
        .eq("id", routeId)
        .single();

      if (room) {
        if (!room.is_direct && room.niches) {
          const nicheName = Array.isArray(room.niches) ? room.niches[0]?.name : (room.niches as any)?.name;
          if (nicheName) setTitle(`${nicheName} Chat`);
          setIsGroupChat(true);
        } else {
          setIsGroupChat(false);
          const { data: participants } = await supabase
            .from("chat_participants")
            .select("user:profiles(full_name, username, avatar_url)")
            .eq("chat_id", routeId)
            .neq("user_id", profile?.id ?? "");

          if (participants?.length) {
            const other = Array.isArray(participants[0].user) ? participants[0].user[0] : (participants[0].user as any);
            setTitle(other?.full_name || other?.username || "Chat");
            setOtherAvatarUrl(other?.avatar_url || null);
          }
          fetchOtherReadAt(routeId);
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // ─── Read receipts ──────────────────────────────────────────────────────
  const markAsRead = async (cId: string) => {
    if (!profile?.id) return;
    await supabase.from("chat_participants")
      .update({ last_read_at: new Date().toISOString() })
      .match({ chat_id: cId, user_id: profile.id });
  };

  const fetchOtherReadAt = async (cId: string) => {
    const { data } = await supabase.from("chat_participants")
      .select("last_read_at")
      .eq("chat_id", cId)
      .neq("user_id", profile?.id ?? "")
      .single();
    if (data?.last_read_at) setOtherLastReadAt(data.last_read_at);
  };

  // ─── Messages ───────────────────────────────────────────────────────────
  const fetchMessages = async () => {
    const { data, error } = await supabase
      .from("chat_messages")
      .select(`
        id, content, media_url, media_type, created_at, sender_id, reply_to_id,
        sender:profiles(id, full_name, username, avatar_url),
        reply_to:reply_to_id(content)
      `)
      .eq("chat_id", chatId)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Fetch Messages Error:", error);
    }

    if (data) {
      setMessages(data.map((m: any) => ({
        ...m,
        sender: Array.isArray(m.sender) ? m.sender[0] : m.sender,
        reply_to_content: m.reply_to ? (Array.isArray(m.reply_to) ? m.reply_to[0]?.content : m.reply_to?.content) : null
      })) as Message[]);
    }
  };

  const appendIncomingMessage = async (msg: Message) => {
    if (msg.sender_id === profile?.id) return;
    const { data } = await supabase.from("profiles")
      .select("id, full_name, username, avatar_url")
      .eq("id", msg.sender_id).single();
    setMessages((prev) => [{ ...msg, sender: data as any }, ...prev]);
  };

  // ─── Upload helper ──────────────────────────────────────────────────────
  const uploadToStorage = async (
    base64: string, ext: string, mimeType: string, folder: string
  ): Promise<string | null> => {
    const filename = `${folder}/${profile?.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage
      .from("chat-media")
      .upload(filename, decode(base64), { contentType: mimeType, upsert: true });
    if (error) throw error;
    const { data } = supabase.storage.from("chat-media").getPublicUrl(filename);
    return data.publicUrl;
  };

  // ─── Send message ───────────────────────────────────────────────────────
  const sendMessage = async (opts: {
    content?: string;
    mediaUrl?: string;
    mediaType?: "image" | "audio";
  }) => {
    if (!chatId || !profile?.id) return;
    const tempId = `temp-${Date.now()}`;
    const optimistic: Message = {
      id: tempId,
      chat_id: chatId,
      sender_id: profile.id,
      content: opts.content ?? "",
      media_url: opts.mediaUrl ?? null,
      media_type: opts.mediaType ?? null,
      reply_to_id: replyingToMessage?.id || null,
      reply_to_content: replyingToMessage?.content || (replyingToMessage?.media_type ? 'Media Message' : ''),
      created_at: new Date().toISOString(),
      is_optimistic: true,
      sender: profile as any,
    };
    setMessages((prev) => [optimistic, ...prev]);

    const { data: inserted, error } = await supabase
      .from("chat_messages")
      .insert({
        chat_id: chatId,
        sender_id: profile.id,
        content: opts.content ?? "",
        media_url: opts.mediaUrl ?? null,
        media_type: opts.mediaType ?? null,
        reply_to_id: replyingToMessage?.id || null,
      })
      .select("id")
      .single();

    setReplyingToMessage(null);

    if (error) {
      showModal({ title: "Error", message: "Could not send message.", variant: "error" });
      setMessages((prev) => prev.filter((m) => m.id !== tempId));
    } else if (inserted) {
      setMessages((prev) =>
        prev.map((m) => m.id === tempId ? { ...m, id: inserted.id, is_optimistic: false } : m)
      );
    }
  };

  const handleSendText = async () => {
    const text = inputText.trim();
    if (!text) return;
    setInputText("");
    await sendMessage({ content: text });
  };

  // ─── Image/video picker ─────────────────────────────────────────────────
  const handlePickMedia = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: false,
      quality: 0.8,
      base64: true,
    });

    if (result.canceled || !result.assets[0].base64) return;

    setUploadingMedia(true);
    try {
      const asset = result.assets[0];
      const ext = (asset.uri.split(".").pop() || "jpg").toLowerCase();
      const url = await uploadToStorage(asset.base64!, ext, `image/${ext}`, "images");
      if (url) await sendMessage({ mediaUrl: url, mediaType: "image" });
    } catch {
      showModal({ title: "Upload Failed", message: "Could not upload image.", variant: "error" });
    } finally {
      setUploadingMedia(false);
    }
  };

  // ─── Voice recording ────────────────────────────────────────────────────
  const startRecording = async () => {
    try {
      const { granted } = await requestRecordingPermissionsAsync();
      if (!granted) { showModal({ title: "Permission Needed", message: "Microphone access is required.", variant: "warning" }); return; }

      await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
      await recorder.prepareToRecordAsync();
      recorder.record();
      setIsRecording(true);
    } catch {
      showModal({ title: "Error", message: "Could not start recording.", variant: "error" });
    }
  };

  const stopRecording = useCallback(async (autoStop = false) => {
    if (!isRecording) return;
    setIsRecording(false);

    try {
      await recorder.stop();
      await setAudioModeAsync({ allowsRecording: false });
      const uri = recorder.uri;

      if (!uri || (!autoStop && recordingSeconds < 1)) return; // too short

      const response = await fetch(uri);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64 = (reader.result as string).split(",")[1];
        setUploadingMedia(true);
        try {
          const url = await uploadToStorage(base64, "m4a", "audio/m4a", "voice");
          if (url) await sendMessage({ mediaUrl: url, mediaType: "audio" });
        } catch {
          showModal({ title: "Upload Failed", message: "Could not send voice note.", variant: "error" });
        } finally {
          setUploadingMedia(false);
        }
      };
      reader.readAsDataURL(blob);
    } catch (e) {
      console.error("Stop recording error:", e);
    }
  }, [isRecording, recorder, recordingSeconds, chatId, profile]);

  const cancelRecording = async () => {
    if (!isRecording) return;
    setIsRecording(false);
    try { await recorder.stop(); } catch {}
  };

  // ─── Tick indicator ─────────────────────────────────────────────────────
  const MessageTicks = ({ msg }: { msg: Message }) => {
    // Group chats: single tick always
    if (isGroupChat) return (
      <View className="mt-1 flex-row justify-end">
        <Check size={12} color="rgba(255,255,255,0.6)" />
      </View>
    );

    // DMs:
    // - is_optimistic → single faded tick (sending)
    // - confirmed in DB → single grey tick (sent, not yet seen)
    // - isSeen → double blue tick (seen)
    const isSeen = otherLastReadAt
      ? new Date(otherLastReadAt) > new Date(msg.created_at)
      : false;

    return (
      <View className="mt-1 flex-row justify-end">
        {msg.is_optimistic ? (
          <Check size={12} color="rgba(255,255,255,0.4)" />
        ) : isSeen ? (
          <CheckCheck size={12} color="#93C5FD" />
        ) : (
          <Check size={12} color="rgba(255,255,255,0.65)" />
        )}
      </View>
    );
  };

  // ─── Message renderer ───────────────────────────────────────────────────
  const renderMessageDateSeparator = (dateString: string) => {
    const d = new Date(dateString);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    let displayStr = "";
    if (d.toDateString() === today.toDateString()) displayStr = "Today";
    else if (d.toDateString() === yesterday.toDateString()) displayStr = "Yesterday";
    else displayStr = d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });

    return (
      <View className="items-center my-4">
        <View className={`px-3 py-1 rounded-full ${isDark ? "bg-[#2C2C2E]" : "bg-gray-200"}`}>
          <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>{displayStr}</Text>
        </View>
      </View>
    );
  };

  const renderMessage = ({ item, index }: { item: Message; index: number }) => {
    const isMe = item.sender_id === profile?.id;
    const showDateSeparator = index === messages.length - 1 || new Date(item.created_at).toDateString() !== new Date(messages[index + 1].created_at).toDateString();

    const renderLeftActions = () => {
      return (
        <View className="justify-center pl-4 pr-2">
          <Reply size={20} color={colors.textSecondary} />
        </View>
      );
    };

    let swipeableRow: any = null;

    return (
      <View>
        {showDateSeparator && renderMessageDateSeparator(item.created_at)}
        <Swipeable 
          ref={(ref) => { swipeableRow = ref; }}
          renderLeftActions={renderLeftActions} 
          onSwipeableOpen={(direction) => {
             setReplyingToMessage(item);
             swipeableRow?.close();
          }}
          friction={2}
        >
          <View className={`flex-row mb-4 px-4 ${isMe ? "justify-end" : "justify-start"}`}>
            {!isMe && (
              <TouchableOpacity
                onPress={() => item.sender?.id ? router.push(`/profile/${item.sender.id}` as any) : null}
                className={`w-8 h-8 rounded-full mr-2 mt-1 items-center justify-center flex-shrink-0 ${isDark ? "bg-[#2C2C2E]" : "bg-gray-200"}`}
              >
                {item.sender?.avatar_url
                  ? <Image source={{ uri: item.sender.avatar_url }} className="w-full h-full rounded-full" />
                  : <Text className="text-xs font-bold" style={{ color: colors.textSecondary }}>{item.sender?.username?.charAt(0).toUpperCase()}</Text>
                }
              </TouchableOpacity>
            )}

            <View style={{ maxWidth: "75%" }}>
              {!isMe && item.sender && (
                <Text className="text-[10px] ml-1 mb-1" style={{ color: colors.textSecondary }}>
                  {item.sender.full_name}
                </Text>
              )}

              <TouchableOpacity 
                onLongPress={() => setSelectedMessage(item)}
                activeOpacity={0.9}
                className={`${
                  isMe
                    ? "rounded-t-2xl rounded-bl-2xl bg-[#6C63FF]"
                    : `rounded-t-2xl rounded-br-2xl ${isDark ? "bg-[#2C2C2E]" : "bg-gray-100"}`
                } overflow-hidden`}
              >
                {item.reply_to_content && (
                  <View className="px-3 pt-2 pb-1 bg-black/10">
                    <Text style={{ color: isMe ? "rgba(255,255,255,0.7)" : colors.textSecondary, fontSize: 12 }} numberOfLines={1}>
                      Replying to: {item.reply_to_content}
                    </Text>
                  </View>
                )}
                {/* Image message */}
                {item.media_type === "image" && item.media_url && (
                  <TouchableOpacity onPress={() => setViewingImage(item.media_url!)}>
                    <Image
                      source={{ uri: item.media_url }}
                      style={{ width: 220, height: 160, borderRadius: 0 }}
                      resizeMode="cover"
                    />
                  </TouchableOpacity>
                )}

                {/* Audio message */}
                {item.media_type === "audio" && item.media_url && (
                  <View className="px-3 py-3">
                    <AudioPlayer uri={item.media_url} isMe={isMe} isDark={isDark} colors={colors} />
                  </View>
                )}

                {/* Text content */}
                {item.content ? (
                  <View className="px-4 py-3">
                    <Text style={{ color: isMe ? "#FFF" : colors.text, fontSize: 16 }}>
                      {item.content}
                    </Text>
                  </View>
                ) : null}

                {/* Padding for image-only messages to fit ticks */}
                {item.media_type === "image" && !item.content && isMe && (
                  <View className="px-3 pb-2">
                    <MessageTicks msg={item} />
                  </View>
                )}

                {/* Ticks for text/audio messages */}
                {item.content && isMe && (
                  <View className="px-4 pb-3 -mt-1">
                    <MessageTicks msg={item} />
                  </View>
                )}
                {item.media_type === "audio" && isMe && (
                  <View className="px-3 pb-2">
                    <MessageTicks msg={item} />
                  </View>
                )}
              </TouchableOpacity>
              <Text 
                className={`text-[10px] mt-1 mx-1 ${isMe ? "text-right" : "text-left"}`} 
                style={{ color: colors.textSecondary }}
              >
                {new Date(item.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              </Text>
            </View>
          </View>
        </Swipeable>
      </View>
    );
  };

  // ─── Recording UI ───────────────────────────────────────────────────────
  const formatRecTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  const renderToolbar = () => {
    if (isRecording) {
      return (
        <View
          className="px-4 py-3 border-t flex-row items-center gap-3"
          style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB", backgroundColor: isDark ? "#1C1C1E" : "#FFF" }}
        >
          {/* Cancel */}
          <TouchableOpacity onPress={cancelRecording} className="w-10 h-10 rounded-full bg-gray-500/20 items-center justify-center">
            <X size={20} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* Recording pulse indicator */}
          <View className="flex-1 flex-row items-center">
            <View className="w-2.5 h-2.5 rounded-full bg-red-500 mr-2" />
            <Text className="text-base font-semibold" style={{ color: colors.text }}>
              Recording… {formatRecTime(recordingSeconds)}
            </Text>
            <Text className="ml-2 text-xs" style={{ color: colors.textSecondary }}>
              (max 1:00)
            </Text>
          </View>

          {/* Stop & Send */}
          <TouchableOpacity
            onPress={() => stopRecording(false)}
            className="w-12 h-12 rounded-full bg-[#6C63FF] items-center justify-center"
          >
            <Square size={18} color="#FFF" fill="#FFF" />
          </TouchableOpacity>
        </View>
      );
    }

    return (
      <View>
        {replyingToMessage && (
          <View className="px-4 py-2 flex-row justify-between items-center" style={{ backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6", borderTopWidth: 1, borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}>
            <View className="flex-1 border-l-2 border-[#6C63FF] pl-2 mr-4">
              <Text className="text-xs font-bold text-[#6C63FF]">
                Replying to {replyingToMessage.sender?.username || "Message"}
              </Text>
              <Text className="text-xs" style={{ color: colors.textSecondary }} numberOfLines={1}>
                {replyingToMessage.content || (replyingToMessage.media_type === 'audio' ? 'Voice Message' : 'Image')}
              </Text>
            </View>
            <TouchableOpacity onPress={() => setReplyingToMessage(null)} className="p-1 rounded-full bg-gray-500/20">
              <X size={16} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>
        )}
        <View
          className="px-4 py-3 border-t flex-row items-end gap-2"
          style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB", backgroundColor: isDark ? "#0A0A0A" : "#FFFFFF" }}
        >
          {/* Image picker */}
          <TouchableOpacity
            onPress={handlePickMedia}
            disabled={uploadingMedia}
            className={`w-10 h-10 rounded-full items-center justify-center ${isDark ? "bg-[#2C2C2E]" : "bg-gray-100"}`}
          >
            {uploadingMedia
              ? <ActivityIndicator size="small" color="#6C63FF" />
              : <ImageIcon size={20} color="#6C63FF" />
            }
          </TouchableOpacity>

          {/* Text input */}
          <TextInput
            value={inputText}
            onChangeText={setInputText}
            placeholder="Type a message..."
            placeholderTextColor={colors.textSecondary}
            multiline
            style={{
              flex: 1,
              minHeight: 42,
              maxHeight: 120,
              paddingHorizontal: 14,
              paddingVertical: 10,
              borderRadius: 22,
              fontSize: 15,
              color: colors.text,
              backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6",
            }}
          />

          {/* Send OR Voice note button */}
          {inputText.trim() ? (
            <TouchableOpacity
              onPress={handleSendText}
              className="w-11 h-11 rounded-full bg-[#6C63FF] items-center justify-center"
            >
              <Send size={19} color="#FFF" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          ) : !isGroupChat ? (
            <TouchableOpacity
              onPress={startRecording}
              disabled={uploadingMedia}
              className={`w-11 h-11 rounded-full items-center justify-center ${isDark ? "bg-[#2C2C2E]" : "bg-gray-100"}`}
            >
              <Mic size={20} color="#6C63FF" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={handleSendText}
              disabled={!inputText.trim()}
              className="w-11 h-11 rounded-full bg-[#6C63FF]/40 items-center justify-center"
            >
              <Send size={19} color="#FFF" style={{ marginLeft: 2 }} />
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  // ─── Root render ────────────────────────────────────────────────────────
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
        {/* Header */}
        <View className="flex-row items-center px-4 py-3 border-b" style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}>
          <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <View
            className={`w-10 h-10 rounded-full items-center justify-center mr-3 overflow-hidden ${isDark ? "bg-[#2C2C2E]" : "bg-[#F3F4F6]"}`}
          >
            {isGroupChat ? (
              <Hash size={18} color="#6C63FF" />
            ) : otherAvatarUrl ? (
              <Image source={{ uri: otherAvatarUrl }} style={{ width: 40, height: 40, borderRadius: 20 }} />
            ) : (
              <Text className="font-bold text-lg" style={{ color: colors.text }}>{title.charAt(0)}</Text>
            )}
          </View>
          <View className="flex-1">
            <Text className="font-bold text-lg" style={{ color: colors.text }} numberOfLines={1}>{title}</Text>
            {isGroupChat && <Text className="text-xs text-[#6C63FF]">Community Chat</Text>}
          </View>
        </View>

        <KeyboardAvoidingView
          behavior="padding"
          keyboardVerticalOffset={Platform.OS === "ios" ? 88 : 0}
          className="flex-1"
        >
          {loading ? (
            <View className="flex-1 justify-center items-center">
              <ActivityIndicator size="large" color="#6C63FF" />
            </View>
          ) : (
            <FlatList
              ref={flatListRef}
              data={messages}
              keyExtractor={(item) => item.id}
              renderItem={renderMessage}
              inverted
              contentContainerStyle={{ padding: 16 }}
              showsVerticalScrollIndicator={false}
            />
          )}

          {renderToolbar()}
        </KeyboardAvoidingView>

        {/* Message Action Sheet Modal */}
        <Modal visible={!!selectedMessage} transparent animationType="fade" onRequestClose={() => setSelectedMessage(null)}>
          <TouchableOpacity activeOpacity={1} className="flex-1 bg-black/60 justify-end" onPress={() => setSelectedMessage(null)}>
            <View className="rounded-t-3xl pb-10 pt-4 px-6 shadow-xl" style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFF" }}>
              <View className="items-center mb-6">
                <View className="w-12 h-1.5 rounded-full" style={{ backgroundColor: isDark ? "#3C3C3E" : "#E5E7EB" }} />
              </View>
              
              {selectedMessage?.content && (
                <TouchableOpacity
                  className="flex-row items-center py-4 border-b"
                  style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}
                  onPress={async () => {
                    if (selectedMessage.content) await Clipboard.setStringAsync(selectedMessage.content);
                    setSelectedMessage(null);
                    showModal({ title: "Copied", message: "Message copied to clipboard!", variant: "success" });
                  }}
                >
                  <Copy size={22} color={colors.text} />
                  <Text className="ml-4 text-base font-semibold" style={{ color: colors.text }}>Copy Text</Text>
                </TouchableOpacity>
              )}

              {selectedMessage?.sender_id === profile?.id && (
                <TouchableOpacity
                  className="flex-row items-center py-4"
                  onPress={async () => {
                     if (!selectedMessage) return;
                     const { error } = await supabase.from("chat_messages").delete().eq("id", selectedMessage.id);
                     
                     if (error) {
                        console.error("Delete Message Error:", error);
                        showModal({ title: "Error", message: "Could not delete this message. You may not have permission.", variant: "error" });
                     } else {
                        setMessages(prev => prev.filter(m => m.id !== selectedMessage.id));
                        setSelectedMessage(null);
                     }
                  }}
                >
                  <Trash2 size={22} color="#EF4444" />
                  <Text className="ml-4 text-base font-semibold text-red-500">Delete Message</Text>
                </TouchableOpacity>
              )}
            </View>
          </TouchableOpacity>
        </Modal>

        {/* Full-screen image viewer */}
        {viewingImage && (
          <ImageViewer uri={viewingImage} onClose={() => setViewingImage(null)} />
        )}
      </SafeAreaView>
      <AppModal {...modalProps} />
    </GestureHandlerRootView>
  );
}

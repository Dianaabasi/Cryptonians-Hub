import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View, Text, TouchableOpacity, FlatList, TextInput,
  KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView
} from "react-native";
import { AppModal, useAppModal } from "@/components/ui/AppModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Send, CheckCircle, XCircle, Clock, AlertCircle } from "lucide-react-native";

// ─── Types ───────────────────────────────────────────────────────────────────
type TicketStatus = "open" | "in_progress" | "resolved" | "closed";

interface Ticket {
  id: string;
  subject: string;
  description: string;
  status: TicketStatus;
  user_id: string;
  created_at: string;
  user?: { full_name: string; username: string; avatar_url: string | null };
}

interface TicketMessage {
  id: string;
  ticket_id: string;
  sender_id: string;
  content: string;
  created_at: string;
  sender?: { full_name: string; username: string; avatar_url: string | null; role?: string };
}

// ─── Status config ────────────────────────────────────────────────────────────
const STATUS_CONFIG: Record<TicketStatus, { label: string; color: string; bg: string; icon: any }> = {
  open:        { label: "Open",        color: "#3B82F6", bg: "#3B82F6/15", icon: AlertCircle },
  in_progress: { label: "In Progress", color: "#F59E0B", bg: "#F59E0B/15", icon: Clock },
  resolved:    { label: "Resolved",    color: "#10B981", bg: "#10B981/15", icon: CheckCircle },
  closed:      { label: "Closed",      color: "#6B7280", bg: "#6B7280/15", icon: XCircle },
};

const STATUS_ORDER: TicketStatus[] = ["open", "in_progress", "resolved", "closed"];

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TicketDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { profile } = useAuthStore();
  const { theme } = useThemeStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const isStaff = profile?.role === "admin" || profile?.role === "mod";

  const [ticket, setTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [inputText, setInputText] = useState("");
  const [sending, setSending] = useState(false);
  const [changingStatus, setChangingStatus] = useState(false);
  const [showStatusPicker, setShowStatusPicker] = useState(false);
  const flatListRef = useRef<FlatList>(null);
  const { showModal, modalProps } = useAppModal();

  const isClosed = ticket?.status === "resolved" || ticket?.status === "closed";

  // ─── Fetch ──────────────────────────────────────────────────────────────────
  const fetchTicket = useCallback(async () => {
    const [{ data: t }, { data: msgs }] = await Promise.all([
      supabase
        .from("support_tickets")
        .select("*, user:profiles!support_tickets_user_id_fkey(full_name, username, avatar_url)")
        .eq("id", id)
        .single(),
      supabase
        .from("support_messages")
        .select("*, sender:profiles!support_messages_sender_id_fkey(full_name, username, avatar_url, role)")
        .eq("ticket_id", id)
        .order("created_at", { ascending: true }),
    ]);

    if (t) {
      setTicket(t as Ticket);
      
      const firstMsg: TicketMessage = {
        id: `desc-${t.id}`,
        ticket_id: t.id,
        sender_id: t.user_id,
        content: t.description,
        created_at: t.created_at,
        sender: { ...(t.user as any), role: "member" },
      };

      setMessages([firstMsg, ...((msgs || []) as TicketMessage[])]);
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    fetchTicket();

    // Real-time for new messages
    const channel = supabase
      .channel(`ticket_${id}`)
      .on("postgres_changes", {
        event: "INSERT",
        schema: "public",
        table: "support_messages",
        filter: `ticket_id=eq.${id}`,
      }, (payload) => {
        setMessages((prev) => [...prev, payload.new as TicketMessage]);
        setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
      })
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "support_tickets",
        filter: `id=eq.${id}`,
      }, (payload) => {
        setTicket((prev) => prev ? { ...prev, ...payload.new } : prev);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [id]);

  // ─── Send message ────────────────────────────────────────────────────────────
  const handleSend = async () => {
    const text = inputText.trim();
    if (!text || !profile?.id) return;
    setSending(true);
    setInputText("");
    try {
      const { error } = await supabase.from("support_messages").insert({
        ticket_id: id,
        sender_id: profile.id,
        content: text,
      });
      if (error) throw error;

      // If first staff reply → auto-move to in_progress
      if (isStaff && ticket?.status === "open") {
        await supabase
          .from("support_tickets")
          .update({ status: "in_progress", updated_at: new Date().toISOString() })
          .eq("id", id);
      }
      setTimeout(() => flatListRef.current?.scrollToEnd({ animated: true }), 100);
    } catch (error) {
      console.error("Message send error:", error);
      showModal({ title: "Error", message: "Could not send message.", variant: "error" });
      setInputText(text);
    } finally {
      setSending(false);
    }
  };

  // ─── Change status ───────────────────────────────────────────────────────────
  const handleStatusChange = async (newStatus: TicketStatus) => {
    setShowStatusPicker(false);
    setChangingStatus(true);
    try {
      const { error } = await supabase
        .from("support_tickets")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
      setTicket((prev) => prev ? { ...prev, status: newStatus } : prev);
    } catch {
      showModal({ title: "Error", message: "Could not update status.", variant: "error" });
    } finally {
      setChangingStatus(false);
    }
  };

  // ─── Render message ──────────────────────────────────────────────────────────
  const renderMessage = ({ item }: { item: TicketMessage }) => {
    const isOwnMessage = item.sender_id === profile?.id;
    const isStaffMsg = item.sender?.role === "admin" || item.sender?.role === "mod";

    // Staff messages → left-aligned purple bubble; own messages → right-aligned
    const alignRight = isOwnMessage;

    const bubbleBg = isStaffMsg && !isOwnMessage
      ? isDark ? "#2C2C2E" : "#F3F4F6"
      : isOwnMessage
      ? "#6C63FF"
      : isDark ? "#2C2C2E" : "#F3F4F6";

    const textColor = isOwnMessage ? "#FFF" : colors.text;
    const subColor = isOwnMessage ? "rgba(255,255,255,0.6)" : colors.textSecondary;

    const timeStr = new Date(item.created_at).toLocaleTimeString([], {
      hour: "2-digit", minute: "2-digit",
    });

    return (
      <View className={`px-4 py-1 flex-row ${alignRight ? "justify-end" : "justify-start"}`}>
        <View style={{ maxWidth: "78%" }}>
          {!isOwnMessage && (
            <Text className="text-xs font-semibold mb-1 ml-1" style={{ color: isStaffMsg ? "#6C63FF" : colors.textSecondary }}>
              {isStaffMsg ? "Support Team" : item.sender?.full_name ?? "User"}
            </Text>
          )}
          <View className="px-4 py-3 rounded-2xl" style={{ backgroundColor: bubbleBg }}>
            <Text style={{ color: textColor, fontSize: 15, lineHeight: 21 }}>{item.content}</Text>
          </View>
          <Text className="text-xs mt-1 mx-1" style={{ color: subColor, textAlign: alignRight ? "right" : "left" }}>
            {timeStr}
          </Text>
        </View>
      </View>
    );
  };

  // ─── Status pill ─────────────────────────────────────────────────────────────
  const StatusPill = ({ status }: { status: TicketStatus }) => {
    const cfg = STATUS_CONFIG[status];
    const Icon = cfg.icon;
    return (
      <View className="flex-row items-center px-3 py-1 rounded-full" style={{ backgroundColor: `${cfg.color}20` }}>
        <Icon size={12} color={cfg.color} />
        <Text className="text-xs font-bold ml-1" style={{ color: cfg.color }}>{cfg.label}</Text>
      </View>
    );
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View
        className="flex-row items-center px-4 py-3 border-b"
        style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}
      >
        <TouchableOpacity onPress={() => router.back()} className="p-2 mr-2">
          <ArrowLeft size={22} color={colors.text} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="font-bold text-base" style={{ color: colors.text }} numberOfLines={1}>
            {ticket?.subject}
          </Text>
        </View>
        <View className="ml-2">
          {isStaff ? (
            <TouchableOpacity onPress={() => setShowStatusPicker(true)} disabled={changingStatus}>
              {ticket && <StatusPill status={ticket.status} />}
            </TouchableOpacity>
          ) : (
            ticket && <StatusPill status={ticket.status} />
          )}
        </View>
      </View>

      {/* Status picker for staff */}
      {showStatusPicker && (
        <View
          className="absolute top-20 right-4 z-50 rounded-2xl overflow-hidden shadow-xl"
          style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFF", minWidth: 170, elevation: 12 }}
        >
          {STATUS_ORDER.map((s) => {
            const cfg = STATUS_CONFIG[s];
            const Icon = cfg.icon;
            return (
              <TouchableOpacity
                key={s}
                onPress={() => handleStatusChange(s)}
                className="flex-row items-center px-4 py-3"
                style={{ backgroundColor: ticket?.status === s ? `${cfg.color}15` : "transparent" }}
              >
                <Icon size={16} color={cfg.color} />
                <Text className="font-semibold ml-2" style={{ color: cfg.color }}>{cfg.label}</Text>
              </TouchableOpacity>
            );
          })}
          <TouchableOpacity
            onPress={() => setShowStatusPicker(false)}
            className="border-t items-center py-2"
            style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}
          >
            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Cancel</Text>
          </TouchableOpacity>
        </View>
      )}

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : "padding"}
        keyboardVerticalOffset={0}
      >
        {/* Messages */}
        <FlatList
          ref={flatListRef}
          data={messages}
          keyExtractor={(item) => item.id}
          renderItem={renderMessage}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 8 }}
          onLayout={() => flatListRef.current?.scrollToEnd({ animated: false })}
          ListEmptyComponent={null}
        />

        {/* Closed notice or input */}
        {isClosed ? (
          <View
            className="mx-4 mb-4 px-4 py-3 rounded-2xl"
            style={{ backgroundColor: isDark ? "#2C2C2E" : "#F3F4F6" }}
          >
            <Text className="text-center text-sm" style={{ color: colors.textSecondary }}>
              This ticket has been {ticket?.status}. Open a new ticket if you need further help.
            </Text>
          </View>
        ) : (
          <View
            className="flex-row items-end px-4 py-3 border-t"
            style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}
          >
            <TextInput
              value={inputText}
              onChangeText={setInputText}
              placeholder="Type a message…"
              placeholderTextColor={colors.textSecondary}
              multiline
              className="flex-1 px-4 py-3 rounded-2xl text-base max-h-32"
              style={{
                backgroundColor: isDark ? "#2C2C2E" : "#F3F4F6",
                color: colors.text,
              }}
            />
            <TouchableOpacity
              onPress={handleSend}
              disabled={!inputText.trim() || sending}
              className="w-11 h-11 rounded-full items-center justify-center ml-2"
              style={{ backgroundColor: inputText.trim() ? "#6C63FF" : isDark ? "#2C2C2E" : "#E5E7EB" }}
            >
              {sending
                ? <ActivityIndicator size="small" color="#FFF" />
                : <Send size={18} color={inputText.trim() ? "#FFF" : colors.textSecondary} />
              }
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
      <AppModal {...modalProps} />
    </SafeAreaView>
  );
}

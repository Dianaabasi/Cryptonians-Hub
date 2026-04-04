import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { useRouter } from "expo-router";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  ChevronRight,
  Clock,
  Mail,
  Plus,
  Send,
  Ticket,
  Users,
  X,
  XCircle
} from "lucide-react-native";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Linking,
  Modal,
  RefreshControl,
  ScrollView,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

// ─── Types ────────────────────────────────────────────────────────────────────
type TicketStatus = "open" | "in_progress" | "resolved" | "closed";
type FilterTab = "all" | TicketStatus;

const SUBJECTS = [
  "General Inquiry",
  "Bug Report",
  "Feature Request",
  "Account Issue",
  "Other",
];

const STATUS_CONFIG: Record<
  TicketStatus,
  { label: string; color: string; icon: any }
> = {
  open: { label: "Open", color: "#3B82F6", icon: AlertCircle },
  in_progress: { label: "In Progress", color: "#F59E0B", icon: Clock },
  resolved: { label: "Resolved", color: "#10B981", icon: CheckCircle },
  closed: { label: "Closed", color: "#6B7280", icon: XCircle },
};

interface Ticket {
  id: string;
  subject: string;
  status: TicketStatus;
  user_id: string;
  created_at: string;
  updated_at: string;
  user?: { full_name: string; username: string; avatar_url: string | null };
  latest_message?: string;
}

// ─── Status Pill ──────────────────────────────────────────────────────────────
function StatusPill({ status }: { status: TicketStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <View
      className="flex-row items-center px-2 py-0.5 rounded-full"
      style={{ backgroundColor: `${cfg.color}20` }}
    >
      <Icon size={10} color={cfg.color} />
      <Text className="text-[10px] font-bold ml-1" style={{ color: cfg.color }}>
        {cfg.label}
      </Text>
    </View>
  );
}

// ─── New Ticket Modal ─────────────────────────────────────────────────────────
function NewTicketModal({
  visible,
  onClose,
  onCreated,
  isDark,
  colors,
}: {
  visible: boolean;
  onClose: () => void;
  onCreated: () => void;
  isDark: boolean;
  colors: any;
}) {
  const { profile } = useAuthStore();
  const [subject, setSubject] = useState(SUBJECTS[0]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [subjectOpen, setSubjectOpen] = useState(false);

  const reset = () => {
    setSubject(SUBJECTS[0]);
    setMessage("");
    setSubjectOpen(false);
  };

  const handleSubmit = async () => {
    if (!message.trim()) {
      Alert.alert(
        "Required",
        "Please fill in your message.",
      );
      return;
    }
    setLoading(true);
    try {
      const { data: ticket, error } = await supabase
        .from("support_tickets")
        .insert({
          user_id: profile?.id,
          subject,
          description: message.trim(),
          status: "open",
        })
        .select("id")
        .single();
      if (error) throw error;
      reset();
      onClose();
      onCreated();
    } catch (error) {
      console.error("Ticket creation error:", error);
      Alert.alert("Error", "Could not create ticket. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <View
        className="flex-1"
        style={{ backgroundColor: isDark ? "#121212" : "#F8F8F8" }}
      >
        {/* Header */}
        <View
          className="flex-row items-center justify-between px-5 pt-5 pb-4 border-b"
          style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}
        >
          <Text className="text-xl font-bold" style={{ color: colors.text }}>
            New Ticket
          </Text>
          <TouchableOpacity
            onPress={() => {
              reset();
              onClose();
            }}
            className="p-1"
          >
            <X size={22} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView
          className="flex-1 px-5 pt-5"
          keyboardShouldPersistTaps="handled"
        >
          {/* Subject picker */}
          <Text
            className="text-sm font-semibold mb-2"
            style={{ color: colors.textSecondary }}
          >
            Subject
          </Text>
          <TouchableOpacity
            onPress={() => setSubjectOpen(!subjectOpen)}
            className="flex-row items-center justify-between px-4 py-3.5 rounded-2xl mb-1"
            style={{
              backgroundColor: isDark ? "#1C1C1E" : "#FFF",
              borderWidth: 1,
              borderColor: isDark ? "#2C2C2E" : "#E5E7EB",
            }}
          >
            <Text style={{ color: colors.text }}>{subject}</Text>
            <ChevronRight
              size={16}
              color={colors.textSecondary}
              style={{
                transform: [{ rotate: subjectOpen ? "-90deg" : "90deg" }],
              }}
            />
          </TouchableOpacity>
          {subjectOpen && (
            <View
              className="rounded-2xl mb-3 overflow-hidden"
              style={{
                backgroundColor: isDark ? "#1C1C1E" : "#FFF",
                borderWidth: 1,
                borderColor: isDark ? "#2C2C2E" : "#E5E7EB",
              }}
            >
              {SUBJECTS.map((s, i) => (
                <TouchableOpacity
                  key={s}
                  onPress={() => {
                    setSubject(s);
                    setSubjectOpen(false);
                  }}
                  className="px-4 py-3 flex-row items-center"
                  style={{
                    backgroundColor:
                      subject === s ? "#6C63FF15" : "transparent",
                    borderTopWidth: i > 0 ? 1 : 0,
                    borderColor: isDark ? "#2C2C2E" : "#F3F4F6",
                  }}
                >
                  <View
                    className="w-2 h-2 rounded-full mr-3"
                    style={{
                      backgroundColor:
                        subject === s ? "#6C63FF" : "transparent",
                    }}
                  />
                  <Text
                    style={{
                      color: subject === s ? "#6C63FF" : colors.text,
                      fontWeight: subject === s ? "700" : "400",
                    }}
                  >
                    {s}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}


          {/* Message */}
          <Text
            className="text-sm font-semibold mb-2"
            style={{ color: colors.textSecondary }}
          >
            Message
          </Text>
          <TextInput
            value={message}
            onChangeText={setMessage}
            placeholder="Describe your issue in detail…"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={5}
            textAlignVertical="top"
            className="px-4 py-3.5 rounded-2xl text-base mb-8"
            style={{
              backgroundColor: isDark ? "#1C1C1E" : "#FFF",
              color: colors.text,
              minHeight: 120,
              borderWidth: 1,
              borderColor: isDark ? "#2C2C2E" : "#E5E7EB",
            }}
          />
        </ScrollView>

        {/* Submit */}
        <View
          className="px-5 pb-8 pt-3"
          style={{
            borderTopWidth: 1,
            borderColor: isDark ? "#2C2C2E" : "#E5E7EB",
          }}
        >
          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className="flex-row items-center justify-center py-4 rounded-2xl"
            style={{ backgroundColor: "#6C63FF", opacity: loading ? 0.7 : 1 }}
          >
            {loading ? (
              <ActivityIndicator color="#FFF" />
            ) : (
              <>
                <Send size={18} color="#FFF" />
                <Text className="text-white font-bold text-base ml-2">
                  Submit Ticket
                </Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function SupportScreen() {
  const router = useRouter();
  const { profile } = useAuthStore();
  const { theme } = useThemeStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const isStaff = profile?.role === "admin" || profile?.role === "mod";

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [newTicketVisible, setNewTicketVisible] = useState(false);
  const [activeFilter, setActiveFilter] = useState<FilterTab>("all");

  // ─── Fetch ────────────────────────────────────────────────────────────────
  const fetchTickets = useCallback(async () => {
    try {
      let query = supabase
        .from("support_tickets")
        .select(
          "*, user:profiles!support_tickets_user_id_fkey(full_name, username, avatar_url)",
        )
        .order("updated_at", { ascending: false });

      if (!isStaff) {
        query = query.eq("user_id", profile?.id ?? "");
      }

      const { data } = await query;
      if (data) setTickets(data as Ticket[]);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [isStaff, profile?.id]);

  useEffect(() => {
    fetchTickets();
  }, []);

  const onRefresh = () => {
    setRefreshing(true);
    fetchTickets();
  };

  // ─── Filter tickets ───────────────────────────────────────────────────────
  const filtered =
    activeFilter === "all"
      ? tickets
      : tickets.filter((t) => t.status === activeFilter);

  const filterTabs: { key: FilterTab; label: string }[] = [
    { key: "all", label: "All" },
    { key: "open", label: "Open" },
    { key: "in_progress", label: "In Progress" },
    { key: "resolved", label: "Resolved" },
    { key: "closed", label: "Closed" },
  ];

  // ─── Relative time ────────────────────────────────────────────────────────
  const relativeTime = (iso: string) => {
    const diff = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(mins / 60);
    const days = Math.floor(hrs / 24);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    if (hrs < 24) return `${hrs}h ago`;
    return `${days}d ago`;
  };

  // ─── Ticket row ───────────────────────────────────────────────────────────
  const renderTicket = ({ item }: { item: Ticket }) => {
    const initials = item.user?.full_name?.charAt(0).toUpperCase() ?? "?";

    return (
      <TouchableOpacity
        onPress={() => router.push(`/support/ticket/${item.id}` as any)}
        className={`flex-row items-center p-4 mb-3 rounded-2xl ${isDark ? "bg-[#1C1C1E] border border-[#2C2C2E]" : "bg-white border border-gray-100"}`}
        style={{ elevation: 1 }}
        activeOpacity={0.75}
      >
        {/* Avatar (staff view only) */}
        {isStaff && (
          <View
            className="w-11 h-11 rounded-full mr-3 items-center justify-center"
            style={{ backgroundColor: "#6C63FF20" }}
          >
            <Text className="font-bold text-base" style={{ color: "#6C63FF" }}>
              {initials}
            </Text>
          </View>
        )}

        <View className="flex-1">
          {isStaff && (
            <Text
              className="text-xs font-semibold mb-0.5"
              style={{ color: "#6C63FF" }}
            >
              {item.user?.full_name} • @{item.user?.username}
            </Text>
          )}
          <View className="flex-row items-center justify-between mb-1">
            <Text
              className="font-bold text-base flex-1 mr-2"
              style={{ color: colors.text }}
              numberOfLines={1}
            >
              {item.subject}
            </Text>
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              {relativeTime(item.updated_at)}
            </Text>
          </View>
          <View className="flex-row items-center justify-between">
            <StatusPill status={item.status} />
          </View>
        </View>

        <ChevronRight size={16} color={colors.textSecondary} className="ml-2" />
      </TouchableOpacity>
    );
  };

  // ─── Member view ──────────────────────────────────────────────────────────
  const memberView = () => (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      renderItem={renderTicket}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.textSecondary}
        />
      }
      ListHeaderComponent={
        <View>
          {/* Email the team */}
          <TouchableOpacity
            onPress={() =>
              Linking.openURL(
                "mailto:officialscryptonians@gmail.com?subject=Support%20Request",
              )
            }
            className={`flex-row items-center p-4 mb-4 rounded-2xl ${isDark ? "bg-[#1C1C1E] border border-[#2C2C2E]" : "bg-white border border-gray-100"}`}
            activeOpacity={0.8}
          >
            <View className="w-11 h-11 rounded-full bg-[#6C63FF]/10 items-center justify-center mr-4">
              <Mail size={22} color="#6C63FF" />
            </View>
            <View className="flex-1">
              <Text
                className="font-bold text-base"
                style={{ color: colors.text }}
              >
                Message the Team
              </Text>
              <Text className="text-sm" style={{ color: colors.textSecondary }}>
                officialscryptonians@gmail.com
              </Text>
            </View>
            <ChevronRight size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* My Tickets heading */}
          <View className="flex-row items-center justify-between mb-3">
            <Text className="text-lg font-bold" style={{ color: colors.text }}>
              My Tickets
            </Text>
            <TouchableOpacity
              onPress={() => setNewTicketVisible(true)}
              className="flex-row items-center px-3 py-1.5 rounded-full bg-[#6C63FF]"
            >
              <Plus size={14} color="#FFF" />
              <Text className="text-white font-bold text-sm ml-1">New</Text>
            </TouchableOpacity>
          </View>

          {/* Filter tabs */}
          {tickets.length > 0 && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              className="mb-4"
            >
              {filterTabs.map((tab) => (
                <TouchableOpacity
                  key={tab.key}
                  onPress={() => setActiveFilter(tab.key)}
                  className="px-4 py-1.5 rounded-full mr-2"
                  style={{
                    backgroundColor:
                      activeFilter === tab.key
                        ? "#6C63FF"
                        : isDark
                          ? "#1C1C1E"
                          : "#F3F4F6",
                    borderWidth: 1,
                    borderColor:
                      activeFilter === tab.key
                        ? "#6C63FF"
                        : isDark
                          ? "#2C2C2E"
                          : "#E5E7EB",
                  }}
                >
                  <Text
                    className="text-sm font-semibold"
                    style={{
                      color:
                        activeFilter === tab.key
                          ? "#FFF"
                          : colors.textSecondary,
                    }}
                  >
                    {tab.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          )}
        </View>
      }
      ListEmptyComponent={
        !loading ? (
          <View className="items-center py-16">
            <View className="w-16 h-16 rounded-full bg-[#6C63FF]/10 items-center justify-center mb-4">
              <Ticket size={30} color="#6C63FF" />
            </View>
            <Text
              className="font-bold text-lg mb-1"
              style={{ color: colors.text }}
            >
              No tickets yet
            </Text>
            <Text
              className="text-center text-sm"
              style={{ color: colors.textSecondary }}
            >
              {`Tap "New" to open a support ticket\nor message the team directly.`}
            </Text>
          </View>
        ) : null
      }
    />
  );

  // ─── Admin/Mod view ───────────────────────────────────────────────────────
  const staffView = () => (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      renderItem={renderTicket}
      contentContainerStyle={{ paddingBottom: 120 }}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={onRefresh}
          tintColor={colors.textSecondary}
        />
      }
      ListHeaderComponent={
        <View>
          {/* Summary strip */}
          <View className="flex-row mb-5 gap-3">
            {(["open", "in_progress"] as TicketStatus[]).map((s) => {
              const cnt = tickets.filter((t) => t.status === s).length;
              const cfg = STATUS_CONFIG[s];
              return (
                <View
                  key={s}
                  className="flex-1 p-3 rounded-2xl"
                  style={{ backgroundColor: `${cfg.color}15` }}
                >
                  <Text
                    className="text-2xl font-black"
                    style={{ color: cfg.color }}
                  >
                    {cnt}
                  </Text>
                  <Text
                    className="text-xs font-semibold"
                    style={{ color: cfg.color }}
                  >
                    {cfg.label}
                  </Text>
                </View>
              );
            })}
          </View>

          {/* Filter tabs */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="mb-4"
          >
            {filterTabs.map((tab) => (
              <TouchableOpacity
                key={tab.key}
                onPress={() => setActiveFilter(tab.key)}
                className="px-4 py-1.5 rounded-full mr-2"
                style={{
                  backgroundColor:
                    activeFilter === tab.key
                      ? "#6C63FF"
                      : isDark
                        ? "#1C1C1E"
                        : "#F3F4F6",
                  borderWidth: 1,
                  borderColor:
                    activeFilter === tab.key
                      ? "#6C63FF"
                      : isDark
                        ? "#2C2C2E"
                        : "#E5E7EB",
                }}
              >
                <Text
                  className="text-sm font-semibold"
                  style={{
                    color:
                      activeFilter === tab.key ? "#FFF" : colors.textSecondary,
                  }}
                >
                  {tab.label}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      }
      ListEmptyComponent={
        !loading ? (
          <View className="items-center py-16">
            <View className="w-16 h-16 rounded-full bg-[#6C63FF]/10 items-center justify-center mb-4">
              <Users size={30} color="#6C63FF" />
            </View>
            <Text
              className="font-bold text-lg mb-1"
              style={{ color: colors.text }}
            >
              No tickets yet
            </Text>
            <Text
              className="text-center text-sm"
              style={{ color: colors.textSecondary }}
            >
              All support requests will appear here.
            </Text>
          </View>
        ) : null
      }
    />
  );

  // ─── Skeleton ─────────────────────────────────────────────────────────────
  const SkeletonRow = () => (
    <View
      className={`p-4 mb-3 rounded-2xl ${isDark ? "bg-[#1C1C1E]" : "bg-white border border-gray-100"}`}
    >
      <View className="flex-row items-center mb-2">
        <View
          className="flex-1 h-4 rounded-lg mr-4"
          style={{ backgroundColor: isDark ? "#2C2C2E" : "#E5E7EB" }}
        />
        <View
          className="w-12 h-3 rounded-lg"
          style={{ backgroundColor: isDark ? "#2C2C2E" : "#E5E7EB" }}
        />
      </View>
      <View
        className="h-3 rounded-lg w-2/3"
        style={{ backgroundColor: isDark ? "#2C2C2E" : "#E5E7EB" }}
      />
    </View>
  );

  return (
    <SafeAreaView
      className="flex-1"
      style={{ backgroundColor: colors.background }}
    >
      {/* Header */}
      <View
        className="flex-row items-center px-5 pt-4 pb-4 border-b"
        style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}
      >
        <TouchableOpacity
          onPress={() => router.back()}
          className="p-2 -ml-2 mr-3"
        >
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <View className="flex-1">
          <Text className="text-xl font-bold" style={{ color: colors.text }}>
            {isStaff ? "Support Inbox" : "Support"}
          </Text>
          {isStaff && (
            <Text className="text-xs" style={{ color: colors.textSecondary }}>
              {tickets.length} ticket{tickets.length !== 1 ? "s" : ""}
            </Text>
          )}
        </View>
      </View>

      {/* Content */}
      <View className="flex-1 px-4 pt-4">
        {loading ? (
          <>
            <SkeletonRow />
            <SkeletonRow />
            <SkeletonRow />
          </>
        ) : isStaff ? (
          staffView()
        ) : (
          memberView()
        )}
      </View>

      {/* New Ticket Modal (member only) */}
      {!isStaff && (
        <NewTicketModal
          visible={newTicketVisible}
          onClose={() => setNewTicketVisible(false)}
          onCreated={fetchTickets}
          isDark={isDark}
          colors={colors}
        />
      )}
    </SafeAreaView>
  );
}

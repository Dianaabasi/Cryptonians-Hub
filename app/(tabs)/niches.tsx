import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Image, Modal, TextInput, KeyboardAvoidingView, Platform } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { SkeletonNicheCard } from "@/components/ui/SkeletonLoader";
import { Users, Hash, ShieldCheck, Plus, X, Trash2, UserCheck, CheckCircle, XCircle } from "lucide-react-native";

interface Niche {
  id: string;
  name: string;
  description: string;
  banner_url?: string | null;
  isMember?: boolean;
  hasPendingRequest?: boolean;
  pendingCount?: number;
}

function CreateNicheModal({
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
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [loading, setLoading] = useState(false);

  const reset = () => {
    setName("");
    setDescription("");
  };

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim()) {
      Alert.alert("Required", "Please fill in both name and description.");
      return;
    }
    setLoading(true);
    try {
      const { data: niche, error } = await supabase
        .from("niches")
        .insert({
          name: name.trim(),
          description: description.trim(),
        })
        .select("id")
        .single();
      if (error) throw error;
      reset();
      onClose();
      onCreated();
    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not create niche.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1 justify-end bg-black/50">
        <View className="rounded-t-3xl p-5" style={{ backgroundColor: colors.background, paddingBottom: Platform.OS === "ios" ? 40 : 20 }}>
          <View className="flex-row justify-between items-center mb-6">
            <Text className="text-xl font-bold" style={{ color: colors.text }}>Create New Niche</Text>
            <TouchableOpacity onPress={() => { reset(); onClose(); }} className="p-2 -mr-2">
              <X size={20} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text className="text-sm font-semibold mb-2" style={{ color: colors.textSecondary }}>Name</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="E.g., Web3 Developers"
            placeholderTextColor={colors.textSecondary}
            className="px-4 py-3.5 rounded-2xl text-base mb-4"
            style={{ backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6", color: colors.text }}
          />

          <Text className="text-sm font-semibold mb-2" style={{ color: colors.textSecondary }}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="What is this community about?"
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            className="px-4 py-3.5 rounded-2xl text-base mb-6 max-h-32 min-h-[100px]"
            textAlignVertical="top"
            style={{ backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6", color: colors.text }}
          />

          <TouchableOpacity
            onPress={handleSubmit}
            disabled={loading}
            className="w-full py-4 rounded-xl items-center justify-center bg-[#6C63FF]"
          >
            {loading ? <ActivityIndicator color="#FFF" /> : <Text className="text-white font-bold text-base">Create Niche</Text>}
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

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
      Alert.alert("Error", "Could not load requests.");
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
      Alert.alert("Error", `Could not ${action} request.`);
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
    </Modal>
  );
}

export default function NichesScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { profile } = useAuthStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const [niches, setNiches] = useState<Niche[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [joiningId, setJoiningId] = useState<string | null>(null);
  const [createNicheOpen, setCreateNicheOpen] = useState(false);
  
  const [nicheToOptions, setNicheToOptions] = useState<Niche | null>(null);
  const [nicheToDelete, setNicheToDelete] = useState<Niche | null>(null);
  const [isDeletingNiche, setIsDeletingNiche] = useState(false);
  const [requestsNiche, setRequestsNiche] = useState<Niche | null>(null);

  const isSuperAdmin = profile?.role === "admin";
  const isAdmin = profile?.role === "admin" || profile?.role === "mod";

  const fetchNichesInfo = async () => {
    if (!profile?.id) return;
    try {
      const { data: allNiches, error: nichesError } = await supabase
        .from("niches")
        .select("id, name, description, banner_url")
        .order("name");

      if (nichesError) throw nichesError;

      const { data: memberships } = await supabase
        .from("niche_memberships")
        .select("niche_id")
        .eq("user_id", profile.id);

      const memberNicheIds = new Set(memberships?.map((m) => m.niche_id) || []);

      const { data: userRequests } = await supabase
        .from("niche_join_requests")
        .select("niche_id")
        .eq("user_id", profile.id)
        .eq("status", "pending");

      const pendingRequestNicheIds = new Set(userRequests?.map((r) => r.niche_id) || []);

      let pendingCounts: Record<string, number> = {};
      if (profile.role === "admin" || profile.role === "mod") {
         const { data: allPending } = await supabase
           .from("niche_join_requests")
           .select("niche_id")
           .eq("status", "pending");

         if (allPending) {
           allPending.forEach((req) => {
             pendingCounts[req.niche_id] = (pendingCounts[req.niche_id] || 0) + 1;
           });
         }
      }

      if (allNiches) {
        setNiches(allNiches.map((n) => ({ 
          ...n, 
          isMember: memberNicheIds.has(n.id),
          hasPendingRequest: pendingRequestNicheIds.has(n.id),
          pendingCount: pendingCounts[n.id] || 0
        })));
      }
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => { fetchNichesInfo(); }, [profile?.id]);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchNichesInfo();
  }, []);

  const handleJoinNiche = async (nicheId: string) => {
    if (!profile?.id) return;
    setJoiningId(nicheId);
    try {
      // Admins/mods can join instantly
      if (isAdmin) {
        const { error } = await supabase
          .from("niche_memberships")
          .insert({ niche_id: nicheId, user_id: profile.id });
        if (error) throw error;
        setNiches((prev) => prev.map((n) => n.id === nicheId ? { ...n, isMember: true } : n));
      } else {
        // Regular members send a request
        const { error } = await supabase
          .from("niche_join_requests")
          .insert({ niche_id: nicheId, user_id: profile.id });
        if (error) throw error;
        setNiches((prev) => prev.map((n) => n.id === nicheId ? { ...n, hasPendingRequest: true } : n));
      }
    } catch {
      Alert.alert("Error", "Could not send join request.");
    } finally {
      setJoiningId(null);
    }
  };

  const handleLeaveNiche = async (nicheId: string) => {
    if (!profile?.id) return;
    setJoiningId(nicheId);
    try {
      // Also remove from the niche's group chat participants
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
          .delete()
          .match({ chat_id: nicheRoom.id, user_id: profile.id });
      }

      await supabase
        .from("niche_memberships")
        .delete()
        .match({ niche_id: nicheId, user_id: profile.id });

      setNiches((prev) => prev.map((n) => n.id === nicheId ? { ...n, isMember: false } : n));
    } catch {
      Alert.alert("Error", "Could not leave the niche.");
    } finally {
      setJoiningId(null);
    }
  };

  const handleDeleteNiche = (niche: Niche) => {
    if (!isSuperAdmin) return;
    setNicheToOptions(niche);
  };

  const confirmDeleteNiche = async () => {
    if (!nicheToDelete || !isSuperAdmin) return;
    setIsDeletingNiche(true);
    try {
      const { error } = await supabase.from("niches").delete().eq("id", nicheToDelete.id);
      if (error) throw error;
      setNiches((prev) => prev.filter((n) => n.id !== nicheToDelete.id));
      setNicheToDelete(null);
    } catch (error) {
      console.error("Delete Niche Error:", error);
      Alert.alert("Error", "Could not delete niche.");
    } finally {
      setIsDeletingNiche(false);
    }
  };

  const myNiches = niches.filter((n) => n.isMember);
  const discoverNiches = niches.filter((n) => !n.isMember);

  const renderNicheCard = (niche: Niche) => (
    <TouchableOpacity
      activeOpacity={1}
      onLongPress={() => handleDeleteNiche(niche)}
      delayLongPress={500}
      key={niche.id}
      className={`mb-4 rounded-3xl overflow-hidden ${isDark ? "bg-[#1C1C1E] border border-[#2C2C2E]" : "bg-white border border-gray-100"}`}
    >
      {/* Banner — always visible for everyone */}
      <View className="relative">
        {niche.banner_url ? (
          <Image
            source={{ uri: niche.banner_url }}
            className="w-full h-28"
            resizeMode="cover"
          />
        ) : (
          <View className={`w-full h-20 items-center justify-center ${isDark ? "bg-[#2C2C2E]" : "bg-[#6C63FF]/10"}`}>
            <Hash size={28} color="#6C63FF" />
            {isAdmin && (
              <Text className="text-[10px] text-[#6C63FF] mt-1 font-semibold">Tap to manage niche</Text>
            )}
          </View>
        )}

        {/* Requests Badge Admin Only */}
        {isAdmin && niche.pendingCount !== undefined && niche.pendingCount > 0 && (
          <TouchableOpacity
            onPress={() => setRequestsNiche(niche)}
            className="absolute top-2 right-2 flex-row items-center bg-red-500 px-2 py-1 rounded-full z-20"
          >
            <Users size={12} color="#FFF" />
            <Text className="text-white text-[10px] font-bold ml-1">{niche.pendingCount}</Text>
          </TouchableOpacity>
        )}

        {/* Tap to open — only for members and admins */}
        {(niche.isMember || isAdmin) && (
          <TouchableOpacity
            onPress={() => router.push(`/niche/${niche.id}` as any)}
            className="absolute inset-0"
            style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0 }}
            activeOpacity={0.1}
          />
        )}
      </View>

      <View className="p-4">
        <Text className="text-lg font-bold mb-1" style={{ color: colors.text }} numberOfLines={1}>
          {niche.name}
        </Text>
        <Text className="text-xs mb-3" style={{ color: colors.textSecondary }} numberOfLines={2}>
          {niche.description}
        </Text>

        {niche.isMember ? (
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => router.push(`/niche/${niche.id}` as any)}
              className="flex-1 py-2.5 rounded-xl items-center justify-center bg-[#6C63FF]"
            >
              <Text className="text-white font-bold text-sm">Open Niche</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleLeaveNiche(niche.id)}
              disabled={joiningId === niche.id}
              className={`py-2.5 px-4 rounded-xl items-center justify-center border ${isDark ? "border-[#2C2C2E]" : "border-gray-200"}`}
            >
              {joiningId === niche.id ? (
                <ActivityIndicator size="small" color={colors.textSecondary} />
              ) : (
                <Text className="font-bold text-sm" style={{ color: colors.textSecondary }}>Leave</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : isAdmin ? (
          /* Admin who hasn't joined — show Manage button + Join */
          <View className="flex-row gap-2">
            <TouchableOpacity
              onPress={() => router.push(`/niche/${niche.id}` as any)}
              className="flex-1 py-2.5 rounded-xl items-center justify-center bg-amber-500/15 border border-amber-500/30"
            >
              <Text className="text-amber-500 font-bold text-sm">Manage Niche</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => handleJoinNiche(niche.id)}
              disabled={joiningId === niche.id}
              className="py-2.5 px-4 rounded-xl items-center justify-center bg-[#6C63FF]/10"
            >
              {joiningId === niche.id ? (
                <ActivityIndicator size="small" color="#6C63FF" />
              ) : (
                <Text className="text-[#6C63FF] font-bold text-sm">Join</Text>
              )}
            </TouchableOpacity>
          </View>
        ) : niche.hasPendingRequest ? (
          /* Pending Request State */
          <TouchableOpacity
            disabled={true}
            className={`w-full py-2.5 rounded-xl items-center justify-center border ${isDark ? "border-[#2C2C2E]" : "border-gray-200"}`}
          >
            <Text className="font-bold text-sm" style={{ color: colors.textSecondary }}>Request Sent</Text>
          </TouchableOpacity>
        ) : (
          /* Join Button */
          <TouchableOpacity
            onPress={() => handleJoinNiche(niche.id)}
            disabled={joiningId === niche.id}
            className="w-full py-2.5 rounded-xl items-center justify-center bg-[#6C63FF]/10"
          >
            {joiningId === niche.id ? (
              <ActivityIndicator size="small" color="#6C63FF" />
            ) : (
              <Text className="text-[#6C63FF] font-bold text-sm">Join Community</Text>
            )}
          </TouchableOpacity>
        )}
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-5 pt-4 pb-2 flex-row justify-between items-center z-10">
        <Text className="text-2xl font-bold" style={{ color: colors.text }}>Niches</Text>
        <View className="flex-row items-center gap-3">
          {isSuperAdmin && (
            <TouchableOpacity 
              onPress={() => setCreateNicheOpen(true)}
              className="w-8 h-8 rounded-full bg-[#6C63FF]/10 items-center justify-center"
            >
              <Plus size={18} color="#6C63FF" />
            </TouchableOpacity>
          )}
          {isAdmin && (
            <View className="flex-row items-center bg-amber-500/10 px-3 py-1.5 rounded-full">
              <ShieldCheck size={14} color="#F59E0B" />
              <Text className="text-amber-500 font-bold text-xs uppercase ml-1">
                {profile?.role === "admin" ? "Admin" : "Mod"}
              </Text>
            </View>
          )}
        </View>
      </View>

      <CreateNicheModal
        visible={createNicheOpen}
        onClose={() => setCreateNicheOpen(false)}
        onCreated={() => { fetchNichesInfo(); }}
        isDark={isDark}
        colors={colors}
      />

      <RequestsModal
        visible={!!requestsNiche}
        onClose={() => setRequestsNiche(null)}
        nicheId={requestsNiche?.id || null}
        isDark={isDark}
        colors={colors}
        onActionComplete={fetchNichesInfo}
      />

      {/* Step 1: Bottom sheet options (shown on long press) */}
      <Modal visible={!!nicheToOptions} animationType="slide" transparent>
        <View className="flex-1 justify-end bg-black/50">
          <TouchableOpacity className="flex-1" activeOpacity={1} onPress={() => setNicheToOptions(null)} />
          <View className="rounded-t-3xl p-6" style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFF", paddingBottom: Platform.OS === "ios" ? 40 : 24 }}>
            <View className="w-10 h-1 rounded-full bg-gray-400/40 self-center mb-6" />
            <Text className="text-base font-bold mb-4" style={{ color: colors.text }}>
              {nicheToOptions?.name}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setNicheToDelete(nicheToOptions);
                setNicheToOptions(null);
              }}
              className="flex-row items-center gap-3 p-4 rounded-2xl bg-red-500/10 border border-red-500/20 mb-3"
            >
              <Trash2 size={20} color="#EF4444" />
              <Text className="font-bold text-red-500">Delete Niche</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setNicheToOptions(null)}
              className={`p-4 rounded-2xl border ${isDark ? "border-[#2C2C2E]" : "border-gray-200"}`}
            >
              <Text className="font-bold text-center" style={{ color: colors.textSecondary }}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* Step 2: Confirmation modal */}
      <Modal visible={!!nicheToDelete} animationType="fade" transparent>
        <View className="flex-1 justify-center px-6 bg-black/60">
          <View 
            className="rounded-3xl p-6" 
            style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFF" }}
          >
            <View className="w-12 h-12 rounded-full bg-red-500/10 items-center justify-center mb-4 self-center">
              <Trash2 size={24} color="#EF4444" />
            </View>
            <Text className="text-xl font-bold text-center mb-2" style={{ color: colors.text }}>
              Delete Niche?
            </Text>
            <Text className="text-center text-sm mb-6" style={{ color: colors.textSecondary }}>
              Are you sure you want to permanently delete <Text className="font-bold" style={{ color: colors.text }}>"{nicheToDelete?.name}"</Text>? This action cannot be undone.
            </Text>

            <View className="flex-row gap-3">
              <TouchableOpacity
                onPress={() => setNicheToDelete(null)}
                disabled={isDeletingNiche}
                className={`flex-1 py-3.5 rounded-xl items-center justify-center border ${isDark ? "border-[#2C2C2E]" : "border-gray-200"}`}
              >
                <Text className="font-bold text-sm" style={{ color: colors.text }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={confirmDeleteNiche}
                disabled={isDeletingNiche}
                className="flex-1 py-3.5 rounded-xl items-center justify-center bg-red-500"
              >
                {isDeletingNiche ? (
                  <ActivityIndicator color="#FFF" size="small" />
                ) : (
                  <Text className="text-white font-bold text-sm">Yes, Delete</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {loading ? (
        <View className="flex-1 px-5 pt-2">
          <SkeletonNicheCard isDark={isDark} />
          <SkeletonNicheCard isDark={isDark} />
          <SkeletonNicheCard isDark={isDark} />
        </View>
      ) : (
        <ScrollView
          className="flex-1 px-5 pt-2"
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#6C63FF" />}
        >
          {myNiches.length > 0 && (
            <View className="mb-6">
              <Text className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: colors.textSecondary }}>
                My Communities
              </Text>
              {myNiches.map(renderNicheCard)}
            </View>
          )}

          {discoverNiches.length > 0 && (
            <View className="mb-10">
              <Text className="text-sm font-bold uppercase tracking-wider mb-4" style={{ color: colors.textSecondary }}>
                Discover Niches
              </Text>
              {discoverNiches.map(renderNicheCard)}
            </View>
          )}

          {niches.length === 0 && !loading && (
            <View className="py-20 items-center justify-center">
              <Users size={48} color={isDark ? "#2C2C2E" : "#E5E7EB"} />
              <Text className="text-lg text-center mt-4" style={{ color: colors.textSecondary }}>
                No active Niches found.
              </Text>
            </View>
          )}

          <View className="h-32" />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

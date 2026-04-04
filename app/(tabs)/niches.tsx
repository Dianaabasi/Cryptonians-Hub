import React, { useState, useEffect, useCallback } from "react";
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Alert, RefreshControl, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { SkeletonNicheCard } from "@/components/ui/SkeletonLoader";
import { Users, Hash, ShieldCheck } from "lucide-react-native";

interface Niche {
  id: string;
  name: string;
  description: string;
  banner_url?: string | null;
  isMember?: boolean;
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

      if (allNiches) {
        setNiches(allNiches.map((n) => ({ ...n, isMember: memberNicheIds.has(n.id) })));
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
      const { error } = await supabase
        .from("niche_memberships")
        .insert({ niche_id: nicheId, user_id: profile.id });
      if (error) throw error;
      setNiches((prev) => prev.map((n) => n.id === nicheId ? { ...n, isMember: true } : n));
    } catch {
      Alert.alert("Error", "Could not join the niche.");
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

  const myNiches = niches.filter((n) => n.isMember);
  const discoverNiches = niches.filter((n) => !n.isMember);

  const renderNicheCard = (niche: Niche) => (
    <View
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
        ) : (
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
    </View>
  );

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <View className="px-5 pt-4 pb-2 flex-row justify-between items-center z-10">
        <Text className="text-2xl font-bold" style={{ color: colors.text }}>Niches</Text>
        {isAdmin && (
          <View className="flex-row items-center bg-amber-500/10 px-3 py-1.5 rounded-full">
            <ShieldCheck size={14} color="#F59E0B" />
            <Text className="text-amber-500 font-bold text-xs uppercase ml-1">
              {profile?.role === "admin" ? "Admin" : "Mod"}
            </Text>
          </View>
        )}
      </View>

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

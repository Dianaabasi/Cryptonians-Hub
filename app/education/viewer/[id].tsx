import React, { useState, useEffect } from "react";
import { View, Text, TouchableOpacity, ActivityIndicator, Alert } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { WebView } from "react-native-webview";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Bookmark, ThumbsUp, CheckCircle, XCircle } from "lucide-react-native";
import * as Linking from "expo-linking";

interface Material {
  id: string;
  title: string;
  material_url: string;
  material_type: string;
  status: string;
  upvotes: number;
  custom_author?: string | null;
  author: {
    id: string;
    full_name: string;
    avatar_url: string | null;
  };
}

export default function EducationViewerScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { theme } = useThemeStore();
  const { profile } = useAuthStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const isAdmin = profile?.role === "admin" || profile?.role === "mod";

  const [material, setMaterial] = useState<Material | null>(null);
  const [loading, setLoading] = useState(true);
  const [hasUpvoted, setHasUpvoted] = useState(false);
  const [hasSaved, setHasSaved] = useState(false);
  const [upvotes, setUpvotes] = useState(0);

  useEffect(() => {
    fetchMaterial();
  }, [id, profile?.id]);

  const fetchMaterial = async () => {
    if (!id || !profile?.id) return;
    try {
      const { data, error } = await supabase
        .from("education_materials")
        .select(`
          id, 
          title, 
          material_url, 
          material_type, 
          status, 
          upvotes, 
          custom_author,
          author:profiles!education_materials_author_id_fkey(id, full_name, avatar_url)
        `)
        .eq("id", id)
        .single();

      if (error) throw error;
      setMaterial(data as any as Material);
      setUpvotes(data.upvotes);

      // Check toggles
      const { data: upvote } = await supabase.from("education_upvotes").select("id").match({ user_id: profile.id, material_id: id }).single();
      if (upvote) setHasUpvoted(true);

      const { data: save } = await supabase.from("education_saves").select("id").match({ user_id: profile.id, material_id: id }).single();
      if (save) setHasSaved(true);

    } catch (e) {
      console.error(e);
      Alert.alert("Error", "Could not load material.");
      router.back();
    } finally {
      setLoading(false);
    }
  };

  const toggleUpvote = async () => {
    if (!profile?.id || !material) return;
    const currentlyUpvoted = hasUpvoted;
    setHasUpvoted(!currentlyUpvoted);
    setUpvotes(v => currentlyUpvoted ? v - 1 : v + 1);

    try {
      if (currentlyUpvoted) {
        await supabase.from("education_upvotes").delete().match({ user_id: profile.id, material_id: material.id });
      } else {
        await supabase.from("education_upvotes").insert({ user_id: profile.id, material_id: material.id });
      }
    } catch {
      setHasUpvoted(currentlyUpvoted);
      setUpvotes(v => currentlyUpvoted ? v + 1 : v - 1);
    }
  };

  const toggleSave = async () => {
    if (!profile?.id || !material) return;
    const currentlySaved = hasSaved;
    setHasSaved(!currentlySaved);

    try {
      if (currentlySaved) {
        await supabase.from("education_saves").delete().match({ user_id: profile.id, material_id: material.id });
      } else {
        await supabase.from("education_saves").insert({ user_id: profile.id, material_id: material.id });
      }
    } catch {
      setHasSaved(currentlySaved);
    }
  };

  const handleApprove = async () => {
    if (!material) return;
    try {
      await supabase.from("education_materials").update({ status: "approved" }).eq("id", material.id);
      Alert.alert("Approved", "This material is now public.", [{ text: "OK", onPress: () => router.back() }]);
    } catch {
      Alert.alert("Error", "Could not approve.");
    }
  };

  const handleReject = async () => {
    if (!material) return;
    Alert.alert("Reject Material", "Permanently delete this submission?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: async () => {
        try {
          await supabase.from("education_materials").delete().eq("id", material.id);
          router.back();
        } catch {
          Alert.alert("Error", "Could not reject.");
        }
      }}
    ]);
  };

  if (loading) {
    return (
      <SafeAreaView className="flex-1 justify-center items-center" style={{ backgroundColor: colors.background }}>
        <ActivityIndicator size="large" color="#6C63FF" />
      </SafeAreaView>
    );
  }

  if (!material) return null;

  // Render URL handler
  const renderWebView = () => {
    let finalUrl = material.material_url;

    if (material.material_type === "pdf") {
      // PDF.js is more reliable than Google Docs Viewer for direct storage URLs
      finalUrl = `https://mozilla.github.io/pdf.js/web/viewer.html?file=${encodeURIComponent(material.material_url)}`;
    } else if (material.material_type === "docx") {
      // Google Docs Viewer works well for DOCX
      finalUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(material.material_url)}&embedded=true`;
    }

    return (
      <WebView 
        source={{ uri: finalUrl }} 
        className="flex-1"
        startInLoadingState={true}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        originWhitelist={["*"]}
        renderLoading={() => (
          <View className="absolute inset-0 items-center justify-center" style={{ backgroundColor: isDark ? "#121212" : "#F9F9F9" }}>
            <ActivityIndicator size="large" color="#6C63FF" />
            <Text className="text-xs mt-3" style={{ color: isDark ? "#888" : "#999" }}>Loading document…</Text>
          </View>
        )}
      />
    );
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }} edges={["top", "left", "right"]}>
      {/* Header */}
      <View className="px-5 pt-4 pb-3 flex-row items-center border-b justify-between" style={{ borderColor: isDark ? "#2C2C2E" : "#F3F4F6" }}>
        <View className="flex-row items-center flex-1">
          <TouchableOpacity onPress={() => router.back()} className="mr-4">
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <View className="flex-1">
            <Text className="text-base font-bold" style={{ color: colors.text }} numberOfLines={1}>
              {material.title}
            </Text>
            <View className="flex-row items-center mt-0.5">
              {material.custom_author ? (
                <>
                  <Text className="text-[10px] font-bold" style={{ color: colors.textSecondary }}>
                    Author: {material.custom_author}
                  </Text>
                  <Text className="text-[10px] mx-1" style={{ color: colors.textSecondary }}>•</Text>
                </>
              ) : null}
              <Text className="text-[10px]" style={{ color: colors.textSecondary }}>
                Uploaded by: {material.author?.full_name || "Unknown"}
              </Text>
            </View>
          </View>
        </View>
      </View>

      {/* Reader Body */}
      <View className="flex-1">
        {renderWebView()}
      </View>

      {/* Bottom Action Bar */}
      <View className="px-6 py-4 flex-row items-center justify-between border-t border-b-0 pb-8" style={{ backgroundColor: colors.background, borderColor: isDark ? "#2C2C2E" : "#F3F4F6" }}>
        {isAdmin && material.status === "pending" ? (
          <>
            <TouchableOpacity onPress={handleReject} className="flex-row items-center gap-2 bg-red-500/10 px-6 py-3 rounded-xl border border-red-500/30">
              <XCircle size={20} color="#EF4444" />
              <Text className="text-red-500 font-bold">Reject</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleApprove} className="flex-row items-center gap-2 bg-emerald-500/10 px-6 py-3 rounded-xl border border-emerald-500/30">
              <CheckCircle size={20} color="#10B981" />
              <Text className="text-emerald-500 font-bold">Approve</Text>
            </TouchableOpacity>
          </>
        ) : (
          <>
            <TouchableOpacity onPress={toggleUpvote} className={`flex-row items-center gap-2 px-6 py-3 rounded-xl border ${hasUpvoted ? "bg-[#6C63FF]/10 border-[#6C63FF]/30" : (isDark ? "bg-[#1C1C1E] border-[#2C2C2E]" : "bg-white border-gray-200")}`}>
              <ThumbsUp size={20} color={hasUpvoted ? "#6C63FF" : colors.textSecondary} />
              <Text style={{ color: hasUpvoted ? "#6C63FF" : colors.text, fontWeight: "bold" }}>
                {upvotes} Upvotes
              </Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={toggleSave} className={`flex-row items-center gap-2 px-6 py-3 rounded-xl border ${hasSaved ? "bg-amber-500/10 border-amber-500/30" : (isDark ? "bg-[#1C1C1E] border-[#2C2C2E]" : "bg-white border-gray-200")}`}>
              <Bookmark size={20} color={hasSaved ? "#F59E0B" : colors.textSecondary} />
              <Text style={{ color: hasSaved ? "#F59E0B" : colors.text, fontWeight: "bold" }}>
                {hasSaved ? "Saved" : "Save"}
              </Text>
            </TouchableOpacity>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

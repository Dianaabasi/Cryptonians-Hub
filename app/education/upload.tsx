import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Modal,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as DocumentPicker from "expo-document-picker";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Upload, FileText, Link as LinkIcon, X, CheckCircle } from "lucide-react-native";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";

const CATEGORIES = ["DeFi", "Trading", "Marketing", "Dev", "Custom"];
const DIFFICULTIES = ["Beginner", "Intermediate", "Advanced"];

export default function UploadMaterialScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { profile } = useAuthStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const isAdmin = profile?.role === "admin" || profile?.role === "mod";

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("DeFi");
  const [customCategory, setCustomCategory] = useState("");
  const [difficulty, setDifficulty] = useState("Beginner");
  const [uploadType, setUploadType] = useState<"file" | "link">("file");
  const [linkUrl, setLinkUrl] = useState("");
  const [customAuthor, setCustomAuthor] = useState("");
  
  const [file, setFile] = useState<DocumentPicker.DocumentPickerAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);

  const pickDocument = async () => {
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ["application/pdf", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setFile(result.assets[0]);
      }
    } catch (err) {
      console.log(err);
      Alert.alert("Error", "Could not pick document.");
    }
  };

  const handleSubmit = async () => {
    if (!profile?.id) return;

    if (!title.trim() || !description.trim()) {
      Alert.alert("Required", "Please provide a title and description.");
      return;
    }

    const finalCategory = category === "Custom" ? customCategory.trim() : category;
    if (!finalCategory) {
      Alert.alert("Required", "Please provide a category.");
      return;
    }

    if (uploadType === "link" && !linkUrl.trim()) {
      Alert.alert("Required", "Please provide a valid link.");
      return;
    }
    if (uploadType === "file" && !file) {
      Alert.alert("Required", "Please select a PDF or DOCX file.");
      return;
    }

    setLoading(true);

    try {
      let finalUrl = linkUrl.trim();
      let materialType = uploadType === "link" ? "link" : "pdf"; // Default to pdf

      if (uploadType === "file" && file) {
        const fileExt = file.name.split(".").pop()?.toLowerCase();
        materialType = fileExt === "docx" ? "docx" : "pdf";
        
        // Read file to base64
        const base64File = await FileSystem.readAsStringAsync(file.uri, {
          encoding: "base64",
        });

        const fileName = `${profile.id}/${Date.now()}_${file.name.replace(/[^a-zA-Z0-9.\-_]/g, "_")}`;

        const { error: uploadError } = await supabase.storage
          .from("education_files")
          .upload(fileName, decode(base64File), {
            contentType: file.mimeType || "application/octet-stream",
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("education_files")
          .getPublicUrl(fileName);

        finalUrl = publicUrlData.publicUrl;
      }

      // If user is admin/mod, auto-approve immediately
      const defaultStatus = isAdmin ? "approved" : "pending";

      const { error } = await supabase.from("education_materials").insert({
        author_id: profile.id,
        title: title.trim(),
        description: description.trim(),
        category: finalCategory,
        difficulty: difficulty.toLowerCase(),
        material_type: materialType,
        material_url: finalUrl,
        custom_author: uploadType === "file" && customAuthor.trim() ? customAuthor.trim() : null,
        status: defaultStatus,
      });

      if (error) throw error;

      setShowSuccessModal(true);
    } catch (e: any) {
      console.error("Upload error dump:");
      console.log(JSON.stringify(e, null, 2));
      console.log(e.message || e);
      Alert.alert("Upload Failed", e?.message || "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="px-5 pt-4 pb-4 flex-row items-center border-b" style={{ borderColor: isDark ? "#2C2C2E" : "#F3F4F6" }}>
        <TouchableOpacity onPress={() => router.back()} className="mr-4">
          <ArrowLeft size={24} color={colors.text} />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>
          Upload Material
        </Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
          {/* Type Toggle */}
          <View className="flex-row mb-6 bg-gray-100 rounded-xl p-1" style={{ backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6" }}>
            <TouchableOpacity
              onPress={() => setUploadType("file")}
              className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${uploadType === "file" ? (isDark ? "bg-[#2C2C2E]" : "bg-white") : ""}`}
              style={uploadType === "file" ? { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 } : {}}
            >
              <FileText size={16} color={uploadType === "file" ? "#6C63FF" : colors.textSecondary} />
              <Text className="ml-2 font-bold" style={{ color: uploadType === "file" ? "#6C63FF" : colors.textSecondary }}>File</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => setUploadType("link")}
              className={`flex-1 flex-row items-center justify-center py-2.5 rounded-lg ${uploadType === "link" ? (isDark ? "bg-[#2C2C2E]" : "bg-white") : ""}`}
              style={uploadType === "link" ? { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 3, elevation: 2 } : {}}
            >
              <LinkIcon size={16} color={uploadType === "link" ? "#6C63FF" : colors.textSecondary} />
              <Text className="ml-2 font-bold" style={{ color: uploadType === "link" ? "#6C63FF" : colors.textSecondary }}>Link</Text>
            </TouchableOpacity>
          </View>

          {/* Upload Box / Link Input */}
          {uploadType === "file" ? (
            <TouchableOpacity
              onPress={pickDocument}
              className={`mb-6 border-2 border-dashed rounded-3xl p-6 items-center justify-center ${isDark ? "border-[#2C2C2E] bg-[#1C1C1E]" : "border-gray-300 bg-gray-50"}`}
            >
              {file ? (
                <View className="items-center">
                  <View className="w-12 h-12 rounded-full bg-[#6C63FF]/10 items-center justify-center mb-2">
                    <FileText size={24} color="#6C63FF" />
                  </View>
                  <Text className="font-bold text-center mb-1" style={{ color: colors.text }}>{file.name}</Text>
                  <Text className="text-xs text-center" style={{ color: colors.textSecondary }}>
                    {(file.size && file.size > 0 ? (file.size / 1024 / 1024).toFixed(2) + " MB" : "Unknown size")}
                  </Text>
                </View>
              ) : (
                <View className="items-center">
                  <View className="w-16 h-16 rounded-full bg-[#6C63FF]/10 items-center justify-center mb-3">
                    <Upload size={28} color="#6C63FF" />
                  </View>
                  <Text className="font-bold text-base mb-1" style={{ color: colors.text }}>Tap to pick a file</Text>
                  <Text className="text-xs text-center" style={{ color: colors.textSecondary }}>Supports PDF, DOCX (Max 10MB)</Text>
                </View>
              )}
            </TouchableOpacity>
          ) : (
            <View className="mb-6">
              <Text className="text-sm font-semibold mb-2" style={{ color: colors.textSecondary }}>Resource Link</Text>
              <TextInput
                value={linkUrl}
                onChangeText={setLinkUrl}
                placeholder="https://..."
                placeholderTextColor={colors.textSecondary}
                className="px-4 py-3.5 rounded-2xl text-base"
                style={{ backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6", color: colors.text }}
                autoCapitalize="none"
                keyboardType="url"
              />
            </View>
          )}

          {/* Core Info */}
          <Text className="text-sm font-semibold mb-2" style={{ color: colors.textSecondary }}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="e.g. Intro to Smart Contracts"
            placeholderTextColor={colors.textSecondary}
            className="px-4 py-3.5 rounded-2xl text-base mb-4"
            style={{ backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6", color: colors.text }}
          />

          <Text className="text-sm font-semibold mb-2" style={{ color: colors.textSecondary }}>Description</Text>
          <TextInput
            value={description}
            onChangeText={setDescription}
            placeholder="Briefly describe what this resource is about..."
            placeholderTextColor={colors.textSecondary}
            multiline
            numberOfLines={4}
            className="px-4 py-3.5 rounded-2xl text-base mb-6 max-h-32 min-h-[100px]"
            textAlignVertical="top"
            style={{ backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6", color: colors.text }}
          />

          {/* Author Field (Optional for files) */}
          {uploadType === "file" && (
            <>
              <Text className="text-sm font-semibold mb-2" style={{ color: colors.textSecondary }}>Author (Optional)</Text>
              <TextInput
                value={customAuthor}
                onChangeText={setCustomAuthor}
                placeholder="e.g. Satoshi Nakamoto"
                placeholderTextColor={colors.textSecondary}
                className="px-4 py-3.5 rounded-2xl text-base mb-4"
                style={{ backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6", color: colors.text }}
              />
            </>
          )}

          {/* Category */}
          <Text className="text-sm font-semibold mb-2" style={{ color: colors.textSecondary }}>Category</Text>
          <View className="flex-row flex-wrap gap-2 mb-4">
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                className={`px-4 py-2 rounded-full border ${category === cat ? "bg-[#6C63FF] border-[#6C63FF]" : (isDark ? "bg-[#1C1C1E] border-[#2C2C2E]" : "bg-white border-gray-200")}`}
              >
                <Text className="font-bold text-xs" style={{ color: category === cat ? "#FFF" : colors.textSecondary }}>{cat}</Text>
              </TouchableOpacity>
            ))}
          </View>
          {category === "Custom" && (
            <TextInput
              value={customCategory}
              onChangeText={setCustomCategory}
              placeholder="Enter custom category"
              placeholderTextColor={colors.textSecondary}
              className="px-4 py-3.5 rounded-2xl text-base mb-6"
              style={{ backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6", color: colors.text }}
            />
          )}

          {/* Difficulty */}
          <Text className="text-sm font-semibold mb-2 mt-2" style={{ color: colors.textSecondary }}>Difficulty Level</Text>
          <View className="flex-row flex-wrap gap-2 mb-10">
            {DIFFICULTIES.map((diff) => (
              <TouchableOpacity
                key={diff}
                onPress={() => setDifficulty(diff)}
                className={`flex-1 px-2 py-3 rounded-xl border items-center ${difficulty === diff ? "bg-amber-500/10 border-amber-500" : (isDark ? "bg-[#1C1C1E] border-[#2C2C2E]" : "bg-white border-gray-200")}`}
              >
                <Text className="font-bold text-xs" style={{ color: difficulty === diff ? "#F59E0B" : colors.textSecondary }}>{diff}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <View className="h-20" />
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Sticky Bottom Button */}
      <View className="absolute bottom-0 left-0 right-0 p-5 pt-2" style={{ backgroundColor: isDark ? "rgba(0,0,0,0.8)" : "rgba(255,255,255,0.9)" }}>
        <TouchableOpacity
          onPress={handleSubmit}
          disabled={loading}
          className="w-full py-4 rounded-xl items-center justify-center bg-[#6C63FF]"
        >
          {loading ? (
            <ActivityIndicator color="#FFF" />
          ) : (
            <Text className="text-white font-bold text-base">Submit Material</Text>
          )}
        </TouchableOpacity>
      </View>

      {/* Custom Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View className="flex-1 justify-center items-center bg-black/60 px-5">
          <View className="w-full rounded-3xl p-6 items-center" style={{ backgroundColor: colors.background }}>
            <View className="w-16 h-16 rounded-full bg-emerald-500/10 items-center justify-center mb-4">
              <CheckCircle size={32} color="#10B981" />
            </View>
            <Text className="text-xl font-bold mb-2 text-center" style={{ color: colors.text }}>
              {isAdmin ? "Published Successfully!" : "Submitted for Review"}
            </Text>
            <Text className="text-sm text-center mb-6" style={{ color: colors.textSecondary }}>
              {isAdmin 
                ? "Your material is now live in the Discover feed." 
                : "Your material is resting in the queue and will be published once approved by an Admin."}
            </Text>
            <TouchableOpacity 
              onPress={() => {
                setShowSuccessModal(false);
                router.back();
              }}
              className="w-full py-4 rounded-xl items-center justify-center bg-emerald-500"
            >
              <Text className="text-white font-bold text-base">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

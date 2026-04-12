import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Image,
  Modal,
} from "react-native";
import { AppModal, useAppModal } from "@/components/ui/AppModal";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Upload, FileText, X, CheckCircle, Image as ImageIcon } from "lucide-react-native";
import { decode } from "base64-arraybuffer";
import * as FileSystem from "expo-file-system/legacy";

const CATEGORIES = ["DeFi", "Trading", "Marketing", "Dev", "Custom"];

export default function CreateArticleScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { profile } = useAuthStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const isAdmin = profile?.role === "admin" || profile?.role === "mod";

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [category, setCategory] = useState("DeFi");
  const [customCategory, setCustomCategory] = useState("");
  
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const { showModal, modalProps } = useAppModal();

  const pickImage = async () => {
    try {
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsEditing: true,
        quality: 0.8,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        setImageUri(result.assets[0].uri);
      }
    } catch (err) {
      console.log(err);
      showModal({ title: "Error", message: "Could not pick image.", variant: "error" });
    }
  };

  const handleCreate = async () => {
    if (!profile?.id) return;

    if (!title.trim()) {
      showModal({ title: "Required", message: "Please provide an article title.", variant: "warning" });
      return;
    }

    if (!content.trim()) {
      showModal({ title: "Required", message: "Please write the article content.", variant: "warning" });
      return;
    }

    const finalCategory = category === "Custom" ? customCategory.trim() : category;
    if (!finalCategory) {
      showModal({ title: "Required", message: "Please provide a category.", variant: "warning" });
      return;
    }

    setLoading(true);

    try {
      let finalImageUrl = null;

      if (imageUri) {
        const fileExt = imageUri.split(".").pop()?.toLowerCase() || "jpg";
        
        // Read image to base64
        const base64File = await FileSystem.readAsStringAsync(imageUri, {
          encoding: "base64",
        });

        const fileName = `${profile.id}/${Date.now()}_article_cover.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("education_files")
          .upload(fileName, decode(base64File), {
            contentType: `image/${fileExt === "jpg" ? "jpeg" : fileExt}`,
          });

        if (uploadError) throw uploadError;

        const { data: publicUrlData } = supabase.storage
          .from("education_files")
          .getPublicUrl(fileName);

        finalImageUrl = publicUrlData.publicUrl;
      }

      // If user is admin/mod, auto-approve immediately
      const defaultStatus = isAdmin ? "approved" : "pending";

      const { error } = await supabase.from("education_materials").insert({
        author_id: profile.id,
        title: title.trim(),
        description: content.substring(0, 100) + "...", // Auto-generate brief description from content
        article_content: content.trim(),
        cover_image_url: finalImageUrl,
        category: finalCategory,
        difficulty: "intermediate", // Default
        material_type: "article",
        material_url: finalImageUrl || "https://cryptonians.app", // Fallback to satisfy DB constraints if needed
        status: defaultStatus,
      });

      if (error) throw error;

      setShowSuccessModal(true);
    } catch (e: any) {
      console.error("Create Article Error:", e);
      showModal({ title: "Creation Failed", message: e?.message || "Something went wrong.", variant: "error" });
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
          Create Article
        </Text>
      </View>

      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        <ScrollView className="flex-1 px-5 pt-4" showsVerticalScrollIndicator={false}>
          
          {/* Cover Image Picker */}
          <Text className="text-sm font-bold mb-2 ml-1" style={{ color: colors.textSecondary }}>Cover Image (Optional)</Text>
          <TouchableOpacity
            onPress={pickImage}
            className={`h-40 rounded-xl items-center justify-center mb-6 overflow-hidden border-2 border-dashed ${isDark ? "border-[#2C2C2E] bg-[#1C1C1E]" : "border-gray-200 bg-gray-50"}`}
          >
            {imageUri ? (
              <Image source={{ uri: imageUri }} className="w-full h-full" resizeMode="cover" />
            ) : (
              <View className="items-center">
                <ImageIcon size={32} color={colors.textSecondary} className="mb-2" />
                <Text style={{ color: colors.textSecondary }}>Tap to select cover image</Text>
              </View>
            )}
          </TouchableOpacity>

          {/* Title Input */}
          <Text className="text-sm font-bold mb-2 ml-1" style={{ color: colors.textSecondary }}>Title</Text>
          <TextInput
            placeholder="E.g. The Future of DeFi in 2026..."
            placeholderTextColor={isDark ? "#666" : "#9ca3af"}
            value={title}
            onChangeText={setTitle}
            style={{ color: colors.text, backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6" }}
            className="w-full p-4 rounded-xl mb-6 font-medium text-base"
          />

          {/* Category */}
          <Text className="text-sm font-bold mb-2 ml-1" style={{ color: colors.textSecondary }}>Category</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-6">
            {CATEGORIES.map((cat) => (
              <TouchableOpacity
                key={cat}
                onPress={() => setCategory(cat)}
                className={`py-2 px-4 rounded-full mr-2 border ${category === cat ? "border-[#6C63FF] bg-[#6C63FF]/10" : isDark ? "border-[#2C2C2E] bg-[#1C1C1E]" : "border-gray-200 bg-white"}`}
              >
                <Text style={{ color: category === cat ? "#6C63FF" : colors.textSecondary, fontWeight: category === cat ? "bold" : "normal" }}>
                  {cat}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>

          {category === "Custom" && (
            <TextInput
              placeholder="Enter custom category"
              placeholderTextColor={isDark ? "#666" : "#9ca3af"}
              value={customCategory}
              onChangeText={setCustomCategory}
              style={{ color: colors.text, backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6" }}
              className="w-full p-4 rounded-xl mb-6 text-base"
            />
          )}

          {/* Article Content Input */}
          <Text className="text-sm font-bold mb-2 ml-1" style={{ color: colors.textSecondary }}>Article Content</Text>
          <TextInput
            placeholder="Write your article here..."
            placeholderTextColor={isDark ? "#666" : "#9ca3af"}
            value={content}
            onChangeText={setContent}
            multiline
            textAlignVertical="top"
            style={{ color: colors.text, backgroundColor: isDark ? "#1C1C1E" : "#F3F4F6", minHeight: 250 }}
            className="w-full p-4 rounded-xl mb-12 text-base leading-relaxed"
          />

          {/* Submit Button */}
          <TouchableOpacity
            onPress={handleCreate}
            disabled={loading}
            className="w-full bg-[#6C63FF] py-4 rounded-xl items-center justify-center flex-row mb-12"
          >
            {loading ? (
              <ActivityIndicator color="white" />
            ) : (
              <>
                <FileText size={20} color="white" />
                <Text className="text-white font-bold text-lg ml-2">Publish Article</Text>
              </>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>

      <AppModal {...modalProps} />

      {/* Success Modal */}
      <Modal visible={showSuccessModal} transparent animationType="fade">
        <View className="flex-1 bg-black/60 items-center justify-center px-5">
          <View className="w-full p-6 rounded-3xl items-center" style={{ backgroundColor: isDark ? "#1C1C1E" : "#FFF" }}>
            <View className="w-16 h-16 rounded-full bg-green-500/20 items-center justify-center mb-4">
              <CheckCircle size={32} color="#10B981" />
            </View>
            <Text className="text-2xl font-bold mb-2 text-center" style={{ color: colors.text }}>
              Article Published!
            </Text>
            <Text className="text-base text-center mb-6" style={{ color: colors.textSecondary }}>
              {isAdmin
                ? "Your article is now live on the hub."
                : "Your article has been submitted and is pending review by moderators."}
            </Text>
            <TouchableOpacity
              onPress={() => {
                setShowSuccessModal(false);
                router.back();
              }}
              className="w-full bg-[#6C63FF] py-4 rounded-xl items-center justify-center"
            >
              <Text className="text-white font-bold text-lg">Done</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

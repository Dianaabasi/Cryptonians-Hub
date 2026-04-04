import React, { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ScrollView,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useLocalSearchParams } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { X, Image as ImageIcon, Trash2 } from "lucide-react-native";
import { Button } from "@/components/ui/Button";

export default function ComposeScreen() {
  const router = useRouter();
  const { nicheId, isAnnouncement } = useLocalSearchParams<{ nicheId?: string, isAnnouncement?: string }>();
  const { theme } = useThemeStore();
  const { profile } = useAuthStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(false);
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64);
    }
  };

  const handlePost = async () => {
    if (!content.trim() && !imageUri) return;

    setLoading(true);
    let finalImageUrl = null;

    try {
      // 1. Upload Image (if any)
      if (imageBase64 && imageUri) {
        const ext = imageUri.split('.').pop() || 'jpeg';
        const filename = `${profile?.id}-${Date.now()}.${ext}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('posts')
          .upload(filename, decode(imageBase64), {
            contentType: `image/${ext}`,
          });
          
        if (uploadError) {
          console.error("Upload error:", uploadError);
          Alert.alert("Error", "Could not upload image. Please ensure the 'posts' storage bucket exists and is public.");
          setLoading(false);
          return;
        }

        if (uploadData) {
          const { data: publicUrlData } = supabase.storage.from('posts').getPublicUrl(filename);
          finalImageUrl = publicUrlData.publicUrl;
        }
      }

      // 2. Insert Post Row
      const { error } = await supabase.from("posts").insert({
        author_id: profile?.id,
        content: content.trim(),
        niche_id: nicheId || null,
        is_job_post: false,
        is_announcement: isAnnouncement === "true",
        image_url: finalImageUrl,
      });

      if (error) {
        Alert.alert("Error posting", error.message);
        return;
      }

      router.back();
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Something went wrong.");
    } finally {
      setLoading(false);
    }
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
        <View className="flex-row items-center justify-between px-5 pt-4 pb-4 border-b border-[#2C2C2E]">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <X size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-lg font-bold" style={{ color: colors.text }}>
            {isAnnouncement === "true" ? "New Announcement" : nicheId ? "Community Post" : "New Post"}
          </Text>
          <View>
            <Button
              title="Post"
              onPress={handlePost}
              loading={loading}
              disabled={(!content.trim() && !imageUri) || loading}
              variant="primary"
              className="py-2 px-4 rounded-full min-w-[80px]"
              textClassName="text-sm font-bold"
              fullWidth={false}
            />
          </View>
        </View>

        {/* Compose Area */}
        <ScrollView className="flex-1 p-5">
          <TextInput
            value={content}
            onChangeText={setContent}
            placeholder={isAnnouncement === "true" ? "Write an official announcement..." : "What's happening in the Cryptoverse?"}
            placeholderTextColor={colors.textSecondary}
            multiline
            autoFocus
            className="text-lg leading-7 border-0"
            style={{ color: colors.text, minHeight: 150, textAlignVertical: "top" }}
          />
          
          {imageUri && (
            <View className="relative mt-4 mb-10 rounded-xl overflow-hidden">
              <Image source={{ uri: imageUri }} className="w-full h-64 rounded-xl bg-gray-800" resizeMode="cover" />
              <TouchableOpacity
                onPress={() => {
                  setImageUri(null);
                  setImageBase64(null);
                }}
                className="absolute top-2 right-2 bg-black/60 p-2 rounded-full"
              >
                <Trash2 size={20} color="#FFF" />
              </TouchableOpacity>
            </View>
          )}
        </ScrollView>

        {/* Toolbar */}
        <View className={`flex-row items-center px-5 py-3 ${isDark ? "bg-[#1C1C1E]" : "bg-gray-50"}`}>
          <TouchableOpacity onPress={pickImage} className="p-2 rounded-full bg-[#6C63FF]/10 mr-4 flex-row items-center">
            <ImageIcon size={22} color="#6C63FF" />
            <Text className="ml-2 font-medium" style={{ color: "#6C63FF" }}>
              Add Image
            </Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

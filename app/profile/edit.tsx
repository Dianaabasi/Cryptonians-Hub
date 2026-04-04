import React, { useState, useEffect } from "react";
import { View, Text, TextInput, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, Image } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import * as ImagePicker from "expo-image-picker";
import { decode } from "base64-arraybuffer";
import { useAuthStore } from "@/stores/authStore";
import { useThemeStore } from "@/stores/themeStore";
import { Colors } from "@/constants/Colors";
import { supabase } from "@/lib/supabase";
import { ArrowLeft, Camera, Check } from "lucide-react-native";

export default function EditProfileScreen() {
  const router = useRouter();
  const { theme } = useThemeStore();
  const { profile, setProfile } = useAuthStore();
  const colors = theme === "dark" ? Colors.dark : Colors.light;
  const isDark = theme === "dark";

  const [loading, setLoading] = useState(false);
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [bio, setBio] = useState(profile?.bio || "");
  const [xUsername, setXUsername] = useState(profile?.x_username || "");
  const [walletAddress, setWalletAddress] = useState(profile?.wallet_address || "");
  
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [imageBase64, setImageBase64] = useState<string | null>(null);

  useEffect(() => {
    // If the global profile updates, keep form synced
    if (profile) {
      setFullName(profile.full_name || "");
      setBio(profile.bio || "");
      setXUsername(profile.x_username || "");
      setWalletAddress(profile.wallet_address || "");
    }
  }, [profile]);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: 'images',
      allowsEditing: true,
      aspect: [1, 1], // Square avatar
      quality: 0.8,
      base64: true,
    });

    if (!result.canceled && result.assets[0].base64) {
      setImageUri(result.assets[0].uri);
      setImageBase64(result.assets[0].base64);
    }
  };

  const handleSave = async () => {
    if (!profile?.id) return;
    setLoading(true);

    try {
      let avatarUrl = profile.avatar_url;

      // Upload new avatar if selected
      if (imageBase64 && imageUri) {
        const ext = imageUri.split('.').pop() || 'jpeg';
        const filename = `${profile.id}-${Date.now()}.${ext}`;
        
        const { data: uploadData, error: uploadError } = await supabase.storage
          .from('avatars')
          .upload(filename, decode(imageBase64), { contentType: `image/${ext}` });
          
        if (uploadError) {
          Alert.alert("Avatar Error", "Could not upload profile picture. Did you create the 'avatars' public bucket?");
          console.error(uploadError);
        } else if (uploadData) {
          const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(filename);
          avatarUrl = publicUrlData.publicUrl;
        }
      }

      const updates = {
        full_name: fullName.trim(),
        bio: bio.trim(),
        x_username: xUsername.trim(),
        wallet_address: walletAddress.trim(),
        avatar_url: avatarUrl,
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await supabase
        .from('profiles')
        .update(updates)
        .eq('id', profile.id)
        .select()
        .single();

      if (error) throw error;

      if (data) {
        setProfile(data); // Update global store! UI responds instantly
        router.back();
      }
    } catch (err) {
      Alert.alert("Error", "Could not save profile details.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : "height"} className="flex-1">
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b" style={{ borderColor: isDark ? "#2C2C2E" : "#E5E7EB" }}>
          <TouchableOpacity onPress={() => router.back()} className="p-2 mr-3">
            <ArrowLeft size={24} color={colors.text} />
          </TouchableOpacity>
          <Text className="text-lg font-bold flex-1 text-center mr-6" style={{ color: colors.text }}>
            Edit Profile
          </Text>
        </View>

        <ScrollView className="flex-1 px-5 pt-8" showsVerticalScrollIndicator={false}>
          {/* Avatar Picker */}
          <View className="items-center mb-8">
            <TouchableOpacity 
              onPress={pickImage}
              className="w-28 h-28 rounded-full items-center justify-center shadow-sm relative overflow-hidden"
              style={{ backgroundColor: isDark ? "#2C2C2E" : "#F3F4F6", borderColor: "#6C63FF", borderWidth: imageUri ? 2 : 0 }}
            >
              {imageUri || profile?.avatar_url ? (
                <Image 
                  source={{ uri: imageUri || profile?.avatar_url || "" }} 
                  className="w-full h-full rounded-full" 
                />
              ) : (
                <Text className="text-4xl font-bold" style={{ color: colors.textSecondary }}>
                  {profile?.username?.charAt(0).toUpperCase()}
                </Text>
              )}
              <View className="absolute bottom-0 w-full h-8 bg-black/50 items-center justify-center">
                <Camera size={14} color="#FFF" />
              </View>
            </TouchableOpacity>
            <Text className="text-xs mt-3" style={{ color: colors.textSecondary }}>
              Tap to change picture
            </Text>
          </View>

          {/* Form Fields */}
          <View className="mb-5">
            <Text className="text-xs font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: colors.textSecondary }}>
              Full Name
            </Text>
            <TextInput
              value={fullName}
              onChangeText={setFullName}
              placeholder="Your name"
              placeholderTextColor={colors.textSecondary}
              className={`px-4 py-4 rounded-2xl text-base font-medium ${isDark ? "bg-[#1C1C1E] text-white" : "bg-gray-50 text-black border border-gray-100"}`}
            />
          </View>

          <View className="mb-5">
            <Text className="text-xs font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: colors.textSecondary }}>
              Bio
            </Text>
            <TextInput
              value={bio}
              onChangeText={setBio}
              placeholder="Tell the community about yourself..."
              placeholderTextColor={colors.textSecondary}
              multiline
              className={`px-4 py-4 rounded-2xl text-base font-medium max-h-32 min-h-[80px] ${isDark ? "bg-[#1C1C1E] text-white" : "bg-gray-50 text-black border border-gray-100"}`}
              style={{ textAlignVertical: 'top' }}
            />
          </View>

          <View className="mb-5">
            <Text className="text-xs font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: colors.textSecondary }}>
              X (Twitter) Username
            </Text>
            <View className={`flex-row items-center px-4 rounded-2xl ${isDark ? "bg-[#1C1C1E]" : "bg-gray-50 border border-gray-100"}`}>
              <Text className="font-bold mr-1" style={{ color: colors.textSecondary }}>@</Text>
              <TextInput
                value={xUsername}
                onChangeText={setXUsername}
                placeholder="username"
                autoCapitalize="none"
                placeholderTextColor={colors.textSecondary}
                className={`py-4 flex-1 text-base font-medium ${isDark ? "text-white" : "text-black"}`}
              />
            </View>
          </View>

          <View className="mb-10">
            <Text className="text-xs font-bold uppercase tracking-wider mb-2 ml-1" style={{ color: colors.textSecondary }}>
              Wallet Address
            </Text>
            <TextInput
              value={walletAddress}
              onChangeText={setWalletAddress}
              placeholder="0x..."
              autoCapitalize="none"
              placeholderTextColor={colors.textSecondary}
              className={`px-4 py-4 rounded-2xl text-base font-medium ${isDark ? "bg-[#1C1C1E] text-white" : "bg-gray-50 text-black border border-gray-100"}`}
            />
          </View>

          <TouchableOpacity 
            onPress={handleSave}
            disabled={loading}
            className={`flex-row items-center justify-center p-4 rounded-2xl shadow-sm ${loading ? "opacity-70" : ""}`}
            style={{ backgroundColor: "#6C63FF" }}
          >
            <Check size={20} color="#FFF" />
            <Text className="font-bold text-lg text-white ml-2">
              {loading ? "Saving..." : "Save Changes"}
            </Text>
          </TouchableOpacity>
          
          <View className="h-10" />
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

import React, { useState } from "react";
import {
  View,
  Text,
  KeyboardAvoidingView,
  Platform,
  Image,
  Alert,
  TouchableOpacity,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { ArrowLeft } from "lucide-react-native";

const { width: SCREEN_WIDTH } = Dimensions.get("window");
const LOGO_SIZE = SCREEN_WIDTH * 0.3;

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const validateEmail = (): boolean => {
    if (!email.trim()) {
      setError("Email is required");
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError("Please enter a valid email");
      return false;
    }
    setError("");
    return true;
  };

  const handleLogin = async () => {
    if (!validateEmail()) return;

    setLoading(true);
    try {
      const { error: otpError } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
      });

      if (otpError) {
        Alert.alert("Login Error", otpError.message);
        return;
      }

      router.push({
        pathname: "/(auth)/verify",
        params: { email: email.trim().toLowerCase(), mode: "login" },
      });
    } catch (err) {
      Alert.alert("Error", "Something went wrong. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-[#0A0A0A]"
    >
      <View className="flex-1">
        {/* Header - back arrow only */}
        <View className="flex-row items-center px-5 pt-14 pb-4">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft size={24} color="#FAFAFA" />
          </TouchableOpacity>
        </View>

        <View className="flex-1 px-6 justify-center">
          {/* Large centered logo */}
          <View className="items-center mb-10">
            <Image
              source={require("@/assets/images/logo-white.png")}
              style={{ width: LOGO_SIZE, height: LOGO_SIZE }}
              resizeMode="contain"
            />
          </View>

          <View className="mb-8">
            <Text className="text-white text-3xl font-bold mb-3">
              Welcome Back
            </Text>
            <Text className="text-[#A1A1AA] text-base leading-6">
              Enter your email address and we'll send you a verification code to
              log in.
            </Text>
          </View>

          <Input
            label="Email Address"
            value={email}
            onChangeText={(v) => {
              setEmail(v);
              if (error) setError("");
            }}
            placeholder="you@example.com"
            error={error}
            keyboardType="email-address"
            autoCapitalize="none"
          />

          <View className="mt-4">
            <Button
              title="Send Verification Code"
              onPress={handleLogin}
              loading={loading}
            />
          </View>

          <TouchableOpacity
            onPress={() => router.push("/(auth)/signup")}
            className="mt-6 items-center"
          >
            <Text className="text-[#A1A1AA] text-sm">
              Don't have an account?{" "}
              <Text className="text-[#6C63FF] font-semibold">Sign up</Text>
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

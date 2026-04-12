
import React, { useState, useEffect } from "react";
import { View, Text, Image, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/stores/authStore";
import { Button } from "@/components/ui/Button";
import { OtpInput } from "@/components/ui/OtpInput";
import { ArrowLeft } from "lucide-react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppModal, useAppModal } from "@/components/ui/AppModal";

const SIGNUP_DATA_KEY = "@cryptonians_signup_data";

export default function VerifyScreen() {
  const { email, mode } = useLocalSearchParams<{
    email: string;
    mode: "login" | "signup";
  }>();
  const router = useRouter();
  const { fetchProfile } = useAuthStore();
  const { showModal, modalProps } = useAppModal();
  const [code, setCode] = useState(["", "", "", "", "", "", "", ""]);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [canResend, setCanResend] = useState(false);

  useEffect(() => {
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          setCanResend(true);
          clearInterval(interval);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const handleVerify = async () => {
    const otpCode = code.join("");
    if (otpCode.length !== 8) {
      showModal({ title: "Invalid Code", message: "Please enter the complete 8-digit code.", variant: "error" });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.auth.verifyOtp({
        email: email!,
        token: otpCode,
        type: "email",
      });

      if (error) {
        showModal({ title: "Verification Failed", message: error.message, variant: "error" });
        setCode(["", "", "", "", "", "", "", ""]);
        return;
      }

      if (data.session && mode === "signup") {
        // Create profile with stored signup data
        await createProfile(data.session.user.id);
      }

      // Auth state listener in the store will handle navigation
    } catch (err) {
      showModal({ title: "Error", message: "Something went wrong. Please try again.", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const createProfile = async (userId: string) => {
    try {
      const storedData = await AsyncStorage.getItem(SIGNUP_DATA_KEY);
      if (!storedData) return;

      const formData = JSON.parse(storedData);

      const { error } = await supabase.from("profiles").upsert({
        id: userId,
        full_name: formData.full_name,
        email: formData.email.toLowerCase(),
        username: formData.username.toLowerCase(),
        gender: formData.gender || null,
        country: formData.country || null,
        phone_number: formData.phone_number || null,
        x_username: formData.x_username || null,
        heard_from: formData.heard_from || null,
        referral_id: formData.referral_id || null,
        role_in_space: formData.role_in_space || null,
        bio: formData.bio || null,
      });

      if (error) {
        console.error("Profile creation error:", error);
      }

      // Clean up stored data
      await AsyncStorage.removeItem(SIGNUP_DATA_KEY);

      // Fetch the created profile
      await fetchProfile(userId);
    } catch (err) {
      console.error("Error creating profile:", err);
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email!,
      });

      if (error) {
        showModal({ title: "Error", message: error.message, variant: "error" });
        return;
      }

      setResendTimer(60);
      setCanResend(false);
      showModal({ title: "Code Sent", message: "A new verification code has been sent to your email.", variant: "success" });

      // Restart timer
      const interval = setInterval(() => {
        setResendTimer((prev) => {
          if (prev <= 1) {
            setCanResend(true);
            clearInterval(interval);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch {
      showModal({ title: "Error", message: "Failed to resend code. Please try again.", variant: "error" });
    }
  };

  return (
    <>
      <View className="flex-1 bg-[#0A0A0A]">
        {/* Header */}
        <View className="flex-row items-center px-5 pt-14 pb-4">
          <TouchableOpacity onPress={() => router.back()} className="p-2 -ml-2">
            <ArrowLeft size={24} color="#FAFAFA" />
          </TouchableOpacity>
        </View>

        <View className="flex-1 px-6 justify-center">
          <View className="items-center mb-10">
            {/* Email icon circle */}
            <View className="w-20 h-20 rounded-full bg-[#6C63FF]/10 items-center justify-center mb-6">
              <Text className="text-4xl">📧</Text>
            </View>

            <Text className="text-white text-2xl font-bold mb-3 text-center">
              Check your email
            </Text>
            <Text className="text-[#A1A1AA] text-base text-center leading-6">
              We've sent a 6-digit verification code to{"\n"}
              <Text className="text-white font-medium">{email}</Text>
            </Text>
          </View>

          {/* OTP Input */}
          <View className="mb-8">
            <OtpInput code={code} setCode={setCode} length={8} />
          </View>

          <Button
            title="Verify"
            onPress={handleVerify}
            loading={loading}
            disabled={code.join("").length !== 8}
          />

          {/* Resend */}
          <View className="items-center mt-6">
            {canResend ? (
              <TouchableOpacity onPress={handleResend}>
                <Text className="text-[#6C63FF] font-semibold text-sm">
                  Resend Code
                </Text>
              </TouchableOpacity>
            ) : (
              <Text className="text-[#71717A] text-sm">
                Resend code in{" "}
                <Text className="text-white font-medium">{resendTimer}s</Text>
              </Text>
            )}
          </View>
        </View>
      </View>
      <AppModal {...modalProps} />
    </>
  );
}

import React, { useState, useCallback, useRef, useEffect } from "react";
import {
  View,
  Text,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter } from "expo-router";
import { supabase } from "@/lib/supabase";
import { SignupFormData, INITIAL_SIGNUP_DATA, HEARD_FROM_OPTIONS } from "@/lib/types";
import { COUNTRIES } from "@/constants/Countries";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { StepIndicator } from "@/components/ui/StepIndicator";
import { ArrowLeft } from "lucide-react-native";
import { TouchableOpacity } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { AppModal, useAppModal } from "@/components/ui/AppModal";

const SIGNUP_DATA_KEY = "@cryptonians_signup_data";

export default function SignupScreen() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const { showModal, modalProps } = useAppModal();
  const [formData, setFormData] = useState<SignupFormData>(INITIAL_SIGNUP_DATA);
  const [errors, setErrors] = useState<Partial<Record<keyof SignupFormData, string>>>({});
  const [loading, setLoading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateField = (field: keyof SignupFormData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => ({ ...prev, [field]: undefined }));
    }

    // Debounced username check
    if (field === "username") {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
      const trimmed = value.trim();
      if (trimmed.length < 3 || !/^[a-zA-Z0-9_]+$/.test(trimmed)) {
        setUsernameStatus("idle");
        return;
      }
      setUsernameStatus("checking");
      debounceTimer.current = setTimeout(async () => {
        const isUnique = await checkUsernameUnique(trimmed);
        setUsernameStatus(isUnique ? "available" : "taken");
      }, 500);
    }
  };

  const getDialCode = () => {
    const country = COUNTRIES.find((c) => c.name === formData.country);
    return country?.dialCode || "+234";
  };

  const validateStep1 = (): boolean => {
    const newErrors: typeof errors = {};
    if (!formData.full_name.trim()) newErrors.full_name = "Full name is required";
    if (!formData.email.trim()) newErrors.email = "Email is required";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email))
      newErrors.email = "Invalid email address";
    if (!formData.gender) newErrors.gender = "Please select your gender";
    if (!formData.country) newErrors.country = "Please select your country";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const validateStep2 = (): boolean => {
    const newErrors: typeof errors = {};
    if (!formData.phone_number.trim())
      newErrors.phone_number = "Phone number is required";
    if (!formData.heard_from) newErrors.heard_from = "Please tell us how you heard about us";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const checkUsernameUnique = async (username: string): Promise<boolean> => {
    setCheckingUsername(true);
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", username.toLowerCase())
        .maybeSingle();

      if (error) {
        console.error("Username check error:", error);
        return true; // Allow if check fails
      }
      return !data;
    } finally {
      setCheckingUsername(false);
    }
  };

  const validateStep3 = async (): Promise<boolean> => {
    const newErrors: typeof errors = {};
    if (!formData.username.trim()) {
      newErrors.username = "Username is required";
    } else if (formData.username.length < 3) {
      newErrors.username = "Username must be at least 3 characters";
    } else if (!/^[a-zA-Z0-9_]+$/.test(formData.username)) {
      newErrors.username = "Username can only contain letters, numbers, and underscores";
    } else {
      const isUnique = await checkUsernameUnique(formData.username);
      if (!isUnique) {
        newErrors.username = "This username is already taken";
      }
    }
    if (!formData.role_in_space.trim())
      newErrors.role_in_space = "Please tell us what you do";
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = async () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    } else if (step === 3) {
      const isValid = await validateStep3();
      if (isValid) {
        handleSignup();
      }
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    } else {
      router.back();
    }
  };

  const handleSignup = async () => {
    setLoading(true);
    try {
      // Store signup data temporarily for profile creation after verification
      await AsyncStorage.setItem(SIGNUP_DATA_KEY, JSON.stringify(formData));

      // Use signInWithOtp — this sends a 6-digit OTP code to the email
      // If the user doesn't exist yet, they'll be created on verification
      const { error } = await supabase.auth.signInWithOtp({
        email: formData.email.trim().toLowerCase(),
        options: {
          data: {
            full_name: formData.full_name,
            username: formData.username.toLowerCase(),
          },
        },
      });

      if (error) {
        showModal({ title: "Signup Error", message: error.message, variant: "error" });
        return;
      }

      router.push({
        pathname: "/(auth)/verify",
        params: { email: formData.email, mode: "signup" },
      });
    } catch (err) {
      showModal({ title: "Error", message: "Something went wrong. Please try again.", variant: "error" });
    } finally {
      setLoading(false);
    }
  };

  const countryOptions = COUNTRIES.map((c) => ({
    label: c.name,
    value: c.name,
  }));

  const genderOptions = [
    { label: "Male", value: "male" },
    { label: "Female", value: "female" },
  ];

  const heardFromOptions = HEARD_FROM_OPTIONS.map((h) => ({
    label: h,
    value: h,
  }));

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : "height"}
      className="flex-1 bg-[#0A0A0A]"
    >
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View className="flex-row items-center px-5 pt-14 pb-4">
          <TouchableOpacity onPress={handleBack} className="p-2 -ml-2">
            <ArrowLeft size={24} color="#FAFAFA" />
          </TouchableOpacity>
        </View>

        <View className="px-6 flex-1">
          <Text className="text-white text-2xl font-bold mb-2">
            Become a Cryptonian
          </Text>
          <Text className="text-[#A1A1AA] text-base mb-6">
            {step === 1
              ? "Let's start with your basic info"
              : step === 2
              ? "How can we reach you?"
              : "Almost there! Set up your identity"}
          </Text>

          <StepIndicator currentStep={step} totalSteps={3} />

          {/* Step 1 */}
          {step === 1 && (
            <View>
              <Input
                label="Full Name"
                value={formData.full_name}
                onChangeText={(v) => updateField("full_name", v)}
                placeholder="Enter your full name"
                error={errors.full_name}
                autoCapitalize="words"
              />
              <Input
                label="Email Address"
                value={formData.email}
                onChangeText={(v) => updateField("email", v)}
                placeholder="you@example.com"
                error={errors.email}
                keyboardType="email-address"
                autoCapitalize="none"
              />
              <Select
                label="Gender"
                value={formData.gender}
                options={genderOptions}
                onSelect={(v) => updateField("gender", v)}
                placeholder="Select gender"
                error={errors.gender}
              />
              <Select
                label="Country"
                value={formData.country}
                options={countryOptions}
                onSelect={(v) => updateField("country", v)}
                placeholder="Select your country"
                error={errors.country}
                searchable
              />
            </View>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <View>
              <Input
                label="Phone Number"
                value={formData.phone_number}
                onChangeText={(v) => updateField("phone_number", v)}
                placeholder="Enter your phone number"
                error={errors.phone_number}
                keyboardType="phone-pad"
                prefix={getDialCode()}
              />
              <Input
                label="X (Twitter) Username"
                value={formData.x_username}
                onChangeText={(v) => updateField("x_username", v)}
                placeholder="@username"
                autoCapitalize="none"
                prefix="@"
              />
              <Select
                label="How did you hear about us?"
                value={formData.heard_from}
                options={heardFromOptions}
                onSelect={(v) => updateField("heard_from", v)}
                placeholder="Select an option"
                error={errors.heard_from}
              />
              <Input
                label="Referral ID (Optional)"
                value={formData.referral_id}
                onChangeText={(v) => updateField("referral_id", v)}
                placeholder="Enter referral ID"
                autoCapitalize="none"
              />
            </View>
          )}

          {/* Step 3 */}
          {step === 3 && (
            <View>
              <Input
                label="Username"
                value={formData.username}
                onChangeText={(v) => updateField("username", v)}
                placeholder="Choose a unique username"
                error={errors.username}
                autoCapitalize="none"
              />
              {usernameStatus === "checking" && (
                <Text className="text-[#6C63FF] text-xs -mt-2 mb-4 ml-1">
                  Checking availability...
                </Text>
              )}
              {usernameStatus === "available" && (
                <Text className="text-green-400 text-xs -mt-2 mb-4 ml-1">
                  ✓ Username is available
                </Text>
              )}
              {usernameStatus === "taken" && (
                <Text className="text-red-400 text-xs -mt-2 mb-4 ml-1">
                  ✗ Username is already taken
                </Text>
              )}
              <Input
                label="What do you do in the space?"
                value={formData.role_in_space}
                onChangeText={(v) => updateField("role_in_space", v)}
                placeholder="e.g. Trader, Developer, Researcher"
                error={errors.role_in_space}
              />
              <Input
                label="Bio (Optional)"
                value={formData.bio}
                onChangeText={(v) => updateField("bio", v)}
                placeholder="Tell us a bit about yourself..."
                multiline
                numberOfLines={4}
              />
            </View>
          )}
        </View>

        {/* Bottom Button */}
        <View className="px-6 pb-10 pt-4">
          <Button
            title={step === 3 ? "Finish" : "Continue"}
            onPress={handleNext}
            loading={loading || checkingUsername}
            disabled={loading || checkingUsername}
          />
        </View>
      </ScrollView>
      <AppModal {...modalProps} />
    </KeyboardAvoidingView>
  );
}

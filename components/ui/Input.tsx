import React, { useState } from "react";
import { View, TextInput, Text, TouchableOpacity } from "react-native";
import { Eye, EyeOff } from "lucide-react-native";

interface InputProps {
  label: string;
  value: string;
  onChangeText: (text: string) => void;
  placeholder?: string;
  error?: string;
  secureTextEntry?: boolean;
  keyboardType?: "default" | "email-address" | "phone-pad" | "numeric";
  autoCapitalize?: "none" | "sentences" | "words" | "characters";
  maxLength?: number;
  multiline?: boolean;
  numberOfLines?: number;
  editable?: boolean;
  prefix?: string;
  isDark?: boolean;
}

export function Input({
  label,
  value,
  onChangeText,
  placeholder,
  error,
  secureTextEntry = false,
  keyboardType = "default",
  autoCapitalize = "sentences",
  maxLength,
  multiline = false,
  numberOfLines = 1,
  editable = true,
  prefix,
  isDark = true,
}: InputProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [isFocused, setIsFocused] = useState(false);

  const bgColor = isDark ? "bg-[#1C1C1E]" : "bg-[#F9FAFB]";
  const textColor = isDark ? "text-white" : "text-[#1A1A1A]";
  const labelColor = isDark ? "text-[#A1A1AA]" : "text-[#6B7280]";
  const placeholderColor = isDark ? "#71717A" : "#9CA3AF";
  const borderColor = error
    ? "border-red-500"
    : isFocused
    ? "border-[#6C63FF]"
    : "border-transparent";

  return (
    <View className="mb-4">
      <Text className={`${labelColor} text-sm font-medium mb-2`}>{label}</Text>
      <View
        className={`${bgColor} rounded-xl border-2 ${borderColor} flex-row items-center ${
          multiline ? "items-start" : ""
        }`}
      >
        {prefix && (
          <Text className={`${textColor} pl-4 text-base font-medium`}>
            {prefix}
          </Text>
        )}
        <TextInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={placeholderColor}
          secureTextEntry={secureTextEntry && !showPassword}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          maxLength={maxLength}
          multiline={multiline}
          numberOfLines={numberOfLines}
          editable={editable}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          className={`${textColor} flex-1 px-4 py-3.5 text-base ${
            multiline ? "min-h-[100px] text-start" : ""
          }`}
          style={{ textAlignVertical: multiline ? "top" : "center" }}
        />
        {secureTextEntry && (
          <TouchableOpacity
            onPress={() => setShowPassword(!showPassword)}
            className="pr-4"
          >
            {showPassword ? (
              <EyeOff size={20} color={placeholderColor} />
            ) : (
              <Eye size={20} color={placeholderColor} />
            )}
          </TouchableOpacity>
        )}
      </View>
      {error && (
        <Text className="text-red-500 text-xs mt-1.5 ml-1">{error}</Text>
      )}
    </View>
  );
}

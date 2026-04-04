import React, { useRef, useEffect } from "react";
import { View, TextInput, Pressable } from "react-native";

interface OtpInputProps {
  code: string[];
  setCode: (code: string[]) => void;
  length?: number;
  isDark?: boolean;
}

export function OtpInput({
  code,
  setCode,
  length = 6,
  isDark = true,
}: OtpInputProps) {
  const inputRefs = useRef<(TextInput | null)[]>([]);

  const bgColor = isDark ? "bg-[#1C1C1E]" : "bg-[#F9FAFB]";
  const textColor = isDark ? "text-white" : "text-[#1A1A1A]";

  const handleChange = (text: string, index: number) => {
    const newCode = [...code];

    // Handle paste
    if (text.length > 1) {
      const pasted = text.slice(0, length).split("");
      for (let i = 0; i < pasted.length; i++) {
        if (index + i < length) {
          newCode[index + i] = pasted[i];
        }
      }
      setCode(newCode);
      const nextIndex = Math.min(index + pasted.length, length - 1);
      inputRefs.current[nextIndex]?.focus();
      return;
    }

    newCode[index] = text;
    setCode(newCode);

    // Auto-advance
    if (text && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyPress = (e: any, index: number) => {
    if (e.nativeEvent.key === "Backspace" && !code[index] && index > 0) {
      const newCode = [...code];
      newCode[index - 1] = "";
      setCode(newCode);
      inputRefs.current[index - 1]?.focus();
    }
  };

  useEffect(() => {
    // Auto-focus first input
    setTimeout(() => inputRefs.current[0]?.focus(), 300);
  }, []);

  return (
    <View className="flex-row justify-center gap-2">
      {Array.from({ length }).map((_, index) => (
        <Pressable
          key={index}
          onPress={() => inputRefs.current[index]?.focus()}
        >
          <TextInput
            ref={(ref) => {
              inputRefs.current[index] = ref;
            }}
            value={code[index]}
            onChangeText={(text) => handleChange(text, index)}
            onKeyPress={(e) => handleKeyPress(e, index)}
            keyboardType="number-pad"
            maxLength={index === 0 ? length : 1}
            selectTextOnFocus
            className={`w-10 h-12 ${bgColor} rounded-xl text-center text-lg font-bold ${textColor} border-2 ${
              code[index]
                ? "border-[#6C63FF]"
                : "border-transparent"
            }`}
          />
        </Pressable>
      ))}
    </View>
  );
}

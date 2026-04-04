import React from "react";
import { View, Text } from "react-native";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  isDark?: boolean;
}

export function StepIndicator({
  currentStep,
  totalSteps,
  isDark = true,
}: StepIndicatorProps) {
  const mutedColor = isDark ? "text-[#71717A]" : "text-[#9CA3AF]";
  const textColor = isDark ? "text-white" : "text-[#1A1A1A]";

  return (
    <View className="flex-row items-center gap-2 mb-6">
      {Array.from({ length: totalSteps }).map((_, index) => {
        const step = index + 1;
        const isActive = step === currentStep;
        const isCompleted = step < currentStep;

        return (
          <View key={step} className="flex-row items-center gap-2">
            <View
              className={`w-8 h-8 rounded-full items-center justify-center ${
                isActive
                  ? "bg-[#6C63FF]"
                  : isCompleted
                  ? "bg-[#6C63FF]/30"
                  : isDark
                  ? "bg-[#1C1C1E]"
                  : "bg-[#E5E7EB]"
              }`}
            >
              <Text
                className={`text-sm font-bold ${
                  isActive || isCompleted ? "text-white" : mutedColor
                }`}
              >
                {isCompleted ? "✓" : step}
              </Text>
            </View>
            {step < totalSteps && (
              <View
                className={`h-0.5 w-8 ${
                  isCompleted ? "bg-[#6C63FF]" : isDark ? "bg-[#2E2E30]" : "bg-[#E5E7EB]"
                }`}
              />
            )}
          </View>
        );
      })}
      <Text className={`${mutedColor} text-sm ml-auto`}>
        Step {currentStep} of {totalSteps}
      </Text>
    </View>
  );
}

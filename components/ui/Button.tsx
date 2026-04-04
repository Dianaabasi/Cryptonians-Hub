import React from "react";
import {
  TouchableOpacity,
  Text,
  ActivityIndicator,
  ViewStyle,
  TextStyle,
} from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";

const AnimatedTouchable = Animated.createAnimatedComponent(TouchableOpacity);

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  className?: string;
  textClassName?: string;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading = false,
  disabled = false,
  style,
  textStyle,
  fullWidth = true,
  className = "",
  textClassName = "",
}: ButtonProps) {
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePressIn = () => {
    scale.value = withSpring(0.96, { damping: 15, stiffness: 300 });
  };

  const handlePressOut = () => {
    scale.value = withSpring(1, { damping: 15, stiffness: 300 });
  };

  const baseClasses = "rounded-xl items-center justify-center py-4 px-6";
  const widthClass = fullWidth ? "w-full" : "";

  const variantClasses = {
    primary: "bg-[#6C63FF]",
    secondary: "bg-[#1C1C1E]",
    outline: "border-2 border-[#6C63FF] bg-transparent",
    ghost: "bg-transparent",
  };

  const textClasses = {
    primary: "text-white font-semibold text-base",
    secondary: "text-white font-semibold text-base",
    outline: "text-[#6C63FF] font-semibold text-base",
    ghost: "text-[#6C63FF] font-semibold text-base",
  };

  const disabledClass = disabled || loading ? "opacity-50" : "";

  return (
    <AnimatedTouchable
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      disabled={disabled || loading}
      activeOpacity={0.8}
      style={[animatedStyle, style]}
      className={`${baseClasses} ${widthClass} ${variantClasses[variant]} ${disabledClass} ${className}`}
    >
      {loading ? (
        <ActivityIndicator
          color={variant === "outline" || variant === "ghost" ? "#6C63FF" : "#fff"}
          size="small"
        />
      ) : (
        <Text className={`${textClasses[variant]} ${textClassName}`} style={textStyle}>
          {title}
        </Text>
      )}
    </AnimatedTouchable>
  );
}

import React, { useEffect } from "react";
import { View, ViewStyle } from "react-native";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  interpolate,
} from "react-native-reanimated";

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: ViewStyle;
  isDark?: boolean;
}

export function SkeletonLoader({
  width = "100%",
  height = 20,
  borderRadius = 8,
  style,
  isDark = true,
}: SkeletonLoaderProps) {
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(
      withTiming(1, { duration: 1200 }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: interpolate(shimmer.value, [0, 1], [0.3, 0.7]),
  }));

  const bgColor = isDark ? "#1C1C1E" : "#E5E7EB";

  return (
    <Animated.View
      style={[
        {
          width: width as any,
          height,
          borderRadius,
          backgroundColor: bgColor,
        },
        animatedStyle,
        style,
      ]}
    />
  );
}

interface SkeletonCardProps {
  isDark?: boolean;
}

export function SkeletonCard({ isDark = true }: SkeletonCardProps) {
  const cardBg = isDark ? "bg-[#1C1C1E]" : "bg-white";

  return (
    <View className={`${cardBg} rounded-2xl p-4 mb-4`}>
      <View className="flex-row items-center mb-3">
        <SkeletonLoader
          width={40}
          height={40}
          borderRadius={20}
          isDark={isDark}
        />
        <View className="ml-3 flex-1">
          <SkeletonLoader
            width="60%"
            height={14}
            isDark={isDark}
            style={{ marginBottom: 6 }}
          />
          <SkeletonLoader width="30%" height={10} isDark={isDark} />
        </View>
      </View>
      <SkeletonLoader
        height={14}
        isDark={isDark}
        style={{ marginBottom: 8 }}
      />
      <SkeletonLoader width="80%" height={14} isDark={isDark} />
    </View>
  );
}

export function SkeletonChatRow({ isDark = true }: { isDark?: boolean }) {
  const borderColor = isDark ? "#2C2C2E" : "#F3F4F6";

  return (
    <View className="flex-row items-center py-4 border-b" style={{ borderColor }}>
      <View className="mr-4">
        <SkeletonLoader width={56} height={56} borderRadius={28} isDark={isDark} />
      </View>
      <View className="flex-1 justify-center">
        <View className="flex-row justify-between items-center mb-2">
          <SkeletonLoader width="40%" height={16} isDark={isDark} />
          <SkeletonLoader width="15%" height={12} isDark={isDark} />
        </View>
        <SkeletonLoader width="70%" height={14} isDark={isDark} />
      </View>
    </View>
  );
}

export function SkeletonNicheCard({ isDark = true }: { isDark?: boolean }) {
  const cardBg = isDark ? "bg-[#1C1C1E]" : "bg-white";
  const borderColor = isDark ? "border-[#2C2C2E]" : "border-gray-100";

  return (
    <View className={`p-4 mb-4 rounded-3xl ${cardBg} border ${borderColor}`}>
      <View className="flex-row justify-between items-start mb-3">
        <View className="flex-row items-center flex-1 pr-4">
          <View className="mr-3">
            <SkeletonLoader width={48} height={48} borderRadius={16} isDark={isDark} />
          </View>
          <View className="flex-1">
            <SkeletonLoader width="50%" height={18} isDark={isDark} style={{ marginBottom: 6 }} />
            <SkeletonLoader width="80%" height={12} isDark={isDark} />
          </View>
        </View>
      </View>
      <View className="mt-2">
        <SkeletonLoader width="100%" height={40} borderRadius={12} isDark={isDark} />
      </View>
    </View>
  );
}

export function SkeletonProfile({ isDark = true }: { isDark?: boolean }) {
  const bg = isDark ? "#1C1C1E" : "#E5E7EB";
  return (
    <View>
      {/* Cover */}
      <SkeletonLoader width="100%" height={128} borderRadius={0} isDark={isDark} />
      <View className="px-5 pb-6">
        {/* Avatar + action buttons row */}
        <View className="flex-row justify-between items-end -mt-12 mb-3">
          <SkeletonLoader width={96} height={96} borderRadius={48} isDark={isDark} />
          <SkeletonLoader width={90} height={34} borderRadius={20} isDark={isDark} />
        </View>
        {/* Name + username */}
        <SkeletonLoader width="55%" height={24} borderRadius={8} isDark={isDark} style={{ marginBottom: 8 }} />
        <SkeletonLoader width="35%" height={16} borderRadius={8} isDark={isDark} style={{ marginBottom: 12 }} />
        {/* Bio */}
        <SkeletonLoader width="100%" height={14} borderRadius={6} isDark={isDark} style={{ marginBottom: 6 }} />
        <SkeletonLoader width="75%" height={14} borderRadius={6} isDark={isDark} style={{ marginBottom: 16 }} />
        {/* Stats row */}
        <View className="flex-row gap-6 mb-5">
          <SkeletonLoader width={60} height={40} borderRadius={8} isDark={isDark} />
          <SkeletonLoader width={60} height={40} borderRadius={8} isDark={isDark} />
          <SkeletonLoader width={60} height={40} borderRadius={8} isDark={isDark} />
        </View>
        {/* Tab bar */}
        <View className="flex-row gap-3 mb-5">
          <SkeletonLoader width="45%" height={36} borderRadius={20} isDark={isDark} />
          <SkeletonLoader width="45%" height={36} borderRadius={20} isDark={isDark} />
        </View>
      </View>
      {/* Post skeletons */}
      <View className="px-5">
        <SkeletonCard isDark={isDark} />
        <SkeletonCard isDark={isDark} />
      </View>
    </View>
  );
}

export function SkeletonNicheDetail({ isDark = true }: { isDark?: boolean }) {
  return (
    <View>
      {/* Banner */}
      <SkeletonLoader width="100%" height={144} borderRadius={0} isDark={isDark} />
      {/* Niche header */}
      <View className="px-5 py-4 flex-row justify-between items-center">
        <View className="flex-1 mr-4">
          <SkeletonLoader width="50%" height={20} borderRadius={8} isDark={isDark} style={{ marginBottom: 6 }} />
          <SkeletonLoader width="75%" height={13} borderRadius={6} isDark={isDark} />
        </View>
        <SkeletonLoader width={72} height={34} borderRadius={20} isDark={isDark} />
      </View>
      {/* Tab bar */}
      <View className="flex-row px-5 gap-2 mb-4">
        <SkeletonLoader width="30%" height={32} borderRadius={16} isDark={isDark} />
        <SkeletonLoader width="30%" height={32} borderRadius={16} isDark={isDark} />
        <SkeletonLoader width="30%" height={32} borderRadius={16} isDark={isDark} />
      </View>
      {/* Post skeletons */}
      <View className="px-5">
        <SkeletonCard isDark={isDark} />
        <SkeletonCard isDark={isDark} />
        <SkeletonCard isDark={isDark} />
      </View>
    </View>
  );
}

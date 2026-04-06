import React, { useRef, useState } from "react";
import {
  View,
  Text,
  FlatList,
  Dimensions,
  Image,
  ViewToken,
} from "react-native";
import { useRouter } from "expo-router";
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  interpolate,
  Extrapolation,
  useAnimatedScrollHandler,
  SharedValue,
} from "react-native-reanimated";
import { Button } from "@/components/ui/Button";
import { ONBOARDING_SLIDES } from "@/constants/Onboarding";

const { width: SCREEN_WIDTH } = Dimensions.get("window");

const ILLUSTRATIONS = [
  require("@/assets/images/onboarding_1.png"),
  require("@/assets/images/onboarding_2.png"),
  require("@/assets/images/onboarding_3.png"),
];

function PaginationDot({ index, scrollX }: { index: number; scrollX: SharedValue<number> }) {
  const animatedStyle = useAnimatedStyle(() => {
    const inputRange = [
      (index - 1) * SCREEN_WIDTH,
      index * SCREEN_WIDTH,
      (index + 1) * SCREEN_WIDTH,
    ];
    const width = interpolate(
      scrollX.value,
      inputRange,
      [8, 32, 8],
      Extrapolation.CLAMP
    );
    const opacity = interpolate(
      scrollX.value,
      inputRange,
      [0.3, 1, 0.3],
      Extrapolation.CLAMP
    );
    return { width, opacity };
  });

  return (
    <Animated.View
      style={animatedStyle}
      className="h-2 rounded-full bg-[#6C63FF] mx-1"
    />
  );
}

export default function OnboardingScreen() {
  const router = useRouter();
  const scrollX = useSharedValue(0);
  const [currentIndex, setCurrentIndex] = useState(0);
  const flatListRef = useRef<FlatList>(null);

  const scrollHandler = useAnimatedScrollHandler({
    onScroll: (event) => {
      scrollX.value = event.contentOffset.x;
    },
  });

  const onViewableItemsChanged = useRef(
    ({ viewableItems }: { viewableItems: ViewToken[] }) => {
      if (viewableItems[0]?.index !== null && viewableItems[0]?.index !== undefined) {
        setCurrentIndex(viewableItems[0].index);
      }
    }
  ).current;

  const viewabilityConfig = useRef({ viewAreaCoveragePercentThreshold: 50 }).current;

  const isLastSlide = currentIndex === ONBOARDING_SLIDES.length - 1;

  return (
    <View className="flex-1 bg-[#0A0A0A]">
      {/* Slides */}
      <Animated.FlatList
        ref={flatListRef}
        data={ONBOARDING_SLIDES}
        keyExtractor={(item) => item.id}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        bounces={false}
        onScroll={scrollHandler}
        scrollEventThrottle={16}
        onViewableItemsChanged={onViewableItemsChanged}
        viewabilityConfig={viewabilityConfig}
        renderItem={({ item, index }) => {
          return (
            <View
              style={{ width: SCREEN_WIDTH }}
              className="flex-1 items-center justify-center px-8"
            >
              {/* Illustration */}
              <Image
                source={ILLUSTRATIONS[index]}
                style={{ width: SCREEN_WIDTH * 0.7, height: SCREEN_WIDTH * 0.7 }}
                resizeMode="contain"
                className="mb-8"
              />

              <Text className="text-white text-3xl font-bold text-center mb-4">
                {item.title}
              </Text>
              <Text className="text-[#A1A1AA] text-base text-center leading-6 px-2">
                {item.description}
              </Text>
            </View>
          );
        }}
      />

      {/* Pagination & Buttons */}
      <View className="px-8 pb-12">
        {/* Dots */}
        <View className="flex-row items-center justify-center mb-10">
          {ONBOARDING_SLIDES.map((_, index) => (
            <PaginationDot key={index} index={index} scrollX={scrollX} />
          ))}
        </View>

        {/* Buttons */}
        {isLastSlide ? (
          <View className="gap-3">
            <Button
              title="Become a Member"
              onPress={() => router.push("/(auth)/signup")}
              variant="primary"
            />
            <Button
              title="Login"
              onPress={() => router.push("/(auth)/login")}
              variant="outline"
            />
          </View>
        ) : (
          <Button
            title="Next"
            onPress={() => {
              flatListRef.current?.scrollToIndex({
                index: currentIndex + 1,
                animated: true,
              });
            }}
            variant="primary"
          />
        )}
      </View>
    </View>
  );
}

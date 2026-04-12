import React, { useEffect } from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { useSegments } from 'expo-router';
import { useAudioStore } from '@/stores/audioStore';
import { useThemeStore } from '@/stores/themeStore';
import { Colors } from '@/constants/Colors';
import { Play, Pause, X } from 'lucide-react-native';
import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';

export function FloatingAudioPlayer() {
  const { currentUri, isPlaying, clearAudio, setPlayingState } = useAudioStore();
  const { theme } = useThemeStore();
  const isDark = theme === "dark";
  const colors = isDark ? Colors.dark : Colors.light;

  if (!currentUri) return null;

  // Render internal component so hooks rely on currentUri
  return <PlayerCore uri={currentUri} isDark={isDark} colors={colors} storeIsPlaying={isPlaying} clearAudio={clearAudio} setPlayingState={setPlayingState} />;
}

function PlayerCore({ uri, isDark, colors, storeIsPlaying, clearAudio, setPlayingState }: any) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const segments = useSegments();
  
  const playing = status.playing ?? false;
  const duration = (status.duration ?? 0) * 1000;
  const position = (status.currentTime ?? 0) * 1000;

  // Stop looping when finished
  useEffect(() => {
    if (status.didJustFinish) {
      setPlayingState(false);
      player.seekTo(0);
      player.pause();
    }
  }, [status.didJustFinish, setPlayingState]);

  // Sync external Zustand calls to native player
  useEffect(() => {
    if (storeIsPlaying && !playing && duration > 0 && !status.didJustFinish) {
      player.play();
    } else if (!storeIsPlaying && playing) {
      player.pause();
    }
  }, [storeIsPlaying, playing, duration, status.didJustFinish]);

  const togglePlay = () => {
    if (playing) {
      player.pause();
      setPlayingState(false);
    } else {
      if (status.didJustFinish || position >= duration - 500) player.seekTo(0);
      player.play();
      setPlayingState(true);
    }
  };

  const formatTime = (ms: number) => {
    const secs = Math.floor(ms / 1000);
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
  };

  const isChatOpen = (segments as string[]).includes('chat');
  
  // Hide UI completely inside any chat room, but keep playing.
  if (isChatOpen) return null;

  const progress = duration > 0 ? position / duration : 0;
  
  return (
    <View 
      className="absolute bottom-[105px] left-10 right-10 rounded-full shadow-xl flex-row items-center px-4 py-2 border"
      style={{ 
        backgroundColor: isDark ? "#2C2C2E" : "#FFF", 
        borderColor: isDark ? "#3C3C3E" : "#E5E7EB",
        zIndex: 9999 
      }}
    >
      <TouchableOpacity onPress={togglePlay} className="w-9 h-9 rounded-full bg-[#6C63FF] items-center justify-center">
        {playing ? <Pause size={16} color="#FFF" /> : <Play size={16} color="#FFF" style={{ marginLeft: 2 }} />}
      </TouchableOpacity>

      <View className="flex-1 mx-3 h-1.5 rounded-full bg-gray-200 overflow-hidden" style={{ backgroundColor: isDark ? "#3C3C3E" : "#E5E7EB" }}>
        <View className="h-full bg-[#6C63FF] rounded-full" style={{ width: `${progress * 100}%` }} />
      </View>

      <Text className="text-[11px] font-medium mr-2" style={{ color: colors.textSecondary }}>
        {playing ? formatTime(position) : formatTime(duration)}
      </Text>
      
      <TouchableOpacity onPress={clearAudio} className="p-1">
        <X size={16} color={colors.textSecondary} />
      </TouchableOpacity>
    </View>
  );
}

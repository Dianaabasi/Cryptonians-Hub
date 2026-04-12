import { create } from 'zustand';

interface AudioStoreState {
  currentUri: string | null;
  isPlaying: boolean;
  setAudio: (uri: string) => void;
  clearAudio: () => void;
  togglePlayPause: () => void;
  setPlayingState: (playing: boolean) => void;
}

export const useAudioStore = create<AudioStoreState>((set, get) => ({
  currentUri: null,
  isPlaying: false,

  setAudio: (uri) => {
    set({ currentUri: uri, isPlaying: true });
  },

  clearAudio: () => {
    set({ currentUri: null, isPlaying: false });
  },

  togglePlayPause: () => {
    const { isPlaying } = get();
    set({ isPlaying: !isPlaying });
  },
  
  setPlayingState: (playing) => {
    set({ isPlaying: playing });
  }
}));

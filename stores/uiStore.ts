import { create } from 'zustand';

interface UIState {
  isTabBarVisible: boolean;
  setTabBarVisible: (visible: boolean) => void;
  unreadDmCount: number;
  setUnreadDmCount: (count: number) => void;
}

export const useUIStore = create<UIState>((set) => ({
  isTabBarVisible: true,
  setTabBarVisible: (visible) => set({ isTabBarVisible: visible }),
  unreadDmCount: 0,
  setUnreadDmCount: (count) => set({ unreadDmCount: count }),
}));

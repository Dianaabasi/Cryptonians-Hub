import { create } from "zustand";
import { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { Profile } from "@/lib/types";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  isLoading: boolean;
  hasCompletedOnboarding: boolean;

  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  setLoading: (loading: boolean) => void;
  setHasCompletedOnboarding: (value: boolean) => void;
  fetchProfile: (userId: string) => Promise<void>;
  signOut: () => Promise<void>;
  initialize: () => () => void;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  session: null,
  profile: null,
  isLoading: true,
  hasCompletedOnboarding: false,

  setSession: (session) => set({ session }),
  setProfile: (profile) => set({ profile }),
  setLoading: (isLoading) => set({ isLoading }),
  setHasCompletedOnboarding: (value) => set({ hasCompletedOnboarding: value }),

  fetchProfile: async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle();

      if (error) {
        console.error("Error fetching profile:", error.message);
        return;
      }

      set({ profile: data as Profile });
    } catch (err) {
      console.error("Failed to fetch profile:", err);
    }
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ session: null, profile: null });
  },

  initialize: () => {
    // Get current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      set({ session });
      if (session?.user) {
        get().fetchProfile(session.user.id);
      }
      set({ isLoading: false });
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      set({ session });
      if (session?.user) {
        get().fetchProfile(session.user.id);
      } else {
        set({ profile: null });
      }
    });

    return () => subscription.unsubscribe();
  },
}));

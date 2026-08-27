import { create } from "zustand";
import { persist } from "zustand/middleware";
import { storeKey } from "./store-keys";

export interface BilibiliUserProfile {
  mid: number;
  uname: string;
  face: string;
}

interface BilibiliState {
  cookie: string;
  user: BilibiliUserProfile | null;
}

interface BilibiliActions {
  setLogin: (cookie: string, user: BilibiliUserProfile) => void;
  logout: () => void;
}

export const useBilibiliStore = create<BilibiliState & BilibiliActions>()(
  persist(
    (set) => ({
      cookie: "",
      user: null,
      setLogin: (cookie, user) => set({ cookie, user }),
      logout: () => set({ cookie: "", user: null }),
    }),
    { name: storeKey.BilibiliStore }
  )
);

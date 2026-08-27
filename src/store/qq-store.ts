import { create } from "zustand";
import { persist } from "zustand/middleware";
import { storeKey } from "./store-keys";
import type { QqUserProfile } from "@/lib/qqmusic/qqmusic-auth";

interface QqState {
  cookie: string;
  user: QqUserProfile | null;
}

interface QqActions {
  setLogin: (cookie: string, user: QqUserProfile) => void;
  logout: () => void;
}

export const useQqStore = create<QqState & QqActions>()(
  persist(
    (set) => ({
      cookie: "",
      user: null,
      setLogin: (cookie, user) => set({ cookie, user }),
      logout: () => set({ cookie: "", user: null }),
    }),
    { name: storeKey.QqStore }
  )
);

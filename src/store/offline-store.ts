import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storeKey } from "./store-keys";
import { idbStorage } from "@/lib/storage-adapter";
import { MusicSource } from "@/types/music";

export interface OfflineTrackRecord {
  trackId: string;
  source: "stream-cache";
  url: string;
  cachedAt: number;
  name: string;
  artist: string[];
  album: string;
  trackSource: MusicSource;
  url_id: string;
  pic_id: string;
  lyric_id: string;
}

interface OfflineStoreState {
  records: Record<string, OfflineTrackRecord>;

  addRecord: (record: OfflineTrackRecord) => void;
  removeRecord: (trackId: string) => void;
  clear: () => void;
}

export const useOfflineStore = create<OfflineStoreState>()(
  persist(
    (set) => ({
      records: {},

      addRecord: (record) =>
        set((s) => ({ records: { ...s.records, [record.trackId]: record } })),

      removeRecord: (trackId) =>
        set((s) => {
          const { [trackId]: _, ...rest } = s.records;
          return { records: rest };
        }),

      clear: () => set({ records: {} }),
    }),
    {
      name: storeKey.OfflineStore,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ records: state.records }),
    }
  )
);

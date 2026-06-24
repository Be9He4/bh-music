import { create } from "zustand";
import {
  saveDownloadRecordsToDisk,
  loadDownloadRecordsFromDisk,
} from "@/lib/utils/download";
import type { MusicSource } from "@/types/music";

export interface DownloadRecord {
  uri: string;
  cachedAt: number;
  name: string;
  artist: string[];
  album: string;
  trackSource: MusicSource;
  url_id: string;
  pic_id: string;
  lyric_id: string;
}

interface DownloadStoreState {
  records: Record<string, DownloadRecord | string>;

  init: () => Promise<void>;

  hasRecord: (key: string) => boolean;
  getUri: (key: string) => string | undefined;
  getRecord: (key: string) => DownloadRecord | undefined;
  addRecord: (key: string, record: DownloadRecord) => Promise<void>;
  removeRecord: (key: string) => Promise<void>;
  clear: () => Promise<void>;
}

export const useDownloadStore = create<DownloadStoreState>((set, get) => ({
  records: {},

  init: async () => {
    try {
      const diskRecords = await loadDownloadRecordsFromDisk();
      if (!diskRecords || typeof diskRecords !== "object") return;

      let migrated = false;
      for (const key of Object.keys(diskRecords)) {
        const val = diskRecords[key];
        if (typeof val === "string") {
          diskRecords[key] = {
            uri: val,
            cachedAt: 0,
            name: "",
            artist: [],
            album: "",
            trackSource: "unknown" as MusicSource,
            url_id: "",
            pic_id: "",
            lyric_id: "",
          };
          migrated = true;
        }
      }

      set({ records: diskRecords as Record<string, DownloadRecord | string> });

      if (migrated) {
        saveDownloadRecordsToDisk(diskRecords).catch(() => {});
      }
    } catch (error) {
      console.error("恢复下载记录失败:", error);
    }
  },

  hasRecord: (key) => !!get().records?.[key],

  getUri: (key) => {
    const r = get().records?.[key];
    if (!r) return undefined;
    if (typeof r === "string") return r;
    return r.uri;
  },

  getRecord: (key) => {
    const r = get().records?.[key];
    if (!r || typeof r === "string") return undefined;
    return r;
  },

  addRecord: async (key, record) => {
    let latestRecords: Record<string, DownloadRecord | string> = {};
    set((s) => {
      latestRecords = { ...s.records, [key]: record };
      return { records: latestRecords };
    });

    try {
      await saveDownloadRecordsToDisk(latestRecords);
    } catch (error) {
      console.error("保存下载记录失败:", error);
    }
  },

  removeRecord: async (key) => {
    const records = { ...get().records };
    delete records[key];

    set({ records });

    try {
      await saveDownloadRecordsToDisk(records);
    } catch (error) {
      console.error("删除下载记录失败:", error);
    }
  },

  clear: async () => {
    set({ records: {} });

    try {
      await saveDownloadRecordsToDisk({});
    } catch (error) {
      console.error("清空下载记录失败:", error);
    }
  },
}));

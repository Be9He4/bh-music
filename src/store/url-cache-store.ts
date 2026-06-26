import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import { storeKey } from "./store-keys";
import { idbStorage } from "@/lib/storage-adapter";
import { revokeBlobUrl } from "@/lib/utils/blob-registry";
import type { MusicSource } from "@/types/music";

/**
 * 构建 URL 缓存 key
 * @param source 音源
 * @param trackId 曲目目录 ID
 * @param urlId 曲目 URL 标识（local/podcast 等音源使用 urlId，其余使用 trackId）
 * @param quality 音质档位
 * @returns 缓存 key，格式为 `${source}:${id}:${quality}`
 */
export function buildUrlCacheKey(
  source: MusicSource,
  trackId: string,
  urlId: string | undefined,
  quality: string
): string {
  const id =
    (source as string) === "local" || source === "podcast"
      ? (urlId ?? trackId)
      : trackId;
  return `${source}:${id}:${quality}`;
}

/**
 * 已解析音频 URL 的持久化缓存状态
 */
interface UrlCacheState {
  /** URL 映射表，key 格式为 `${source}:${id}:${quality}` */
  urlMap: Record<string, string>;

  /** 获取指定 key 的缓存 URL */
  get: (key: string) => string | undefined;

  /** 缓存并持久化 URL；若覆盖旧 blob URL 则先释放 */
  set: (key: string, value: string) => void;

  /** 删除缓存 URL；若为 blob URL 则先释放 */
  delete: (key: string) => void;
}

export const useUrlCacheStore = create<UrlCacheState>()(
  persist(
    (set, storeGet) => ({
      urlMap: {},

      get: (key) => storeGet().urlMap[key],

      set: (key, value) => {
        set((state) => {
          const old = state.urlMap[key];
          if (old && old !== value && old.startsWith("blob:")) {
            revokeBlobUrl(old);
          }
          return { urlMap: { ...state.urlMap, [key]: value } };
        });
      },

      delete: (key) => {
        set((state) => {
          const old = state.urlMap[key];
          if (old?.startsWith("blob:")) {
            revokeBlobUrl(old);
          }
          const { [key]: _, ...rest } = state.urlMap;
          return { urlMap: rest };
        });
      },
    }),
    {
      name: storeKey.UrlCacheStore,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ urlMap: state.urlMap }),
    }
  )
);

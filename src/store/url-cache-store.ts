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

/** 远端播放 URL 的缓存时长：签名直链时效不一，仅作会话内加速，过期即重新解析 */
const URL_CACHE_TTL = 15 * 60 * 1000;

/** 本地/blob 资源不会失效，不参与 TTL */
const NON_EXPIRING_URL_PREFIXES = ["blob:", "capacitor:", "file:", "content:"];

interface UrlCacheEntry {
  url: string;
  cachedAt: number;
}

const isNonExpiringUrl = (url: string) =>
  NON_EXPIRING_URL_PREFIXES.some((p) => url.startsWith(p));

/** 兼容读取：旧版本持久化的是纯字符串条目 */
const entryUrl = (entry: UrlCacheEntry | string | undefined) =>
  typeof entry === "string" ? entry : entry?.url;

/**
 * 已解析音频 URL 的持久化缓存状态
 */
interface UrlCacheState {
  /** URL 映射表，key 格式为 `${source}:${id}:${quality}` */
  urlMap: Record<string, UrlCacheEntry>;

  /** 获取指定 key 的缓存 URL（超过 TTL 或旧格式条目视为过期并清除） */
  get: (key: string) => string | undefined;

  /** 缓存并持久化 URL；若覆盖旧 blob URL 则先释放 */
  set: (key: string, value: string) => void;

  /** 删除缓存 URL；若为 blob URL 则先释放 */
  delete: (key: string) => void;

  /** 清空所有缓存 URL；若包含 blob URL 则先释放 */
  clear: () => void;
}

export const useUrlCacheStore = create<UrlCacheState>()(
  persist(
    (set, storeGet) => ({
      urlMap: {},

      get: (key) => {
        const entry = storeGet().urlMap[key] as
          | UrlCacheEntry
          | string
          | undefined;
        if (!entry) return undefined;
        const url = entryUrl(entry);
        if (!url) return undefined;

        // 旧版本条目无时间戳视为过期；本地/blob 资源永不失效
        const expired =
          typeof entry === "string" ||
          (!isNonExpiringUrl(url) &&
            Date.now() - entry.cachedAt > URL_CACHE_TTL);
        if (!expired) return url;

        storeGet().delete(key);
        return undefined;
      },

      set: (key, value) => {
        set((state) => {
          const oldUrl = entryUrl(state.urlMap[key]);
          if (oldUrl && oldUrl !== value && oldUrl.startsWith("blob:")) {
            revokeBlobUrl(oldUrl);
          }
          return {
            urlMap: {
              ...state.urlMap,
              [key]: { url: value, cachedAt: Date.now() },
            },
          };
        });
      },

      delete: (key) => {
        set((state) => {
          const oldUrl = entryUrl(state.urlMap[key]);
          if (oldUrl?.startsWith("blob:")) {
            revokeBlobUrl(oldUrl);
          }
          const { [key]: _, ...rest } = state.urlMap;
          return { urlMap: rest };
        });
      },

      clear: () => {
        set((state) => {
          for (const entry of Object.values(state.urlMap)) {
            const url = entryUrl(entry);
            if (url?.startsWith("blob:")) revokeBlobUrl(url);
          }
          return { urlMap: {} };
        });
      },
    }),
    {
      name: storeKey.UrlCacheStore,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ urlMap: state.urlMap }),
      // blob URL 仅当前页面会话有效，重启后必失效；
      // 但 blob 条目被标记为永不过期，必须在恢复时清除避免一直命中死链
      onRehydrateStorage: () => () => purgeDeadBlobEntries(),
    }
  )
);

/** 清除持久化恢复回来的 blob 条目（跨会话已失效），供 rehydrate 与单测使用 */
export function purgeDeadBlobEntries() {
  const { urlMap, delete: del } = useUrlCacheStore.getState();
  for (const key of Object.keys(urlMap)) {
    if (entryUrl(urlMap[key])?.startsWith("blob:")) del(key);
  }
}

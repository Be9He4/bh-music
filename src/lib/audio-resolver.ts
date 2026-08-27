import { Capacitor } from "@capacitor/core";
import { musicApi } from "@/lib/music-api";
import { normalizeAudioUrlForPlayback } from "@/lib/utils/audio-url";
import { useDownloadStore } from "@/store/download-store";
import { useOfflineStore } from "@/store/offline-store";
import { useUrlCacheStore, buildUrlCacheKey } from "@/store/url-cache-store";
import { retry } from "@/lib/utils";
import { buildDownloadKey } from "@/lib/utils/download";
import type { MusicSource, MusicTrack } from "@/types/music";

/**
 * 获取远程音频 URL 并带有重试机制
 */
async function resolveRemoteAudioUrl(
  trackId: string,
  source: MusicSource,
  quality: number
): Promise<string> {
  const maxRetries = navigator.onLine ? 2 : 0;
  return retry(
    async () => {
      const url = await musicApi.getUrl(trackId, source, quality);
      if (!url) throw new Error("EMPTY_URL");
      return url;
    },
    maxRetries,
    800
  );
}

/**
 * 解析曲目的最佳播放 URL
 * 优先级：本地下载 → 内存缓存 → 离线缓存 → 远端请求
 *
 * 供 useAudioTrackLoader（主播放）和 useAudioPreloader（预加载）共享使用
 */
export async function resolveTrackUrl(
  track: MusicTrack,
  quality: number
): Promise<{ url: string; dlKey?: string }> {
  const { id: trackId, source, url_id: urlId } = track;
  const trackKey = buildUrlCacheKey(source, trackId, urlId, String(quality));

  // Native 本地下载资源
  if (Capacitor.isNativePlatform() && source !== "local") {
    const dlKey = buildDownloadKey(source, trackId);
    const uri = useDownloadStore.getState().getUri(dlKey);
    if (uri) return { url: Capacitor.convertFileSrc(uri), dlKey };
  }

  // 内存缓存
  const cacheStore = useUrlCacheStore.getState();
  const memCached = cacheStore.get(trackKey);
  if (memCached) {
    return { url: normalizeAudioUrlForPlayback(memCached) };
  }

  // 离线缓存（校验 trackSource 防止不同音源同 ID 命中旧缓存）
  const offlineRecord = useOfflineStore.getState().records?.[trackId];
  if (offlineRecord && offlineRecord.trackSource === source) {
    return { url: normalizeAudioUrlForPlayback(offlineRecord.url) };
  }

  // 离线无资源（本地/播客音源 URL 来自磁盘，无需联网，仍继续解析）
  if (!navigator.onLine && source !== "local" && source !== "podcast") {
    return { url: "" };
  }

  // 远端请求
  const queryId = source === "local" || source === "podcast" ? urlId : trackId;
  const remoteUrl = await resolveRemoteAudioUrl(queryId || "", source, quality);
  cacheStore.set(trackKey, remoteUrl);
  return { url: remoteUrl };
}

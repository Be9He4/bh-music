import { Capacitor } from "@capacitor/core";
import { musicApi } from "@/lib/music-api";
import { normalizeAudioUrlForPlayback } from "@/lib/utils/audio-url";
import { useDownloadStore } from "@/store/download-store";
import { useOfflineStore } from "@/store/offline-store";
import { useUrlCacheStore, buildUrlCacheKey } from "@/store/url-cache-store";
import { retry } from "@/lib/utils";
import { buildDownloadKey } from "@/lib/utils/download";
import type { MusicSource, MusicTrack } from "@/types/music";
import { IS_NATIVE } from "@/lib/api/config";

/**
 * 获取远程音频 URL 并带有重试机制
 */
async function resolveRemoteAudioUrl(
  trackId: string,
  source: MusicSource,
  quality: number,
  forceRefresh = false
): Promise<string> {
  const maxRetries = navigator.onLine ? 2 : 0;
  return retry(
    async () => {
      const url = await musicApi.getUrl(trackId, source, quality, {
        forceRefresh,
      });
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
 * @param options.forceRefresh 播放错误恢复时使用：绕过全部 URL 缓存重新请求，
 *        避免把已过期的签名直链原样返回导致二次失败
 */
export async function resolveTrackUrl(
  track: MusicTrack,
  quality: number,
  options?: { forceRefresh?: boolean }
): Promise<{ url: string; dlKey?: string }> {
  const { id: trackId, source, url_id: urlId } = track;
  const trackKey = buildUrlCacheKey(source, trackId, urlId, String(quality));
  const forceRefresh = options?.forceRefresh ?? false;

  // Native 本地下载资源
  if (IS_NATIVE && source !== "local") {
    const dlKey = buildDownloadKey(source, trackId);
    const uri = useDownloadStore.getState().getUri(dlKey);
    if (uri) return { url: Capacitor.convertFileSrc(uri), dlKey };
  }

  // 内存缓存
  const cacheStore = useUrlCacheStore.getState();
  if (forceRefresh) {
    cacheStore.delete(trackKey);
  } else {
    const memCached = cacheStore.get(trackKey);
    if (memCached) {
      return { url: normalizeAudioUrlForPlayback(memCached) };
    }
  }

  // 离线缓存（校验 trackSource 防止不同音源同 ID 命中旧缓存）
  // stream-cache 记录的是播放地址快照，恢复播放时可能已过期
  const offlineRecord = useOfflineStore.getState().records?.[trackId];
  if (
    offlineRecord &&
    offlineRecord.trackSource === source &&
    !(forceRefresh && offlineRecord.source === "stream-cache")
  ) {
    return { url: normalizeAudioUrlForPlayback(offlineRecord.url) };
  }

  // 离线无资源（本地/播客音源 URL 来自磁盘，无需联网，仍继续解析）
  if (!navigator.onLine && source !== "local" && source !== "podcast") {
    return { url: "" };
  }

  // 远端请求
  const queryId = source === "local" || source === "podcast" ? urlId : trackId;
  const remoteUrl = await resolveRemoteAudioUrl(
    queryId || "",
    source,
    quality,
    forceRefresh
  );
  cacheStore.set(trackKey, remoteUrl);
  // 强刷成功后回写 stream-cache 快照，否则下次播放仍会命中其中的过期 URL
  if (
    forceRefresh &&
    offlineRecord?.source === "stream-cache" &&
    offlineRecord.trackSource === source
  ) {
    useOfflineStore
      .getState()
      .addRecord({ ...offlineRecord, url: remoteUrl, cachedAt: Date.now() });
  }
  return { url: remoteUrl };
}

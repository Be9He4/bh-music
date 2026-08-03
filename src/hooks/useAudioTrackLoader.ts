import { useEffect, useRef } from "react";
import { retry } from "@/lib/utils";
import { musicApi } from "@/lib/music-api";
import { getProxyUrl, isProxyUrl } from "@/lib/api";
import { normalizeAudioUrlForPlayback } from "@/lib/utils/audio-url";
import { useMusicStore } from "@/store/music-store";
import { useSourceQualityStore } from "@/store/source-quality-store";
import { useDownloadStore } from "@/store/download-store";
import { useOfflineStore } from "@/store/offline-store";
import { useUrlCacheStore, buildUrlCacheKey } from "@/store/url-cache-store";
import { Capacitor } from "@capacitor/core";
import { buildDownloadKey } from "@/lib/utils/download";
import type { MusicSource } from "@/types/music";
import toast from "react-hot-toast";
import { handleAutoMatch } from "@/lib/audio-match";
import { logger } from "@/lib/logger";

const AUDIO_READY_TIMEOUT = 8000;
type FallbackStage = "none" | "proxy" | "final";

/** 校验歌曲在当前网络/缓存状态下是否可播 */
function isTrackPlayable(
  track: { source: MusicSource; id: string } | null
): boolean {
  if (!track) return false;
  if (track.source === "local" || navigator.onLine) return true;

  if (Capacitor.isNativePlatform()) {
    const downloadKey = buildDownloadKey(track.source, track.id);
    return useDownloadStore.getState().hasRecord(downloadKey);
  }

  return Boolean(useOfflineStore.getState().records?.[track.id]);
}

/** 查找队列中下一首可播歌曲 */
function findNextPlayableTrack(
  queue: { source: MusicSource; id: string }[],
  startIndex: number
): number | null {
  if (!queue.length) return null;
  for (let i = 0; i < queue.length; i++) {
    const index = (startIndex + i) % queue.length;
    if (isTrackPlayable(queue[index])) return index;
  }
  return null;
}

/** 将音频加载事件封装为 Promise */
function waitForAudioReady(
  audio: HTMLAudioElement,
  timeout = AUDIO_READY_TIMEOUT
): Promise<void> {
  return new Promise((resolve, reject) => {
    const cleanup = () => {
      audio.removeEventListener("canplay", onReady);
      audio.removeEventListener("loadedmetadata", onReady);
      audio.removeEventListener("error", onError);
      clearTimeout(timer);
    };

    const onReady = () => {
      cleanup();
      resolve();
    };
    const onError = () => {
      cleanup();
      reject(
        Object.assign(new Error("AUDIO_NOT_READY"), {
          mediaErrorCode: audio.error?.code ?? null,
        })
      );
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error("AUDIO_READY_TIMEOUT"));
    }, timeout);

    audio.addEventListener("canplay", onReady, { once: true });
    audio.addEventListener("loadedmetadata", onReady, { once: true });
    audio.addEventListener("error", onError, { once: true });
  });
}

/** 获取远程音频 URL 并带有重试机制 */
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

export function useAudioTrackLoader(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isSwitchingTrackRef: React.MutableRefObject<boolean>,
  hasRecordedRef: React.MutableRefObject<boolean>
) {
  const currentTrack = useMusicStore((s) => s.queue[s.currentIndex]) || null;
  const quality = useMusicStore((s) => s.quality);
  const hasUserGesture = useMusicStore((s) => s.hasUserGesture);
  const urlRecoveryKey = useMusicStore((s) => s.urlRecoveryKey);

  const requestIdRef = useRef(0);
  const remoteUrlRef = useRef<string | null>(null);
  const fallbackStageRef = useRef<{
    trackKey: string | null;
    stage: FallbackStage;
  }>({ trackKey: null, stage: "none" });
  const prevTrackRef = useRef<{
    id?: string;
    source?: string;
    quality?: string;
    recoveryKey?: number;
  }>({});

  useEffect(() => {
    if (
      !hasUserGesture ||
      !currentTrack?.id ||
      !currentTrack?.source ||
      !audioRef.current
    )
      return;

    const { id: trackId, source, url_id: urlId } = currentTrack;
    const getState = useMusicStore.getState;
    const requestId = ++requestIdRef.current;
    const trackKey = buildUrlCacheKey(source, trackId, urlId, quality);

    const loadAudio = async () => {
      const audio = audioRef.current!;
      const prev = prevTrackRef.current;

      const isRecovery = prev.recoveryKey !== urlRecoveryKey;
      const isSameTrack = prev.id === trackId && prev.source === source;
      const qualityChanged = isSameTrack && prev.quality !== quality;
      const skipQualityReload =
        qualityChanged && ["local", "bilibili", "podcast"].includes(source);

      // 无需重新加载的场景
      if (
        isSameTrack &&
        (!qualityChanged || skipQualityReload) &&
        !isSwitchingTrackRef.current &&
        !isRecovery
      )
        return;

      // 状态初始化与缓存清理
      if (
        isRecovery ||
        (qualityChanged && !skipQualityReload) ||
        fallbackStageRef.current.trackKey !== trackKey
      ) {
        remoteUrlRef.current = null;
        fallbackStageRef.current = { trackKey, stage: "none" };
      }

      isSwitchingTrackRef.current = true;
      hasRecordedRef.current = false;
      getState().setIsLoading(true);

      const resumeTime = qualityChanged
        ? audio.currentTime
        : getState().currentAudioTime;
      if (!qualityChanged) audio.pause();

      /** 核心播放器加载逻辑 */
      const play = async (audioUrl: string) => {
        if (audio.src !== audioUrl) {
          getState().setCurrentAudioUrl(audioUrl);
          // 先清空再赋值，强制 WebView 释放旧缓冲、重置 media element 状态
          audio.src = "";
          audio.src = audioUrl;
          audio.load();
        }
        await waitForAudioReady(audio);
        audio.currentTime = resumeTime;
        audio.playbackRate = getState().playbackSpeed;
        await audio.play();
      };

      /** 解析获取最佳 URL (本地 -> 内存缓存 -> 离线库 -> 网络) */
      const resolveOptimalUrl = async () => {
        // 本地下载资源
        if (Capacitor.isNativePlatform() && source !== "local") {
          const dlKey = buildDownloadKey(source, trackId);
          const uri = useDownloadStore.getState().getUri(dlKey);
          if (uri) return { url: Capacitor.convertFileSrc(uri), dlKey };
        }

        if (remoteUrlRef.current) return { url: remoteUrlRef.current };

        // 缓存资源
        const cacheStore = useUrlCacheStore.getState();
        const memCached = cacheStore.get(trackKey);
        if (memCached)
          return {
            url: (remoteUrlRef.current =
              normalizeAudioUrlForPlayback(memCached)),
          };

        // 校验 trackSource 防止 _netease 与 GD netease 同 ID 时命中旧缓存（如 30s 试听片段）
        const offlineRecord = useOfflineStore.getState().records?.[trackId];
        if (offlineRecord && offlineRecord.trackSource === source) {
          return {
            url: (remoteUrlRef.current = normalizeAudioUrlForPlayback(
              offlineRecord.url
            )),
          };
        }

        if (!navigator.onLine) return { url: "" };

        // 远端资源
        const queryId =
          source === "local" || source === "podcast" ? urlId : trackId;
        const remoteUrl = await resolveRemoteAudioUrl(
          queryId || "",
          source,
          parseInt(quality, 10)
        );
        cacheStore.set(trackKey, remoteUrl);
        return { url: (remoteUrlRef.current = remoteUrl) };
      };

      try {
        const { url: primaryUrl, dlKey } = await resolveOptimalUrl();

        // 离线无资源容灾跳过
        if (!primaryUrl && !navigator.onLine && source !== "local") {
          const state = getState();
          const nextIdx = findNextPlayableTrack(
            state.queue,
            state.currentIndex
          );
          if (nextIdx !== null && nextIdx !== state.currentIndex) {
            state.setCurrentIndexAndPlay(nextIdx);
          } else {
            logger.error(
              "useAudioTrackLoader",
              "Network unavailable, no playable tracks",
              { trackId, source }
            );
            state.setIsPlaying(false);
          }
          return;
        }

        try {
          await play(primaryUrl);
        } catch (err) {
          if (err instanceof DOMException && err.name === "NotAllowedError")
            throw err;

          // 本地文件失效退化为网络
          if (
            dlKey &&
            primaryUrl !== remoteUrlRef.current &&
            remoteUrlRef.current
          ) {
            useDownloadStore.getState().removeRecord(dlKey);
            toast.error("播放失败，已切换在线播放");
            await play(remoteUrlRef.current);
            return;
          }

          // 代理备用线路容灾
          if (
            getState().enableProxyFallback &&
            source !== "local" &&
            fallbackStageRef.current.stage === "none" &&
            remoteUrlRef.current &&
            navigator.onLine
          ) {
            fallbackStageRef.current.stage = "proxy";
            toast("已切换备用线路", { icon: "🌐", id: "proxy-notice" });
            const proxyUrl = isProxyUrl(remoteUrlRef.current)
              ? remoteUrlRef.current
              : getProxyUrl(remoteUrlRef.current);
            await play(proxyUrl);
            return;
          }

          throw err;
        }
      } catch (err: unknown) {
        if (requestId !== requestIdRef.current) return;

        const errorMsg = err instanceof Error ? err.message : String(err);
        logger.error(
          "useAudioTrackLoader",
          `Audio load failed: ${errorMsg}`,
          err,
          { trackId, source, urlId }
        );

        // 自动匹配容灾
        if (getState().enableAutoMatch) {
          try {
            if (await handleAutoMatch(currentTrack)) return;
          } catch {
            logger.warn("useAudioTrackLoader", "Auto match failed", {
              trackId,
              source,
            });
          }
        }

        useSourceQualityStore.getState().recordFail(source);

        // 离线时清理过期信息
        if (!navigator.onLine) {
          useOfflineStore.getState().removeRecord(trackId);
          useUrlCacheStore.getState().delete(trackKey);
        }

        fallbackStageRef.current.stage = "final";
        audio.src = "";
        getState().setCurrentAudioUrl(null);
        toast.error("播放失败，已自动切到下一首");

        const state = getState();
        if (state.incrementFailures() >= state.maxConsecutiveFailures) {
          if (audio.paused) getState().setIsPlaying(false);
          else
            logger.warn(
              "useAudioTrackLoader",
              "Skip setIsPlaying(false) because audio is still playing"
            );
        } else {
          getState().skipToNext();
        }
      } finally {
        if (requestId === requestIdRef.current) {
          isSwitchingTrackRef.current = false;
          getState().setIsLoading(false);
        }
      }
    };

    loadAudio();
    prevTrackRef.current = {
      id: trackId,
      source,
      quality,
      recoveryKey: urlRecoveryKey,
    };

    return () => {
      if (requestId === requestIdRef.current) requestIdRef.current++;
    };
  }, [
    currentTrack?.id,
    currentTrack?.source,
    currentTrack?.url_id,
    quality,
    hasUserGesture,
    urlRecoveryKey,
  ]);
}

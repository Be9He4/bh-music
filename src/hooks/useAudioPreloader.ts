import { useEffect, useRef } from "react";
import { useMusicStore } from "@/store/music-store";
import { resolveTrackUrl } from "@/lib/audio-resolver";
import { logger } from "@/lib/logger";

/** 预加载触发阈值：剩余秒数 */
const PRELOAD_THRESHOLD_SECONDS = 10;

/** 预加载节流间隔（毫秒） */
const PRELOAD_THROTTLE_MS = 1000;

/**
 * 音频预加载 hook
 * 监听 timeupdate 事件，在当前歌曲快结束时预加载下一首的 URL 并预热 SW 缓存
 */
export function useAudioPreloader(
  audioRef: React.RefObject<HTMLAudioElement | null>
) {
  const requestIdRef = useRef(0);
  const lastCheckTimeRef = useRef(0);
  const preloadedKeyRef = useRef<string | null>(null);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const handleTimeUpdate = () => {
      // 节流检查
      const now = Date.now();
      if (now - lastCheckTimeRef.current < PRELOAD_THROTTLE_MS) return;
      lastCheckTimeRef.current = now;

      const state = useMusicStore.getState();
      const { isPlaying, isRepeat, queue, currentIndex, quality } = state;

      // 前置条件检查
      if (!isPlaying) return;
      if (!navigator.onLine) return;
      if (!queue.length) return;
      if (queue.length <= 1 && !isRepeat) return;

      const duration = audio.duration || 0;
      const currentTime = audio.currentTime || 0;
      const remaining = duration - currentTime;

      // 时间阈值检查
      if (duration <= 30 || remaining > PRELOAD_THRESHOLD_SECONDS) return;

      // 计算下一首索引
      const nextIndex = (currentIndex + 1) % queue.length;
      const nextTrack = queue[nextIndex];
      if (!nextTrack) return;

      // 本地音源无需预加载
      if (nextTrack.source === "local") return;

      // 防止重复预加载同一首歌
      const preloadKey = `${nextTrack.source}:${nextTrack.id}:${quality}`;
      if (preloadedKeyRef.current === preloadKey) return;

      // 递增 requestId 取消之前的预加载
      const requestId = ++requestIdRef.current;

      // 异步预加载
      void (async () => {
        try {
          const qualityNum = parseInt(quality, 10) || 192;
          const { url } = await resolveTrackUrl(nextTrack, qualityNum);

          // 检查是否被取消
          if (requestId !== requestIdRef.current) return;

          if (!url) return;

          // QQ 会话绑定且无法在浏览器侧带鉴权：仅解析 URL（写入内存缓存
          // 供切歌快速起播），不执行 no-cors 预热，避免坏响应写进 SW
          // 缓存、复用旧 vkey 导致切歌换源
          if (nextTrack.source !== "qq") {
            // 预热 SW 缓存（no-cors 避免跨域问题）
            await fetch(url, { mode: "no-cors" });
          }

          // 标记已预加载
          preloadedKeyRef.current = preloadKey;

          logger.info("useAudioPreloader", "Preload success", {
            trackId: nextTrack.id,
            source: nextTrack.source,
          });
        } catch (err) {
          // 静默失败，不影响主播放流程
          if (requestId === requestIdRef.current) {
            logger.warn("useAudioPreloader", "Preload failed", {
              trackId: nextTrack.id,
              source: nextTrack.source,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        }
      })();
    };

    audio.addEventListener("timeupdate", handleTimeUpdate);
    return () => {
      audio.removeEventListener("timeupdate", handleTimeUpdate);
    };
  }, [audioRef]);

  // 队列变更时重置预加载状态
  useEffect(() => {
    const unsubscribe = useMusicStore.subscribe((state, prevState) => {
      if (
        state.queue !== prevState.queue ||
        state.currentIndex !== prevState.currentIndex
      ) {
        preloadedKeyRef.current = null;
        requestIdRef.current++;
      }
    });
    return unsubscribe;
  }, []);
}

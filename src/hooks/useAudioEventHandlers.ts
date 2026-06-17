import { useEffect, useRef } from "react";
import { throttle } from "@/lib/utils";
import { useMusicStore } from "@/store/music-store";
import { useSourceQualityStore } from "@/store/source-quality-store";
import { useHistoryStore } from "@/store/history-store";
import { useOfflineStore } from "@/store/offline-store";
import { MediaSession } from "@jofr/capacitor-media-session";
import toast from "react-hot-toast";
import { handleAutoMatch } from "@/lib/audio-match";
import { logger } from "@/lib/logger";
import { extractOriginalAudioUrl } from "@/lib/utils/audio-url";

// 曲目切换触发的短暂 pause 事件不应将状态置为暂停，
// 需延迟 200ms 确认 pause 是稳定状态后再更新 isPlaying
const PAUSE_CONFIRM_DELAY_MS = 200;

export function useAudioEventHandlers(
  audioRef: React.RefObject<HTMLAudioElement | null>,
  isSwitchingTrackRef: React.MutableRefObject<boolean>,
  hasRecordedRef: React.MutableRefObject<boolean>
) {
  const autoMatchRef = useRef({ index: -1, count: 0 });
  const MAX_AUTO_MATCH_PER_TRACK = 3;
  const recoveryAttemptedRef = useRef(false);
  const pauseConfirmTimerRef = useRef<ReturnType<typeof setTimeout> | null>(
    null
  );
  const pauseConfirmTokenRef = useRef(0);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const loadingToastId = "audio-loading";

    const settleLoading = () => {
      const state = useMusicStore.getState();
      if (state.isLoading) state.setIsLoading(false);
      toast.dismiss(loadingToastId);
    };

    const markLoading = () => {
      const state = useMusicStore.getState();
      if (!state.isLoading) state.setIsLoading(true);
    };

    const syncPositionState = (playbackRate: number) => {
      const rate = playbackRate || audio.playbackRate || 1;
      const dur = audio.duration;
      const safeDuration = isFinite(dur) && dur > 0 ? dur : 0;
      MediaSession.setPositionState({
        duration: safeDuration,
        playbackRate: rate,
        position: audio.currentTime,
      }).catch(console.error);
    };

    const cancelPendingPauseConfirm = () => {
      pauseConfirmTokenRef.current += 1;
      if (pauseConfirmTimerRef.current) {
        clearTimeout(pauseConfirmTimerRef.current);
        pauseConfirmTimerRef.current = null;
      }
    };

    const onTimeUpdate = throttle(() => {
      if (isSwitchingTrackRef.current) return;
      if (!audio.paused) cancelPendingPauseConfirm();

      const state = useMusicStore.getState();
      state.setAudioCurrentTime(audio.currentTime);
      if (!audio.paused && !state.isPlaying) {
        state.setIsPlaying(true);
      }

      syncPositionState(audio.paused ? 0 : audio.playbackRate);
    }, 1000);

    const onDurationChange = () => {
      const state = useMusicStore.getState();
      const track = state.queue[state.currentIndex];
      const duration = audio.duration || 0;

      state.setDuration(duration);

      if (
        track?.source === "_netease" &&
        duration >= 30 &&
        duration <= 45 &&
        state.enableAutoMatch
      ) {
        const am = autoMatchRef.current;
        if (am.index !== state.currentIndex) {
          autoMatchRef.current = { index: state.currentIndex, count: 1 };
          void handleAutoMatch(track);
        } else if (am.count < MAX_AUTO_MATCH_PER_TRACK) {
          am.count++;
          void handleAutoMatch(track);
        }
      }
    };

    const onEnded = () => {
      const state = useMusicStore.getState();
      syncPositionState(0);

      if (state.isRepeat) {
        audio.currentTime = 0;
        audio.play().catch(() => {
          useMusicStore.getState().setIsPlaying(false);
        });
      } else if (state.queue.length) {
        state.setCurrentIndexAndPlay(
          (state.currentIndex + 1) % state.queue.length
        );
      }
    };

    const onPause = () => {
      syncPositionState(0);
      if (isSwitchingTrackRef.current || audio.ended || audio.error) return;

      cancelPendingPauseConfirm();
      const token = pauseConfirmTokenRef.current;
      pauseConfirmTimerRef.current = setTimeout(() => {
        if (token !== pauseConfirmTokenRef.current) return;
        pauseConfirmTimerRef.current = null;

        if (
          isSwitchingTrackRef.current ||
          audio.ended ||
          audio.error ||
          !audio.paused
        )
          return;

        const state = useMusicStore.getState();
        if (state.isPlaying) state.setIsPlaying(false);
      }, PAUSE_CONFIRM_DELAY_MS);
    };

    const onPlay = () => {
      cancelPendingPauseConfirm();
      settleLoading();
      if (audio.paused) return;

      recoveryAttemptedRef.current = false;

      const state = useMusicStore.getState();
      const track = state.queue[state.currentIndex];

      if (!state.isPlaying) state.setIsPlaying(true);
      state.resetFailures();

      if (hasRecordedRef.current) return;
      hasRecordedRef.current = true;

      if (track) {
        useSourceQualityStore.getState().recordSuccess(track.source);
        useHistoryStore.getState().addToHistory(track);

        // 对远程曲目记录流媒体缓存
        if (track.source !== "local") {
          const cachedUrl = audio.src;
          if (
            cachedUrl &&
            !cachedUrl.startsWith("blob:") &&
            !cachedUrl.startsWith("capacitor:")
          ) {
            // 存原始 URL，避免把带死域名的代理 URL 写进数据库
            const originalUrl = extractOriginalAudioUrl(cachedUrl);

            useOfflineStore.getState().addRecord({
              trackId: track.id,
              source: "stream-cache",
              url: originalUrl,
              cachedAt: Date.now(),
              name: track.name,
              artist: track.artist,
              album: track.album,
              trackSource: track.source,
              url_id: track.url_id,
              pic_id: track.pic_id,
              lyric_id: track.lyric_id,
            });
          }
        }
      }
    };

    const events: Record<string, EventListener> = {
      timeupdate: onTimeUpdate,
      durationchange: onDurationChange,
      ended: onEnded,
      pause: onPause,
      play: onPlay,
      error: () => {
        cancelPendingPauseConfirm();
        const state = useMusicStore.getState();

        if (!recoveryAttemptedRef.current && state.queue.length > 0) {
          recoveryAttemptedRef.current = true;
          logger.warn(
            "useAudioEventHandlers",
            "Audio error, attempting URL recovery"
          );
          state.incrementUrlRecoveryKey();
          return;
        }

        logger.error("useAudioEventHandlers", "Audio error");
        state.setIsPlaying(false);
        syncPositionState(0);
      },
      loadstart: markLoading,
      waiting: markLoading,
      canplay: settleLoading,
      playing: () => {
        cancelPendingPauseConfirm();
        settleLoading();
      },
      loadedmetadata: settleLoading,
    };

    Object.entries(events).forEach(([event, handler]) =>
      audio.addEventListener(event, handler)
    );

    return () => {
      cancelPendingPauseConfirm();
      Object.entries(events).forEach(([event, handler]) =>
        audio.removeEventListener(event, handler)
      );
    };
  }, [audioRef, isSwitchingTrackRef, hasRecordedRef]);

  return null;
}

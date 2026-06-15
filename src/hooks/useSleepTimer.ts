import { useEffect, useRef, useCallback } from "react";
import { useMusicStore } from "@/store/music-store";
import { formatTime } from "@/lib/utils/time";

const FADE_OUT_DURATION = 10;
const FADE_OUT_STEPS = 20;
const TICK_INTERVAL = 1000;

/**
 * 睡眠定时器 Hook
 *
 * 管理倒计时逻辑、播放联动、音量淡出和取消操作。
 * 使用 audio.volume 渐变实现淡出，避免 Web Audio API 的
 * createMediaElementSource 重复绑定问题。
 */
export function useSleepTimer(
  audioRef: React.RefObject<HTMLAudioElement | null>
) {
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const setIsPlaying = useMusicStore((s) => s.setIsPlaying);
  const volume = useMusicStore((s) => s.volume);
  const sleepTimerDuration = useMusicStore((s) => s.sleepTimerDuration);
  const sleepTimerRemaining = useMusicStore((s) => s.sleepTimerRemaining);
  const sleepTimerIsActive = useMusicStore((s) => s.sleepTimerIsActive);
  const sleepTimerEndTime = useMusicStore((s) => s.sleepTimerEndTime);
  const setSleepTimerRemaining = useMusicStore((s) => s.setSleepTimerRemaining);
  const setSleepTimerIsActive = useMusicStore((s) => s.setSleepTimerIsActive);
  const setSleepTimerEndTime = useMusicStore((s) => s.setSleepTimerEndTime);
  const setSleepTimerDuration = useMusicStore((s) => s.setSleepTimerDuration);

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const originalVolumeRef = useRef<number>(1);
  const isFadingRef = useRef<boolean>(false);
  const isPlayingRef = useRef<boolean>(isPlaying);
  const sleepTimerEndTimeRef = useRef<number>(sleepTimerEndTime);
  const sleepTimerRemainingRef = useRef<number>(sleepTimerRemaining);

  const clearFadeInterval = useCallback(() => {
    if (fadeIntervalRef.current) {
      clearInterval(fadeIntervalRef.current);
      fadeIntervalRef.current = null;
    }
  }, []);

  const fadeOutAndStop = useCallback(() => {
    if (isFadingRef.current) return;
    isFadingRef.current = true;

    const audio = audioRef.current;
    if (!audio) {
      setIsPlaying(false);
      setSleepTimerIsActive(false);
      isFadingRef.current = false;
      return;
    }

    originalVolumeRef.current = volume;
    const startVolume = audio.volume;
    const stepDuration = (FADE_OUT_DURATION * 1000) / FADE_OUT_STEPS;
    let step = 0;

    clearFadeInterval();
    fadeIntervalRef.current = setInterval(() => {
      step++;
      if (step >= FADE_OUT_STEPS) {
        clearFadeInterval();
        audio.volume = 0;
        setIsPlaying(false);
        setSleepTimerIsActive(false);
        isFadingRef.current = false;
        audio.volume = originalVolumeRef.current;
      } else {
        audio.volume = startVolume * (1 - step / FADE_OUT_STEPS);
      }
    }, stepDuration);
  }, [
    audioRef,
    volume,
    setIsPlaying,
    setSleepTimerIsActive,
    clearFadeInterval,
  ]);

  const cancelTimer = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    clearFadeInterval();
    isFadingRef.current = false;
    setSleepTimerIsActive(false);
    setSleepTimerRemaining(0);
    setSleepTimerEndTime(0);

    const audio = audioRef.current;
    if (audio) {
      audio.volume = originalVolumeRef.current;
    }
  }, [
    setSleepTimerIsActive,
    setSleepTimerRemaining,
    setSleepTimerEndTime,
    audioRef,
    clearFadeInterval,
  ]);

  const startTimer = useCallback(
    (durationMinutes: number) => {
      cancelTimer();

      const durationSeconds = durationMinutes * 60;
      const endTime = Date.now() + durationSeconds * 1000;

      setSleepTimerDuration(durationMinutes);
      setSleepTimerRemaining(durationSeconds);
      setSleepTimerIsActive(true);
      setSleepTimerEndTime(endTime);

      originalVolumeRef.current = volume;
    },
    [
      cancelTimer,
      setSleepTimerIsActive,
      setSleepTimerRemaining,
      setSleepTimerEndTime,
      setSleepTimerDuration,
      volume,
    ]
  );

  useEffect(() => {
    if (!sleepTimerIsActive) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      const now = Date.now();
      const remaining = Math.ceil((sleepTimerEndTimeRef.current - now) / 1000);

      if (remaining <= 0) {
        setSleepTimerRemaining(0);
        // 如果已在淡出中，让 fade interval 自己完成收尾
        if (!isFadingRef.current) {
          if (isPlayingRef.current) {
            fadeOutAndStop();
          } else {
            setSleepTimerIsActive(false);
            setSleepTimerEndTime(0);
          }
        }
      } else {
        setSleepTimerRemaining(remaining);
        // 提前渐变：剩余10秒内且正在播放，立即开始淡出
        if (
          remaining <= FADE_OUT_DURATION &&
          isPlayingRef.current &&
          !isFadingRef.current
        ) {
          fadeOutAndStop();
        }
      }
    }, TICK_INTERVAL);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [
    sleepTimerIsActive,
    setSleepTimerRemaining,
    setSleepTimerEndTime,
    setSleepTimerIsActive,
    fadeOutAndStop,
  ]);

  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    return () => {
      clearFadeInterval();
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [clearFadeInterval]);

  useEffect(() => {
    sleepTimerEndTimeRef.current = sleepTimerEndTime;
  }, [sleepTimerEndTime]);

  useEffect(() => {
    sleepTimerRemainingRef.current = sleepTimerRemaining;
  }, [sleepTimerRemaining]);

  return {
    isActive: sleepTimerIsActive,
    remaining: sleepTimerRemaining,
    duration: sleepTimerDuration,
    formattedRemaining: formatTime(sleepTimerRemaining),
    startTimer,
    cancelTimer,
  };
}

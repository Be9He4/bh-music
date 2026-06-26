import { useEffect, useRef, useCallback } from "react";
import { useMusicStore } from "@/store/music-store";
import { formatTime } from "@/lib/utils/time";

const FADE_OUT_DURATION = 10;
const FADE_OUT_STEPS = 20;
const TICK_INTERVAL = 1000;

export function useSleepTimer(
  audioRef: React.RefObject<HTMLAudioElement | null>
) {
  // 1. 状态获取
  const isPlaying = useMusicStore((s) => s.isPlaying);
  const volume = useMusicStore((s) => s.volume);
  const sleepTimerDuration = useMusicStore((s) => s.sleepTimerDuration);
  const sleepTimerRemaining = useMusicStore((s) => s.sleepTimerRemaining);
  const sleepTimerIsActive = useMusicStore((s) => s.sleepTimerIsActive);
  const sleepTimerEndTime = useMusicStore((s) => s.sleepTimerEndTime);

  const setIsPlaying = useMusicStore((s) => s.setIsPlaying);
  const setSleepTimerRemaining = useMusicStore((s) => s.setSleepTimerRemaining);
  const setSleepTimerIsActive = useMusicStore((s) => s.setSleepTimerIsActive);
  const setSleepTimerEndTime = useMusicStore((s) => s.setSleepTimerEndTime);
  const setSleepTimerDuration = useMusicStore((s) => s.setSleepTimerDuration);

  // 2. Refs 管理
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const fadeRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isFadingRef = useRef(false);

  // 核心优化：用一个 ref 实时同步最新状态，免去所有同步用的 useEffect
  const stateRef = useRef({ volume, isPlaying, sleepTimerEndTime });
  stateRef.current = { volume, isPlaying, sleepTimerEndTime };

  const clearFade = useCallback(() => {
    if (fadeRef.current) clearInterval(fadeRef.current);
  }, []);

  // 3. 淡出并停止
  const fadeOutAndStop = useCallback(() => {
    const audio = audioRef.current;
    if (isFadingRef.current || !audio) return;

    isFadingRef.current = true;
    const startVolume = audio.volume;
    let step = 0;

    clearFade();
    fadeRef.current = setInterval(
      () => {
        step++;
        const progress = step / FADE_OUT_STEPS;

        if (progress >= 1) {
          clearFade();
          // 核心修复：明确降到 0 -> 同步暂停 -> 恢复系统音量
          audio.volume = 0;
          audio.pause();
          audio.volume = stateRef.current.volume;

          setIsPlaying(false);
          setSleepTimerIsActive(false);
          isFadingRef.current = false;
        } else {
          // 动态适配用户中途修改全局音量
          const currentGlobalVol = stateRef.current.volume;
          audio.volume = Math.max(
            0,
            Math.min(startVolume, currentGlobalVol) * (1 - progress)
          );
        }
      },
      (FADE_OUT_DURATION * 1000) / FADE_OUT_STEPS
    );
  }, [audioRef, clearFade, setIsPlaying, setSleepTimerIsActive]);

  // 4. 取消定时
  const cancelTimer = useCallback(() => {
    if (timerRef.current) clearInterval(timerRef.current);
    clearFade();
    isFadingRef.current = false;

    setSleepTimerIsActive(false);
    setSleepTimerRemaining(0);
    setSleepTimerEndTime(0);

    if (audioRef.current) audioRef.current.volume = stateRef.current.volume;
  }, [
    audioRef,
    clearFade,
    setSleepTimerIsActive,
    setSleepTimerRemaining,
    setSleepTimerEndTime,
  ]);

  // 5. 启动定时
  const startTimer = useCallback(
    (minutes: number) => {
      cancelTimer();
      const durationSeconds = minutes * 60;

      setSleepTimerDuration(minutes);
      setSleepTimerRemaining(durationSeconds);
      setSleepTimerEndTime(Date.now() + durationSeconds * 1000);
      setSleepTimerIsActive(true);
    },
    [
      cancelTimer,
      setSleepTimerDuration,
      setSleepTimerRemaining,
      setSleepTimerEndTime,
      setSleepTimerIsActive,
    ]
  );

  // 6. 倒计时心跳
  useEffect(() => {
    if (!sleepTimerIsActive) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      const { isPlaying, sleepTimerEndTime } = stateRef.current;
      const remaining = Math.max(
        0,
        Math.ceil((sleepTimerEndTime - Date.now()) / 1000)
      );

      setSleepTimerRemaining(remaining);

      if (remaining <= 0) {
        if (!isFadingRef.current) {
          isPlaying ? fadeOutAndStop() : setSleepTimerIsActive(false);
        }
      } else if (
        remaining <= FADE_OUT_DURATION &&
        isPlaying &&
        !isFadingRef.current
      ) {
        fadeOutAndStop();
      }
    }, TICK_INTERVAL);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [
    sleepTimerIsActive,
    fadeOutAndStop,
    setSleepTimerRemaining,
    setSleepTimerIsActive,
  ]);

  // 7. 卸载清理
  useEffect(() => {
    return () => {
      clearFade();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [clearFade]);

  return {
    isActive: sleepTimerIsActive,
    remaining: sleepTimerRemaining,
    duration: sleepTimerDuration,
    formattedRemaining: formatTime(sleepTimerRemaining),
    startTimer,
    cancelTimer,
  };
}

"use client";

import { useState } from "react";
import { Slider } from "@/components/ui/slider";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { useMusicStore } from "@/store/music-store";
import { formatTime } from "@/lib/utils/time";

interface SleepTimerDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function SleepTimerDrawer({
  open,
  onOpenChange,
}: SleepTimerDrawerProps) {
  const duration = useMusicStore((s) => s.sleepTimerDuration);
  const setDuration = useMusicStore((s) => s.setSleepTimerDuration);
  const isActive = useMusicStore((s) => s.sleepTimerIsActive);
  const remaining = useMusicStore((s) => s.sleepTimerRemaining);
  const stopAfterCurrentTrack = useMusicStore(
    (s) => s.sleepTimerStopAfterCurrentTrack
  );
  const setSleepTimerRemaining = useMusicStore((s) => s.setSleepTimerRemaining);
  const setSleepTimerIsActive = useMusicStore((s) => s.setSleepTimerIsActive);
  const setStopAfterCurrentTrack = useMusicStore(
    (s) => s.setSleepTimerStopAfterCurrentTrack
  );
  const setSleepTimerEndTime = useMusicStore((s) => s.setSleepTimerEndTime);

  const [localDuration, setLocalDuration] = useState(duration);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setLocalDuration(duration);
    }
    onOpenChange(nextOpen);
  };

  const handleSliderChange = ([value]: number[]) => {
    const clamped = Math.max(1, Math.min(120, value));
    setLocalDuration(clamped);
  };

  const handleStart = () => {
    const durationSeconds = localDuration * 60;
    setDuration(localDuration);
    setStopAfterCurrentTrack(false);
    setSleepTimerRemaining(durationSeconds);
    setSleepTimerEndTime(Date.now() + durationSeconds * 1000);
    setSleepTimerIsActive(true);
    onOpenChange(false);
  };

  const handleCancel = () => {
    setStopAfterCurrentTrack(false);
    setSleepTimerIsActive(false);
    setSleepTimerRemaining(0);
    setSleepTimerEndTime(0);
  };

  const handleStopAfterCurrentTrack = () => {
    setStopAfterCurrentTrack(true);
    setSleepTimerIsActive(true);
    setSleepTimerRemaining(0);
    setSleepTimerEndTime(0);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={handleOpenChange}>
      <DrawerContent
        className="outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <DrawerHeader className="px-5 pt-6 pb-2">
          <DrawerTitle className="text-lg font-semibold text-center">
            睡眠定时
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-5 py-4 space-y-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground">时长</span>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={120}
                value={localDuration}
                onChange={(e) => {
                  const val = parseInt(e.target.value, 10);
                  if (!isNaN(val)) {
                    setLocalDuration(Math.max(1, Math.min(120, val)));
                  }
                }}
                className="w-16 h-8 text-center text-sm bg-background border border-border rounded-md focus:outline-none focus:ring-1 focus:ring-primary"
              />
              <span className="text-sm text-muted-foreground">分钟</span>
            </div>
          </div>

          <Slider
            value={[localDuration]}
            onValueChange={handleSliderChange}
            min={1}
            max={120}
            step={1}
            className="w-full"
          />
          <div className="flex items-center justify-between text-xs text-muted-foreground">
            <span>1分钟</span>
            <span>120分钟</span>
          </div>
        </div>

        <DrawerFooter className="px-5 pb-8 pt-2">
          {isActive ? (
            <Button
              variant="destructive"
              className="w-full"
              onClick={handleCancel}
            >
              取消定时
              {!stopAfterCurrentTrack && `（剩余 ${formatTime(remaining)}）`}
            </Button>
          ) : (
            <>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleStopAfterCurrentTrack}
              >
                播完当前歌曲
              </Button>
              <Button className="w-full" onClick={handleStart}>
                开启定时关闭
              </Button>
            </>
          )}
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

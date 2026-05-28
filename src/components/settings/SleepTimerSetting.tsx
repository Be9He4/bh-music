import { useState } from "react";
import { Moon } from "lucide-react";
import { SettingItem } from "./SettingItem";
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

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
}

/**
 * 睡眠定时器设置组件
 *
 * 直接从 store 读取定时器状态，通过 store action 触发启停，
 * useSleepTimer hook 会自动响应 store 变化执行倒计时逻辑。
 */
export function SleepTimerSetting() {
  const duration = useMusicStore((s) => s.sleepTimerDuration);
  const setDuration = useMusicStore((s) => s.setSleepTimerDuration);
  const isActive = useMusicStore((s) => s.sleepTimerIsActive);
  const remaining = useMusicStore((s) => s.sleepTimerRemaining);
  const setSleepTimerRemaining = useMusicStore((s) => s.setSleepTimerRemaining);
  const setSleepTimerIsActive = useMusicStore((s) => s.setSleepTimerIsActive);
  const setSleepTimerEndTime = useMusicStore((s) => s.setSleepTimerEndTime);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [localDuration, setLocalDuration] = useState(duration);

  const handleOpenDrawer = () => {
    setLocalDuration(duration);
    setIsDrawerOpen(true);
  };

  const handleSliderChange = ([value]: number[]) => {
    const clamped = Math.max(1, Math.min(120, value));
    setLocalDuration(clamped);
  };

  const handleStart = () => {
    const durationSeconds = localDuration * 60;
    setDuration(localDuration);
    setSleepTimerRemaining(durationSeconds);
    setSleepTimerEndTime(Date.now() + durationSeconds * 1000);
    setSleepTimerIsActive(true);
    setIsDrawerOpen(false);
  };

  const handleCancel = () => {
    setSleepTimerIsActive(false);
    setSleepTimerRemaining(0);
    setSleepTimerEndTime(0);
  };

  const subtitle = isActive
    ? `剩余 ${formatTime(remaining)}`
    : `定时 ${duration} 分钟后停止播放`;

  return (
    <>
      <SettingItem
        icon={Moon}
        title="睡眠定时"
        subtitle={subtitle}
        showChevron
        onClick={handleOpenDrawer}
        action={
          isActive ? (
            <Button
              variant="destructive"
              size="sm"
              className="h-7 px-2 text-xs"
              onClick={(e) => {
                e.stopPropagation();
                handleCancel();
              }}
            >
              取消
            </Button>
          ) : null
        }
      />

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent
          className="outline-none"
          onClick={(e) => e.stopPropagation()}
        >
          <DrawerHeader className="px-5 pt-6 pb-2">
            <DrawerTitle className="text-lg font-semibold text-center">
              睡眠定时
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-5 py-4 space-y-6">
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
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>1分钟</span>
              <span>120分钟</span>
            </div>
          </div>

          <DrawerFooter className="px-5 pb-8 pt-2">
            <Button
              className="w-full"
              onClick={handleStart}
              disabled={isActive}
            >
              {isActive ? "定时器运行中" : "开启定时关闭"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

import { useState } from "react";
import { ClockFading } from "lucide-react";
import { SettingItem } from "./SettingItem";
import { Button } from "@/components/ui/button";
import { SleepTimerDrawer } from "./SleepTimerDrawer";
import { useMusicStore } from "@/store/music-store";
import { formatTime } from "@/lib/utils/time";

/**
 * 睡眠定时器设置组件
 *
 * 直接从 store 读取定时器状态，通过 store action 触发启停，
 * useSleepTimer hook 会自动响应 store 变化执行倒计时逻辑。
 */
export function SleepTimerSetting() {
  const duration = useMusicStore((s) => s.sleepTimerDuration);
  const isActive = useMusicStore((s) => s.sleepTimerIsActive);
  const remaining = useMusicStore((s) => s.sleepTimerRemaining);
  const setSleepTimerRemaining = useMusicStore((s) => s.setSleepTimerRemaining);
  const setSleepTimerIsActive = useMusicStore((s) => s.setSleepTimerIsActive);
  const setSleepTimerEndTime = useMusicStore((s) => s.setSleepTimerEndTime);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

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
        icon={ClockFading}
        title="睡眠定时"
        subtitle={subtitle}
        showChevron
        onClick={() => setIsDrawerOpen(true)}
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

      <SleepTimerDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
    </>
  );
}

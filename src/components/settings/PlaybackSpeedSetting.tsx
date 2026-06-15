"use client";

import { useState } from "react";
import { Gauge } from "lucide-react";
import { SettingItem } from "./SettingItem";
import { PlaybackSpeedDrawer } from "./PlaybackSpeedDrawer";
import { useMusicStore } from "@/store/music-store";

export function PlaybackSpeedSetting() {
  const playbackSpeed = useMusicStore((s) => s.playbackSpeed);

  const [isDrawerOpen, setIsDrawerOpen] = useState(false);

  const handleOpenDrawer = () => {
    setIsDrawerOpen(true);
  };

  const subtitle = `当前 ${playbackSpeed.toFixed(1)}x`;

  return (
    <>
      <SettingItem
        icon={Gauge}
        title="倍速模式"
        subtitle={subtitle}
        showChevron
        onClick={handleOpenDrawer}
      />

      <PlaybackSpeedDrawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen} />
    </>
  );
}

"use client";

import { useState } from "react";
import { Type } from "lucide-react";
import { SettingItem } from "./SettingItem";
import { Slider } from "@/components/ui/slider";
import { useMusicStore, type LyricAlign } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { cn } from "@/lib/utils";

const ALIGN_OPTIONS: { value: LyricAlign; label: string }[] = [
  { value: "left", label: "左" },
  { value: "center", label: "中" },
  { value: "right", label: "右" },
];

export function LyricStyleSetting() {
  const [expanded, setExpanded] = useState(false);

  const {
    lyricAlign,
    setLyricAlign,
    lyricFontSize,
    setLyricFontSize,
    lyricOffset,
    setLyricOffset,
  } = useMusicStore(
    useShallow((state) => ({
      lyricAlign: state.lyricAlign,
      setLyricAlign: state.setLyricAlign,
      lyricFontSize: state.lyricFontSize,
      setLyricFontSize: state.setLyricFontSize,
      lyricOffset: state.lyricOffset,
      setLyricOffset: state.setLyricOffset,
    }))
  );

  const offsetText =
    lyricOffset === 0
      ? "0s"
      : `${lyricOffset > 0 ? "+" : ""}${lyricOffset.toFixed(1)}s`;

  return (
    <SettingItem
      icon={Type}
      title="歌词样式"
      subtitle={`${lyricFontSize}px · ${
        lyricAlign === "left"
          ? "居左"
          : lyricAlign === "right"
            ? "居右"
            : "居中"
      }`}
      onClick={() => setExpanded((v) => !v)}
      showChevron
      isExpanded={expanded}
      expandedContent={
        <div className="space-y-5">
          {/* 对齐 */}
          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-muted-foreground">对齐</span>

            <div className="flex rounded-lg bg-muted p-0.5">
              {ALIGN_OPTIONS.map(({ value, label }) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setLyricAlign(value)}
                  className={cn(
                    "min-w-12 rounded-md px-3 py-1.5 text-xs transition-all",
                    lyricAlign === value
                      ? "bg-background text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* 字号 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">字号</span>
              <span className="text-xs tabular-nums text-muted-foreground">
                {lyricFontSize}px
              </span>
            </div>

            <Slider
              value={[lyricFontSize]}
              onValueChange={([value]) => setLyricFontSize(value)}
              min={14}
              max={28}
              step={1}
            />
          </div>

          {/* 偏移 */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground">时间偏移</span>
              <span
                className={cn(
                  "text-xs tabular-nums",
                  lyricOffset === 0
                    ? "text-muted-foreground"
                    : "text-foreground"
                )}
              >
                {offsetText}
              </span>
            </div>

            <Slider
              value={[lyricOffset]}
              onValueChange={([value]) => setLyricOffset(value)}
              min={-1}
              max={1}
              step={0.1}
            />

            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>-1s 提前</span>
              <span>0</span>
              <span>+1s 推迟</span>
            </div>
          </div>
        </div>
      }
    />
  );
}

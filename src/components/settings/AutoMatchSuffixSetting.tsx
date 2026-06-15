"use client";

import { useState } from "react";
import { Tv } from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { useMusicStore } from "@/store/music-store";
import { SettingItem } from "./SettingItem";

const PRESET_KEYWORDS = ["高音质", "无损", "HiFi", "Hi-Res", "原曲"];

export function AutoMatchSuffixSetting() {
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const suffix = useMusicStore((s) => s.bilibiliAutoMatchSuffix || "");
  const setSuffix = useMusicStore((s) => s.setBilibiliAutoMatchSuffix);

  const toggleKeyword = (keyword: string) => {
    const words = new Set(suffix.trim().split(/\s+/).filter(Boolean));
    words.has(keyword) ? words.delete(keyword) : words.add(keyword);
    setSuffix([...words].join(" "));
  };

  return (
    <>
      <SettingItem
        icon={Tv}
        title="换源搜索关键词"
        subtitle={suffix}
        showChevron
        onClick={() => setIsDrawerOpen(true)}
      />

      <Drawer open={isDrawerOpen} onOpenChange={setIsDrawerOpen}>
        <DrawerContent className="outline-none">
          <DrawerHeader className="px-5 pt-6 pb-2">
            <DrawerTitle className="text-lg font-semibold text-center">
              换源搜索关键词
            </DrawerTitle>
          </DrawerHeader>

          <div className="px-5 py-4 space-y-4">
            <Input
              value={suffix}
              onChange={(e) => setSuffix(e.target.value)}
              className="h-9 text-sm bg-transparent border-muted"
            />

            <div className="flex flex-wrap gap-2">
              {PRESET_KEYWORDS.map((keyword) => {
                const isActive = suffix.includes(keyword);
                return (
                  <button
                    key={keyword}
                    type="button"
                    onClick={() => toggleKeyword(keyword)}
                    className={`px-3 py-1.5 rounded-full text-sm transition-colors border ${
                      isActive
                        ? "bg-primary/10 text-primary border-primary/20"
                        : "bg-muted text-foreground border-border hover:bg-primary/10 hover:border-primary/20"
                    }`}
                  >
                    {keyword}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="h-6" />
        </DrawerContent>
      </Drawer>
    </>
  );
}

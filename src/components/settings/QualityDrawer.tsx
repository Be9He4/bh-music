"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useMusicStore } from "@/store/music-store";
import { QUALITY_OPTIONS } from "@/lib/utils/quality";

interface QualityDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function QualityDrawer({ open, onOpenChange }: QualityDrawerProps) {
  const quality = useMusicStore((s) => s.quality);
  const setQuality = useMusicStore((s) => s.setQuality);

  const handleSelect = (value: string) => {
    setQuality(value);
    onOpenChange(false);
  };

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="outline-none">
        <DrawerHeader className="px-5 pt-6 pb-2">
          <DrawerTitle className="text-lg font-semibold text-center">
            音质选择
          </DrawerTitle>
        </DrawerHeader>

        <div className="px-5 py-4 space-y-2">
          {QUALITY_OPTIONS.map(({ value, label }) => {
            const isActive = quality === value;
            return (
              <button
                key={value}
                type="button"
                onClick={() => handleSelect(value)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-colors",
                  isActive
                    ? "bg-primary/10 text-primary"
                    : "text-foreground hover:bg-muted"
                )}
              >
                <span>{label}</span>
                {isActive && <Check className="h-4 w-4" />}
              </button>
            );
          })}
        </div>

        <div className="h-6" />
      </DrawerContent>
    </Drawer>
  );
}

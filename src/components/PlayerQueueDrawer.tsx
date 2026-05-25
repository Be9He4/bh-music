"use client";

import { useEffect, useRef, useState } from "react";
import { Shuffle, Trash2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerDescription,
  DrawerTitle,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import type { MusicTrack } from "@/types/music";

interface PlayerQueueDrawerProps {
  queue: MusicTrack[];
  currentIndex: number;
  isPlaying: boolean;
  isShuffle: boolean;
  onPlay: (index: number) => void;
  onClear: () => void;
  onReshuffle: () => void;
  onRemove: (track: MusicTrack) => void;
  trigger: React.ReactNode;
}

/** 显示当前播放队列，并支持切歌、清空、重新打乱和删除单曲。 */
export function PlayerQueueDrawer({
  queue,
  currentIndex,
  isPlaying,
  isShuffle,
  onPlay,
  onClear,
  onReshuffle,
  onRemove,
  trigger,
}: PlayerQueueDrawerProps) {
  const [open, setOpen] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const hasScrolledOnOpen = useRef(false);

  useEffect(() => {
    hasScrolledOnOpen.current = false;
  }, [open]);

  useEffect(() => {
    if (!open || hasScrolledOnOpen.current) return;
    hasScrolledOnOpen.current = true;

    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollIntoView({
        block: "center",
        behavior: "instant",
      });
    });

    return () => cancelAnimationFrame(id);
  }, [open, currentIndex]);

  const setCurrentRef = (el: HTMLDivElement | null) => {
    if (el) scrollRef.current = el;
  };

  return (
    <Drawer open={open} onOpenChange={setOpen}>
      <DrawerTrigger asChild>{trigger}</DrawerTrigger>
      <DrawerContent
        className="h-[70vh] max-h-[70vh] gap-0 rounded-t-3xl outline-none"
        onClick={(e) => e.stopPropagation()}
      >
        <DrawerHeader className="shrink-0 px-4 pb-3 pt-4">
          <div className="flex items-center justify-between">
            <DrawerTitle className="text-base font-semibold">
              播放列表 ({queue.length})
            </DrawerTitle>
            <DrawerDescription className="sr-only">
              当前播放队列，可切换、清空或删除歌曲。
            </DrawerDescription>
            <div className="flex items-center gap-1">
              {isShuffle && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-primary"
                  onClick={onReshuffle}
                  title="再次打乱"
                >
                  <Shuffle className="h-4 w-4" />
                </Button>
              )}
              <Button
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-muted-foreground hover:bg-transparent hover:text-destructive"
                onClick={onClear}
                title="清空播放列表"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </DrawerHeader>

        <div className="min-h-0 flex-1">
          <ScrollArea className="h-full">
            <div className="px-3 pb-[calc(1rem+env(safe-area-inset-bottom))]">
              {queue.map((track, i) => (
                <div
                  key={`${track.id}-${i}`}
                  ref={i === currentIndex ? setCurrentRef : undefined}
                  role="button"
                  tabIndex={0}
                  aria-label={`播放 ${track.name}`}
                  className={cn(
                    "flex min-h-11 cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-muted/50",
                    i === currentIndex && "bg-muted/50 text-primary"
                  )}
                  onClick={() => {
                    onPlay(i);
                    setOpen(false);
                  }}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter" && e.key !== " ") return;
                    e.preventDefault();
                    onPlay(i);
                    setOpen(false);
                  }}
                >
                  {i === currentIndex && isPlaying ? (
                    <div className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                      <span className="relative flex h-2.5 w-2.5">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                        <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-primary" />
                      </span>
                    </div>
                  ) : (
                    <span className="w-4 shrink-0 text-center font-mono text-xs text-muted-foreground">
                      {i + 1}
                    </span>
                  )}
                  <div className="min-w-0 flex-1 truncate">
                    <span className="font-medium">{track.name}</span>
                    <span className="ml-2 text-xs text-muted-foreground">
                      - {track.artist.join("/")}
                    </span>
                  </div>
                  <button
                    className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
                    onClick={(e) => {
                      e.stopPropagation();
                      if (
                        i === currentIndex &&
                        !confirm(`确定删除正在播放的《${track.name}》吗？`)
                      ) {
                        return;
                      }
                      onRemove(track);
                    }}
                    aria-label={`删除 ${track.name}`}
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </ScrollArea>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

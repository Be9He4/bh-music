import { useCallback } from "react";
import { useMusicStore } from "@/store/music-store";
import { getPlayAllStartIndex } from "./usePlayHelper";
import type { MusicTrack } from "@/types/music";

export function usePlayContextHandler(list: MusicTrack[], contextId: string) {
  const togglePlay = useMusicStore((s) => s.togglePlay);
  const playContext = useMusicStore((s) => s.playContext);
  const currentTrackId = useMusicStore((s) => s.queue[s.currentIndex]?.id);
  const isShuffle = useMusicStore((s) => s.isShuffle);

  return useCallback(
    (track: MusicTrack | null, index?: number) => {
      if (track && track.id === currentTrackId) {
        togglePlay();
        return;
      }
      const idx =
        index ??
        (track
          ? list.findIndex((t) => t.id === track.id)
          : getPlayAllStartIndex(list.length, isShuffle));
      if (idx < 0) return;
      playContext(list, Math.max(0, idx), contextId);
    },
    [contextId, list, togglePlay, playContext, currentTrackId, isShuffle]
  );
}

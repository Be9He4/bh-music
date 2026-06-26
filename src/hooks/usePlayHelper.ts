import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { MusicTrack } from "@/types/music";
import { useCallback } from "react";

/**
 * 获取播放全部时的起始索引
 * 随机模式下返回随机索引，否则返回 0
 */
export function getPlayAllStartIndex(
  tracksLength: number,
  isShuffle: boolean
): number {
  if (tracksLength <= 0) return 0;
  if (isShuffle) {
    return Math.floor(Math.random() * tracksLength);
  }
  return 0;
}

export function usePlayHelper() {
  const { playContext, togglePlay, queue, currentIndex, isShuffle } =
    useMusicStore(
      useShallow((state) => ({
        playContext: state.playContext,
        togglePlay: state.togglePlay,
        queue: state.queue,
        currentIndex: state.currentIndex,
        isShuffle: state.isShuffle,
      }))
    );

  const currentTrack = queue[currentIndex] || null;

  const handlePlay = useCallback(
    (track: MusicTrack, list: MusicTrack[], contextId?: string) => {
      if (currentTrack?.id === track.id) {
        togglePlay();
        return;
      }

      const index = list.findIndex((t) => t.id === track.id);
      if (index === -1) return;

      playContext(list, index, contextId);
    },
    [currentTrack, playContext, togglePlay]
  );

  /**
   * 播放全部歌曲
   * 根据 isShuffle 状态决定从第一首还是随机一首开始播放
   */
  const playAll = useCallback(
    (tracks: MusicTrack[], contextId?: string) => {
      if (tracks.length === 0) return;

      const startIndex = getPlayAllStartIndex(tracks.length, isShuffle);
      playContext(tracks, startIndex, contextId);
    },
    [isShuffle, playContext]
  );

  return { handlePlay, playAll };
}

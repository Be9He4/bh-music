import type { StateCreator } from "zustand";
import type { MusicState } from "./types";
import type { MusicTrack } from "@/types/music";
import { clamp, shuffleArray } from "./shared";

// --- Queue Helper ---
function insertNext(
  state: MusicState,
  track: MusicTrack,
  playImmediately: boolean
): Partial<MusicState> {
  if (!state.queue.length)
    return {
      queue: [track],
      originalQueue: state.isShuffle ? [track] : [],
      currentIndex: 0,
      ...(playImmediately && { currentAudioTime: 0 }),
    };

  const q = [...state.queue];
  const existIdx = q.findIndex((t) => t.id === track.id);
  if (existIdx === state.currentIndex)
    return playImmediately ? { currentAudioTime: 0 } : {};

  let targetIdx = state.currentIndex + 1;
  let curIdx = state.currentIndex;

  if (existIdx !== -1) {
    q.splice(existIdx, 1);
    if (existIdx < state.currentIndex) {
      targetIdx--;
      curIdx--;
    }
  }
  q.splice(targetIdx, 0, track);

  let oq = state.originalQueue;
  if (state.isShuffle) {
    oq = [...(state.originalQueue || [])];
    const curId = state.queue[state.currentIndex]?.id;
    const oqExistIdx = oq.findIndex((t) => t.id === track.id);
    if (oqExistIdx !== -1) oq.splice(oqExistIdx, 1);
    const oqCurIdx = curId ? oq.findIndex((t) => t.id === curId) : -1;
    oq.splice(oqCurIdx !== -1 ? oqCurIdx + 1 : oq.length, 0, track);
  }

  return {
    queue: q,
    originalQueue: oq,
    currentIndex: playImmediately ? targetIdx : curIdx,
    ...(playImmediately && { currentAudioTime: 0 }),
  };
}

export interface PlaybackSlice {
  volume: number;
  isRepeat: boolean;
  isShuffle: boolean;
  currentAudioTime: number;
  isPlaying: boolean;
  isLoading: boolean;
  seekTimestamp: number;
  seekTargetTime: number;
  duration: number;
  currentAudioUrl: string | null;
  hasUserGesture: boolean;
  consecutiveFailures: number;
  maxConsecutiveFailures: number;
  urlRecoveryKey: number;
  incrementUrlRecoveryKey: () => void;
  setVolume: (volume: number) => void;
  toggleRepeat: () => void;
  toggleShuffle: () => void;
  setAudioCurrentTime: (time: number) => void;
  setDuration: (duration: number) => void;
  setIsPlaying: (isPlaying: boolean) => void;
  togglePlay: () => void;
  setIsLoading: (isLoading: boolean) => void;
  seek: (time: number) => void;
  clearSeekTargetTime: () => void;
  setCurrentAudioUrl: (url: string | null) => void;
  setUserGesture: () => void;
  incrementFailures: () => number;
  resetFailures: () => void;
  coverUrl: string | null;
  setCoverUrl: (url: string | null) => void;

  queue: MusicTrack[];
  originalQueue: MusicTrack[];
  currentIndex: number;
  contextId: string | null;
  playContext: (
    tracks: MusicTrack[],
    startIndex?: number,
    contextId?: string
  ) => void;
  addToNextPlay: (track: MusicTrack) => void;
  playTrackAsNext: (track: MusicTrack) => void;
  addBatchToNextPlay: (tracks: MusicTrack[]) => void;
  skipToNext: () => void;
  removeFromQueue: (trackId: string) => void;
  clearQueue: () => void;
  reshuffle: () => void;
  setCurrentIndex: (index: number, resetTime?: boolean) => void;
  setCurrentIndexAndPlay: (index: number) => void;
  updateTrackInQueue: (trackId: string, newTrack: MusicTrack) => void;
}

export const createPlaybackSlice: StateCreator<
  MusicState,
  [],
  [],
  PlaybackSlice
> = (set, get) => ({
  volume: 1.0,
  isRepeat: false,
  isShuffle: false,
  currentAudioTime: 0,
  isPlaying: false,
  isLoading: false,
  seekTimestamp: 0,
  seekTargetTime: -1,
  duration: 0,
  currentAudioUrl: null,
  hasUserGesture: false,
  consecutiveFailures: 0,
  maxConsecutiveFailures: 3,
  urlRecoveryKey: 0,
  coverUrl: null,
  setVolume: (volume) => set({ volume }),
  toggleRepeat: () => set((s) => ({ isRepeat: !s.isRepeat })),
  setAudioCurrentTime: (currentAudioTime) => set({ currentAudioTime }),
  setDuration: (duration) => set({ duration }),
  setIsPlaying: (isPlaying) => set({ isPlaying }),
  togglePlay: () =>
    set((s) => ({ hasUserGesture: true, isPlaying: !s.isPlaying })),
  setIsLoading: (isLoading) => set({ isLoading }),
  seek: (time) =>
    set({
      seekTargetTime: time,
      seekTimestamp: Date.now(),
      isPlaying: true,
      hasUserGesture: true,
    }),
  clearSeekTargetTime: () => set({ seekTargetTime: -1 }),
  setCurrentAudioUrl: (currentAudioUrl) => set({ currentAudioUrl }),
  setUserGesture: () => set({ hasUserGesture: true }),
  resetFailures: () => set({ consecutiveFailures: 0 }),
  setCoverUrl: (coverUrl) => set({ coverUrl }),
  incrementUrlRecoveryKey: () =>
    set((s) => ({ urlRecoveryKey: s.urlRecoveryKey + 1 })),
  incrementFailures: () => {
    const f = get().consecutiveFailures + 1;
    set({ consecutiveFailures: f });
    return f;
  },

  // --- Queue Management ---
  queue: [],
  originalQueue: [],
  currentIndex: 0,
  contextId: null,

  toggleShuffle: () =>
    set((s) => {
      const curIdx = clamp(s.currentIndex, Math.max(0, s.queue.length - 1));
      if (!s.isShuffle) {
        if (s.queue.length <= 1)
          return { isShuffle: true, originalQueue: s.queue };
        const curTrack = s.queue[curIdx];
        const rest = s.queue.filter((_, i) => i !== curIdx);
        return {
          isShuffle: true,
          originalQueue: s.queue,
          queue: [curTrack, ...shuffleArray(rest)],
          currentIndex: 0,
        };
      }
      const newIdx = s.originalQueue.findIndex(
        (t) => t.id === s.queue[curIdx]?.id
      );
      return {
        isShuffle: false,
        queue: s.originalQueue.length ? s.originalQueue : s.queue,
        currentIndex: Math.max(0, newIdx),
        originalQueue: [],
      };
    }),

  playContext: (tracks, startIdx = 0, contextId) =>
    set((s) => {
      if (!tracks.length)
        return {
          queue: [],
          originalQueue: [],
          currentIndex: 0,
          currentAudioTime: 0,
          isPlaying: false,
          contextId: null,
        };
      const idx = clamp(startIdx, tracks.length - 1);
      if (s.isShuffle) {
        if (contextId && s.contextId === contextId && startIdx !== undefined) {
          const targetIdx = s.queue.findIndex(
            (t) => t.id === tracks[startIdx].id
          );
          if (targetIdx !== -1)
            return {
              currentIndex: targetIdx,
              currentAudioTime: 0,
              hasUserGesture: true,
            };
        }
        const realIdx =
          startIdx !== undefined
            ? idx
            : Math.floor(Math.random() * tracks.length);
        const rest = shuffleArray(tracks.filter((_, i) => i !== realIdx));
        return {
          queue: [tracks[realIdx], ...rest],
          originalQueue: tracks,
          currentIndex: 0,
          currentAudioTime: 0,
          hasUserGesture: true,
          contextId: contextId ?? null,
        };
      }
      return {
        queue: tracks,
        originalQueue: tracks,
        currentIndex: idx,
        currentAudioTime: 0,
        hasUserGesture: true,
        contextId: contextId ?? null,
      };
    }),

  addBatchToNextPlay: (tracks) =>
    set((s) => {
      if (!tracks.length) return s;
      if (!s.queue.length) {
        return {
          queue: [...tracks],
          originalQueue: s.isShuffle ? [...tracks] : [],
          currentIndex: 0,
        };
      }
      let state = s as MusicState;
      for (const track of [...tracks].reverse()) {
        state = {
          ...state,
          ...insertNext(state, track, false),
        } as MusicState;
      }
      return {
        queue: state.queue,
        originalQueue: state.originalQueue,
        currentIndex: state.currentIndex,
      };
    }),

  addToNextPlay: (track) => set((s) => insertNext(s, track, false)),
  playTrackAsNext: (track) => set((s) => insertNext(s, track, true)),

  removeFromQueue: (tid) =>
    set((s) => {
      const idx = s.queue.findIndex((t) => t.id === tid);
      if (idx === -1) return {};
      const q = s.queue.filter((t) => t.id !== tid);
      if (!q.length)
        return {
          queue: [],
          originalQueue: [],
          currentIndex: 0,
          currentAudioTime: 0,
          isPlaying: false,
        };
      return {
        queue: q,
        originalQueue: s.isShuffle
          ? (s.originalQueue || []).filter((t) => t.id !== tid)
          : s.originalQueue,
        currentIndex:
          idx < s.currentIndex
            ? s.currentIndex - 1
            : Math.min(s.currentIndex, q.length - 1),
      };
    }),

  clearQueue: () =>
    set({
      queue: [],
      originalQueue: [],
      currentIndex: 0,
      currentAudioTime: 0,
      isPlaying: false,
      duration: 0,
      contextId: null,
    }),
  reshuffle: () =>
    set((s) =>
      s.isShuffle && s.queue.length > 1
        ? {
            queue: [
              s.queue[s.currentIndex],
              ...shuffleArray(
                (s.originalQueue?.length ? s.originalQueue : s.queue).filter(
                  (t) => t.id !== s.queue[s.currentIndex].id
                )
              ),
            ],
            currentIndex: 0,
          }
        : {}
    ),

  setCurrentIndex: (idx, resetTime = true) =>
    set((s) => ({
      currentIndex: s.queue.length ? clamp(idx, s.queue.length - 1) : 0,
      currentAudioTime: resetTime ? 0 : s.currentAudioTime,
    })),
  setCurrentIndexAndPlay: (idx) =>
    set((s) => ({
      currentIndex: s.queue.length ? clamp(idx, s.queue.length - 1) : 0,
      currentAudioTime: 0,
      hasUserGesture: true,
      isPlaying: true,
    })),
  skipToNext: () =>
    set((s) =>
      s.queue.length
        ? {
            currentIndex: (s.currentIndex + 1) % s.queue.length,
            currentAudioTime: 0,
          }
        : {}
    ),

  updateTrackInQueue: (tid, newTrack) =>
    set((s) => ({
      queue: s.queue.map((t) => (t.id === tid ? newTrack : t)),
      originalQueue: s.originalQueue?.map((t) => (t.id === tid ? newTrack : t)),
      currentAudioUrl:
        s.queue[s.currentIndex]?.id === tid ? null : s.currentAudioUrl,
    })),
});

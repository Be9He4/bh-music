import type { StateCreator } from "zustand";
import type { MusicState } from "./types";
import type { MusicTrack } from "@/types/music";
import { withMeta, updateList, replaceActiveWithTombstones } from "./shared";

export interface FavoritesSlice {
  favorites: MusicTrack[];
  addToFavorites: (track: MusicTrack) => string | null;
  removeFromFavorites: (trackId: string) => void;
  restoreFromFavorites: (trackId: string) => void;
  setFavorites: (tracks: MusicTrack[]) => void;
  replaceActiveFavorites: (tracks: MusicTrack[]) => void;
  reorderFavorites: (tracks: MusicTrack[]) => void;
  isFavorite: (trackId: string) => boolean;
  addBatchToFavorites: (tracks: MusicTrack[]) => void;
  removeBatchFromFavorites: (trackIds: string[]) => void;
}

export const createFavoritesSlice: StateCreator<
  MusicState,
  [],
  [],
  FavoritesSlice
> = (set, get) => ({
  favorites: [],
  addToFavorites: (track) => {
    if (track.source === "local") return "本地音乐不支持喜欢";
    const { favorites } = get();
    const existing = favorites.find((t) => t.id === track.id);
    if (existing && !existing.is_deleted) return "已在「我的喜欢」中";
    const nextTrack = { ...withMeta(track), is_deleted: false };
    set({
      favorites: [nextTrack, ...favorites.filter((t) => t.id !== track.id)],
    });
    return null;
  },
  removeFromFavorites: (id) =>
    set((s) => ({
      favorites: updateList(s.favorites, id, { is_deleted: true }),
    })),
  restoreFromFavorites: (id) =>
    set((s) => ({
      favorites: updateList(s.favorites, id, { is_deleted: false }),
    })),
  setFavorites: (favorites) => set({ favorites: favorites.map(withMeta) }),
  replaceActiveFavorites: (favorites) =>
    set((s) => ({
      favorites: replaceActiveWithTombstones(s.favorites, favorites),
    })),
  reorderFavorites: (favorites) =>
    set((s) => ({
      favorites: [...favorites, ...s.favorites.filter((t) => t.is_deleted)],
    })),
  isFavorite: (id) => get().favorites.some((t) => t.id === id && !t.is_deleted),
  addBatchToFavorites: (tracks) =>
    set((s) => {
      const eligible = tracks.filter((t) => t.source !== "local");
      if (!eligible.length) return s;
      const deletedIds = new Set(
        s.favorites.filter((t) => t.is_deleted).map((t) => t.id)
      );
      const activeIds = new Set(
        s.favorites.filter((t) => !t.is_deleted).map((t) => t.id)
      );
      const toAdd = eligible
        .filter((t) => !activeIds.has(t.id))
        .map((t) => ({ ...withMeta(t), is_deleted: false }));
      if (!toAdd.length) return s;
      const idsToAdd = new Set(toAdd.map((t) => t.id));
      const base = s.favorites.filter(
        (t) => !deletedIds.has(t.id) || !idsToAdd.has(t.id)
      );
      return { favorites: [...toAdd, ...base] };
    }),
  removeBatchFromFavorites: (ids) =>
    set((s) => {
      const idSet = new Set(ids);
      return {
        favorites: s.favorites.map((t) =>
          idSet.has(t.id)
            ? { ...t, is_deleted: true, update_time: Date.now() }
            : t
        ),
      };
    }),
});

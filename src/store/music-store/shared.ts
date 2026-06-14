import type { MusicTrack, Playlist } from "@/types/music";
import { cleanTrack } from "@/lib/utils/music";

export const withMeta = (track: MusicTrack): MusicTrack => ({
  ...cleanTrack(track),
  update_time: Date.now(),
  is_deleted: track.is_deleted === true,
});

export const cleanPlaylist = (p: Playlist): Playlist => ({
  ...p,
  tracks: p.tracks.map(cleanTrack),
});

export const clamp = (val: number, max: number) =>
  Math.min(Math.max(val, 0), Math.max(0, max));

export const shuffleArray = <T>(arr: T[]): T[] =>
  [...arr].sort(() => Math.random() - 0.5);

export const updateList = <T extends { id: string }>(
  list: T[],
  id: string,
  updater: Partial<T> | ((item: T) => Partial<T>)
) =>
  list.map((item) =>
    item.id === id
      ? {
          ...item,
          update_time: Date.now(),
          ...(typeof updater === "function" ? updater(item) : updater),
        }
      : item
  );

export const replaceActiveWithTombstones = (
  current: MusicTrack[],
  active: MusicTrack[]
): MusicTrack[] => [
  ...active.map((track) => ({ ...withMeta(track), is_deleted: false })),
  ...current.filter((track) => track.is_deleted),
];

import { MusicTrack } from "@/types/music";

export function filterTracks(
  tracks: MusicTrack[],
  query: string
): MusicTrack[] {
  if (!query.trim()) return tracks;
  const lower = query.toLowerCase();
  return tracks.filter(
    (t) =>
      t.name.toLowerCase().includes(lower) ||
      t.artist?.some((a) => a?.toLowerCase().includes(lower)) ||
      t.album?.toLowerCase().includes(lower)
  );
}

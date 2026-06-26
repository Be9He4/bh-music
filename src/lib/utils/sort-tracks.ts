import { MusicTrack } from "@/types/music";

export type TrackSortKey =
  | "name-asc"
  | "name-desc"
  | "artist-asc"
  | "artist-desc"
  | "time-asc"
  | "time-desc";

/**
 * 对歌曲列表进行排序
 * @param tracks 原始歌曲列表
 * @param sortKey 排序键
 * @returns 排序后的新数组
 */
export function sortTracks(
  tracks: MusicTrack[],
  sortKey: TrackSortKey
): MusicTrack[] {
  const [field, dir] = sortKey.split("-") as [string, "asc" | "desc"];
  const sign = dir === "asc" ? 1 : -1;

  const sorted = [...tracks];
  switch (field) {
    case "name":
      sorted.sort(
        (a, b) =>
          sign * a.name.localeCompare(b.name, "zh-CN", { sensitivity: "base" })
      );
      break;
    case "artist":
      sorted.sort((a, b) => {
        const artistA = a.artist?.[0] || "";
        const artistB = b.artist?.[0] || "";
        return (
          sign *
          artistA.localeCompare(artistB, "zh-CN", { sensitivity: "base" })
        );
      });
      break;
    case "time":
      sorted.sort(
        (a, b) => sign * ((a.update_time || 0) - (b.update_time || 0))
      );
      break;
  }
  return sorted;
}

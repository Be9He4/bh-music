import { MusicTrack } from "@/types/music";

export type TrackSortKey =
  | "default"
  | "name-asc"
  | "name-desc"
  | "artist-asc"
  | "artist-desc";

export const sortFields: { value: string; label: string }[] = [
  { value: "default", label: "默认" },
  { value: "name", label: "歌曲名称" },
  { value: "artist", label: "歌手名称" },
];

/**
 * 解析排序键为字段和方向
 * @param sortKey 排序键
 * @returns 字段名与方向
 */
export function parseSortKey(sortKey: TrackSortKey): {
  field: string;
  dir: "asc" | "desc" | null;
} {
  if (sortKey === "default") return { field: "default", dir: null };
  const [field, dir] = sortKey.split("-") as [string, "asc" | "desc"];
  return { field, dir };
}

/**
 * 点击排序字段时切换排序状态
 * 规则：default -> field-asc <-> field-desc（同一字段仅在升降序间切换，不回到 default）
 * @param current 当前排序键
 * @param field 点击的字段
 * @returns 新的排序键
 */
export function toggleSortKey(
  current: TrackSortKey,
  field: string
): TrackSortKey {
  if (field === "default") return "default";

  const { field: currentField, dir } = parseSortKey(current);

  if (currentField === field) {
    return dir === "asc"
      ? (`${field}-desc` as TrackSortKey)
      : (`${field}-asc` as TrackSortKey);
  }

  return `${field}-asc` as TrackSortKey;
}

/**
 * 对歌曲列表进行排序
 * @param tracks 原始歌曲列表
 * @param sortKey 排序键
 * @returns 排序后的新数组（sortKey 为 default 时返回原数组引用）
 */
export function sortTracks(
  tracks: MusicTrack[],
  sortKey: TrackSortKey
): MusicTrack[] {
  if (sortKey === "default") return tracks;

  const { field, dir } = parseSortKey(sortKey);
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
  }
  return sorted;
}

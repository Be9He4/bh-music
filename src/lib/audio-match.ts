import { toast } from "react-hot-toast";
import { useMusicStore } from "@/store/music-store";
import {
  EXCLUDED_FOR_SEARCH,
  getAggregatedSourcesForMatch,
} from "@/hooks/use-aggregated-sources";
import { musicApi } from "@/lib/music-api";
import { sourceLabels, type MusicTrack } from "@/types/music";
import {
  isNameMatch,
  isArtistMatch,
  normalizeArtists,
  normalizeText,
  convertT2SOnly,
} from "./utils/music-key";
import { logger } from "@/lib/logger";

/**
 * 计算自动换源的单源内排序分数，优先保证歌名与歌手完全一致。
 */
function scoreAutoMatchCandidate(
  target: MusicTrack,
  candidate: MusicTrack,
  originalIndex: number
): number {
  let score = 0;
  const sameArtistSet =
    normalizeArtists(target.artist).join("/") ===
    normalizeArtists(candidate.artist).join("/");

  if (sameArtistSet) {
    score += 100;
  } else {
    const tSet = new Set(normalizeArtists(target.artist));
    const cSet = new Set(normalizeArtists(candidate.artist));
    for (const a of tSet) {
      if (cSet.has(a)) {
        score += 40;
        break;
      }
    }
  }

  if (normalizeText(target.name) === normalizeText(candidate.name))
    score += 100;

  // 全量匹配额外加分：简繁体转换后完全一致（保留括号等所有字符）
  if (convertT2SOnly(target.name) === convertT2SOnly(candidate.name)) {
    score += 50;
  }

  score += Math.max(0, 20 - originalIndex);

  return score;
}

/**
 * 自动匹配免费源逻辑
 * @param track 需要匹配的歌曲
 * @returns 是否匹配并切换成功
 */
export async function handleAutoMatch(track: MusicTrack): Promise<boolean> {
  if (track.source && EXCLUDED_FOR_SEARCH.includes(track.source)) {
    return false;
  }
  const toastId = toast.loading("正在搜索免费音源...", {
    id: `auto-match-${track.id}`,
  });

  try {
    const { updateTrackInQueue, updateTrackInPlaylists, contextId } =
      useMusicStore.getState();
    const aggregatedSources = getAggregatedSourcesForMatch().filter(
      (source) => source !== track.source
    );
    if (aggregatedSources.length === 0) {
      return false;
    }
    const match = await musicApi.searchBestMatch({
      query: `${track.name} ${track.artist[0]}`,
      sources: aggregatedSources,
      predicate: (item: MusicTrack) => {
        if (!isNameMatch(track.name, item.name)) return false;
        return isArtistMatch(track.artist, item.artist);
      },
      ranker: (item, originalIndex) =>
        scoreAutoMatchCandidate(track, item, originalIndex),
      targetTrack: track,
    });

    if (!match) {
      toast.error("未找到可用音源", { id: toastId });
      return false;
    }

    // 仅对 B 站音源保留原歌曲的 name 和 artist，避免标题杂乱与作者错位
    const { bilibiliKeepOriginalMeta } = useMusicStore.getState();
    const finalTrack: MusicTrack =
      match.source === "bilibili" && bilibiliKeepOriginalMeta
        ? { ...match, name: track.name, artist: track.artist }
        : match;

    updateTrackInQueue(track.id, finalTrack);

    if (contextId?.startsWith("playlist-")) {
      updateTrackInPlaylists(track.id, finalTrack);
    }
    // contextId === "favorites" 时启用（需恢复 isFavorite, favorites, setFavorites 析构）：
    // if (contextId === "favorites" && isFavorite(track.id)) {
    //   setFavorites(favorites.map((t) => (t.id === track.id ? finalTrack : t)));
    // }

    const sourceLabel = sourceLabels[match.source] || match.source;
    toast.success(`已自动切换至: ${sourceLabel}`, { id: toastId });
    return true;
  } catch (error) {
    logger.error("audio-match", "Auto match failed", error);
    toast.error("自动匹配失败", { id: toastId });
    return false;
  }
}

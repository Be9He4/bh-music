import {
  AudioFormat,
  MusicTrack,
  SearchIntent,
  SearchPageResult,
  SongLyric,
} from "@otter-music/shared";
import {
  getBilibiliCollectionDetail,
  getBilibiliCoverUrl,
  getBilibiliSongUrl,
  getBilibiliVideoDetail,
  searchBilibiliCollections,
  searchBilibiliVideos,
} from "@/lib/bilibili/bilibili-api";
import { IMusicProvider } from "../interface";
import { normalizeText, convertT2SOnly } from "@/lib/utils/music-key";

const audioFormatCache = new Map<string, AudioFormat>();

/**
 * 计算 target 在 blob 中的最长连续重叠字符数
 * 采用提前剪枝优化，对短字符串极速计算
 */
function getMaxContinuousOverlap(target: string, blob: string): number {
  let maxLen = 0;
  for (let i = 0; i < target.length; i++) {
    for (let j = i + 1; j <= target.length; j++) {
      const sub = target.substring(i, j);
      if (blob.includes(sub)) {
        maxLen = Math.max(maxLen, sub.length);
      } else {
        break; // 剪枝核心：如果较短的子串不包含，更长的肯定不包含，直接跳出内层循环
      }
    }
  }
  return maxLen;
}

function formatCacheKey(track: Pick<MusicTrack, "id" | "source">): string {
  return `${track.source}:${track.id}`;
}

export function getCachedBilibiliAudioFormat(
  track: Pick<MusicTrack, "id" | "source">
): AudioFormat | undefined {
  return audioFormatCache.get(formatCacheKey(track));
}

export class BilibiliApiProvider implements IMusicProvider {
  source = "bilibili" as const;

  async search(
    query: string,
    page: number,
    count: number,
    _signal?: AbortSignal,
    _intent?: SearchIntent | null
  ): Promise<SearchPageResult<MusicTrack>> {
    return searchBilibiliVideos(query, page, count);
  }

  async getUrl(track: MusicTrack, _br?: number): Promise<string | null> {
    const result = await getBilibiliSongUrl(track.url_id || track.id);
    if (result?.format) {
      audioFormatCache.set(formatCacheKey(track), result.format);
    }
    return result?.url ?? null;
  }

  async getPic(track: MusicTrack, _size?: number): Promise<string | null> {
    return getBilibiliCoverUrl(track.pic_id);
  }

  async getLyric(_track: MusicTrack): Promise<SongLyric | null> {
    return null;
  }

  async searchArtist(
    query: string,
    page: number,
    count: number
  ): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }

  async searchAlbum(
    query: string,
    page: number,
    count: number
  ): Promise<SearchPageResult<MusicTrack>> {
    return searchBilibiliCollections(query, page, count);
  }

  async getAlbumDetail(id: string): Promise<{
    meta: unknown;
    tracks: MusicTrack[];
    total: number;
  } | null> {
    return getBilibiliCollectionDetail(id);
  }

  async getSongDetail(id: string): Promise<unknown> {
    return getBilibiliVideoDetail(id);
  }

  getAutoMatchQuery(_target: MusicTrack, baseQuery: string): string {
    return `${baseQuery} 纯享 高音质 无损 HiFi Hi-Res`;
  }

  getAutoMatchCount(_target: MusicTrack): number {
    return 40;
  }

  getAutoMatchRanker(_target: MusicTrack) {
    // 忽略通用打分，直接使用原生索引保持 B 站自带的最佳推荐排序
    return (_candidate: MusicTrack, originalIndex: number) => -originalIndex;
  }

  getAutoMatchPredicate(target: MusicTrack) {
    const targetName = normalizeText(target.name);
    // 将所有歌手名称标准化
    const targetArtists = target.artist.map(normalizeText).filter(Boolean);

    // // eslint-disable-next-line no-console
    // console.log(
    //   "[bilibili] getAutoMatchPredicate target:",
    //   target.name,
    //   target.artist,
    //   "normalized:",
    //   targetName,
    //   targetArtists
    // );

    return (candidate: MusicTrack) => {
      const blob = [
        candidate.name,
        candidate.artist.join(" "),
        candidate.album || "",
      ]
        .map((text) => {
          // 只做简繁体和大小写转换，不删除括号内容
          const t2s = convertT2SOnly(text);
          // 手动剔除符号和空格，保留字母、数字、汉字
          return t2s.replace(/[^\p{L}\p{N}]/gu, "");
        })
        .join(" ");

      const nameMatch = blob.includes(targetName);
      // 交叉匹配：利用连续字符重叠度来判定
      const artistMatch =
        targetArtists.length === 0 ||
        targetArtists.some((targetArtist) => {
          // 1. 完整包含，直接放行
          if (blob.includes(targetArtist)) return true;

          // 2. 计算最长连续重叠度
          const overlapLen = getMaxContinuousOverlap(targetArtist, blob);

          // 3. 动态判定阈值：
          // 只要有连续 2 个以上的字符重叠，且覆盖了目标歌手名 40% 以上的长度即可判定为同一人
          // 例："那吾克热nw"(长6) -> 匹配到 "那吾克热"(长4)，4 >= 2.4，True
          // 例："gem邓紫棋"(长7) -> 匹配到 "邓紫棋"(长3)，3 >= 2.8，True
          // 例："张杰"(长2) -> 匹配到 "张杰"(长2)，2 >= 0.8，True
          return overlapLen >= 2 && overlapLen >= targetArtist.length * 0.4;
        });

      // // eslint-disable-next-line no-console
      // console.log(
      //   "[bilibili] matching candidate:",
      //   candidate.name,
      //   "blob:",
      //   blob,
      //   "nameMatch:",
      //   nameMatch,
      //   "artistMatch:",
      //   artistMatch
      // );

      // 1. 必须包含歌名
      if (!nameMatch) return false;

      // 2. 只要包含原曲的任意一位歌手即可放行（B 站搜索结果排序足够可信）
      if (!artistMatch) return false;

      return true;
    };
  }
}

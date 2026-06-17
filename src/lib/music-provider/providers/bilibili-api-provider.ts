import {
  MusicTrack,
  parseBilibiliTrackId,
  SearchIntent,
  SearchPageResult,
  SongLyric,
} from "@otter-music/shared";
import { useMusicStore } from "@/store/music-store";
import {
  getBilibiliCollectionDetail,
  getBilibiliCoverUrl,
  getBilibiliSongUrl,
  getBilibiliVideoDetail,
  getBilibiliVideoUrl,
  searchBilibiliCollections,
  searchBilibiliVideos,
} from "@/lib/bilibili/bilibili-api";
import { setCachedBilibiliAudioFormat } from "@/lib/bilibili/bilibili-cache";
import { createAutoMatchPredicate } from "@/lib/bilibili/bilibili-match";
import { IMusicProvider } from "../interface";

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
      setCachedBilibiliAudioFormat(track, result.format);
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

  async getVideoUrl(track: MusicTrack): Promise<string | null> {
    const parsed = parseBilibiliTrackId(track.id);
    if (!parsed) return null;
    return getBilibiliVideoUrl(parsed.bvid, parsed.cid);
  }

  getAutoMatchQuery(_target: MusicTrack, baseQuery: string): string {
    const suffix = useMusicStore.getState().bilibiliAutoMatchSuffix;
    return suffix ? `${baseQuery} ${suffix}` : baseQuery;
  }

  getAutoMatchCount(_target: MusicTrack): number {
    return 40;
  }

  getAutoMatchRanker(_target: MusicTrack) {
    // 忽略通用打分，直接使用原生索引保持 B 站自带的最佳推荐排序
    return (_candidate: MusicTrack, originalIndex: number) => -originalIndex;
  }

  getAutoMatchPredicate(target: MusicTrack) {
    return createAutoMatchPredicate(target);
  }
}

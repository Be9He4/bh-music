import { IMusicProvider } from "../interface";
import {
  getMiguLyric,
  getMiguSongUrl,
  searchMiguSongs,
} from "@/lib/migu/migu-api";
import {
  MusicTrack,
  SearchIntent,
  SearchPageResult,
  SongLyric,
} from "@/types/music";

export class MiguApiProvider implements IMusicProvider {
  source = "migu" as const;

  async search(
    query: string,
    page: number,
    count: number,
    _signal?: AbortSignal,
    _intent?: SearchIntent | null
  ): Promise<SearchPageResult<MusicTrack>> {
    const result = await searchMiguSongs(query, page, count);
    return { items: result.items, hasMore: result.hasMore };
  }

  /**
   * 通过导入时编码进曲目 ID 的 copyrightId/contentId 获取播放地址。
   */
  async getUrl(track: MusicTrack, br?: number): Promise<string | null> {
    return getMiguSongUrl(track.url_id || track.id, br);
  }

  /**
   * 返回导入时已保存的封面地址。
   */
  async getPic(track: MusicTrack, _size?: number): Promise<string | null> {
    return track.pic_id || null;
  }

  /**
   * 通过导入时保存的 LRC URL 获取歌词。
   */
  async getLyric(track: MusicTrack): Promise<SongLyric | null> {
    return getMiguLyric(track.lyric_id);
  }
}

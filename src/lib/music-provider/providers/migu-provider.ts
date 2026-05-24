import { IMusicProvider } from "../interface";
import { getMiguLyric, getMiguSongUrl } from "@/lib/migu/migu-api";
import { MusicTrack, SearchIntent, SearchPageResult, SongLyric } from "@/types/music";

export class MiguProvider implements IMusicProvider {
  /**
   * 咪咕暂不提供站内搜索能力，仅作为歌单导入后的 provider。
   */
  async search(_query: string, _page: number, _count: number, _signal?: AbortSignal, _intent?: SearchIntent | null): Promise<SearchPageResult<MusicTrack>> {
    return { items: [], hasMore: false };
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

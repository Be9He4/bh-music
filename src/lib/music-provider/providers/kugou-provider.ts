import { IMusicProvider } from "../interface";
import { MusicTrack, SearchIntent, SearchPageResult, SongLyric } from "@/types/music";

export class KugouProvider implements IMusicProvider {
  /**
   * 酷狗暂不提供站内搜索能力，仅作为歌单导入后的安全占位 provider。
   */
  async search(_query: string, _page: number, _count: number, _signal?: AbortSignal, _intent?: SearchIntent | null): Promise<SearchPageResult<MusicTrack>> {
    return { items: [], hasMore: false };
  }

  /**
   * 酷狗导入当前只保存歌曲元数据，暂不承诺可播放直链。
   */
  async getUrl(_track: MusicTrack, _br?: number): Promise<string | null> {
    return null;
  }

  /**
   * 返回导入时已保存的封面地址。
   */
  async getPic(track: MusicTrack, _size?: number): Promise<string | null> {
    return track.pic_id || null;
  }

  /**
   * 酷狗导入当前不拉取歌词。
   */
  async getLyric(_track: MusicTrack): Promise<SongLyric | null> {
    return null;
  }
}

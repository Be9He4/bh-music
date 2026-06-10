import { IMusicProvider } from "../interface";
import {
  MusicTrack,
  SearchIntent,
  SearchPageResult,
  SongLyric,
} from "@/types/music";
import { getLxUrl } from "@/lib/utils/lx-api";
import { searchKugouMusic, getKugouLyric } from "@/lib/kugou/kugou-api";

export class LxKugouProvider implements IMusicProvider {
  source = "lx_kugou" as const;

  async search(
    query: string,
    page: number,
    count: number,
    _signal?: AbortSignal,
    _intent?: SearchIntent | null
  ): Promise<SearchPageResult<MusicTrack>> {
    const result = await searchKugouMusic(query, page, count);
    return {
      items: result.items.map((item) => ({
        ...item,
        id: item.id.replace(/^kugou_/, "lx_kugou_"),
        source: "lx_kugou" as const,
      })) as MusicTrack[],
      hasMore: result.items.length >= count,
    };
  }

  async getUrl(track: MusicTrack, br?: number): Promise<string | null> {
    return getLxUrl(this.source, track.url_id, br);
  }

  async getPic(track: MusicTrack, _size?: number): Promise<string | null> {
    return track.pic_id || null;
  }

  async getLyric(track: MusicTrack): Promise<SongLyric | null> {
    const hash = track.lyric_id || track.url_id;
    if (!hash) return null;
    const lrc = await getKugouLyric(hash);
    if (!lrc) return null;
    return { lyric: lrc };
  }
}

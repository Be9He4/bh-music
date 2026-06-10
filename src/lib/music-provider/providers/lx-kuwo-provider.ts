import { IMusicProvider } from "../interface";
import {
  MusicTrack,
  SearchIntent,
  SearchPageResult,
  SongLyric,
} from "@/types/music";
import { getLxUrl } from "@/lib/utils/lx-api";

export class LxKuwoProvider implements IMusicProvider {
  source = "lx_kuwo" as const;

  async search(
    _query: string,
    _page: number,
    _count: number,
    _signal?: AbortSignal,
    _intent?: SearchIntent | null
  ): Promise<SearchPageResult<MusicTrack>> {
    return { items: [], hasMore: false };
  }

  async getUrl(track: MusicTrack, br?: number): Promise<string | null> {
    return getLxUrl(this.source, track.url_id, br);
  }

  async getPic(track: MusicTrack, _size?: number): Promise<string | null> {
    return track.pic_id || null;
  }

  async getLyric(_track: MusicTrack): Promise<SongLyric | null> {
    return null;
  }
}

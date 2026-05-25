import {
  SearchIntent,
  SearchPageResult,
  MusicTrack,
  SongLyric,
} from "@otter-music/shared";
import { IMusicProvider } from "../interface";

export class QqApiProvider implements IMusicProvider {
  source = "qq" as const;

  async search(
    _query: string,
    _page: number,
    _count: number,
    _signal?: AbortSignal,
    _intent?: SearchIntent | null
  ): Promise<SearchPageResult<MusicTrack>> {
    return { items: [], hasMore: false };
  }

  async getUrl(_track: MusicTrack, _br?: number): Promise<string | null> {
    return null;
  }

  async getPic(track: MusicTrack, _size?: number): Promise<string | null> {
    return track.pic_id || null;
  }

  async getLyric(_track: MusicTrack): Promise<SongLyric | null> {
    return null;
  }
}

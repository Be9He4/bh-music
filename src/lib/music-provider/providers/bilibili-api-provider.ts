import {
  MusicTrack,
  SearchIntent,
  SearchPageResult,
  SongLyric,
} from "@/types/music";
import {
  getBilibiliCoverUrl,
  getBilibiliSongUrl,
  searchBilibiliVideos,
} from "@/lib/bilibili/bilibili-api";
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
    return getBilibiliSongUrl(track.url_id || track.id);
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
    count: number,
  ): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }
}

import {
  SearchIntent,
  SearchPageResult,
  MusicTrack,
  SongLyric,
} from "@otter-music/shared";
import { IMusicProvider } from "../interface";
import {
  searchQqMusic,
  getQqMusicUrl,
  getQqMusicLyric,
} from "@/lib/qqmusic/qqmusic-api";

export class QqApiProvider implements IMusicProvider {
  source = "qq" as const;

  async search(
    query: string,
    page: number,
    _count: number,
    signal?: AbortSignal,
    _intent?: SearchIntent | null
  ): Promise<SearchPageResult<MusicTrack>> {
    return searchQqMusic(query, page, signal);
  }

  async getUrl(track: MusicTrack, br?: number): Promise<string | null> {
    let songmid = track.url_id || track.lyric_id;
    if (!songmid) return null;
    if (songmid.startsWith("qq_")) songmid = songmid.slice(3);
    return getQqMusicUrl(songmid, br);
  }

  async getPic(track: MusicTrack, _size?: number): Promise<string | null> {
    return track.pic_id || null;
  }

  async getLyric(track: MusicTrack): Promise<SongLyric | null> {
    let songmid = track.lyric_id || track.url_id;
    if (!songmid) return null;
    if (songmid.startsWith("qq_")) songmid = songmid.slice(3);
    return getQqMusicLyric(songmid);
  }
}

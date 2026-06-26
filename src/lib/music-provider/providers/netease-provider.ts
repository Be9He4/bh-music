import {
  getArtist,
  getAlbum,
  getSongDetail,
  getMusicComments,
  search as neteaseSearch,
  convertSongToMusicTrack,
  getLyric as neteaseGetLyric,
} from "@/lib/netease/netease-api";
import {
  SearchPageResult,
  MusicTrack,
  SongLyric,
  SearchIntent,
} from "@/types/music";
import { BaseMusicProvider } from "../base-provider";

export class NeteaseProvider extends BaseMusicProvider {
  source = "netease" as const;

  // --- 核心能力：搜索/歌词/图片走官方API，音频URL继续走GD API ---

  async search(
    query: string,
    page: number,
    count: number,
    _signal?: AbortSignal,
    _intent?: SearchIntent
  ): Promise<SearchPageResult<MusicTrack>> {
    const res = await neteaseSearch(query, 1, page, count);
    const songs = res.data.result.songs || [];
    const items = songs.map((s) => ({
      ...convertSongToMusicTrack(s, false),
      source: this.source,
    }));
    return {
      items,
      hasMore:
        res.data.result.hasMore ??
        (res.data.result.songCount || 0) > page * count,
    };
  }

  async getPic(track: MusicTrack, size: number = 800): Promise<string | null> {
    try {
      const song = await getSongDetail(track.id);
      const url = song?.al?.picUrl;
      return url ? `${url}?param=${size}y${size}` : null;
    } catch (e) {
      console.error("NeteaseProvider getPic failed:", e);
      return null;
    }
  }

  async getLyric(track: MusicTrack): Promise<SongLyric | null> {
    try {
      const res = await neteaseGetLyric(track.id);
      if (!res || !res.data) return { lyric: "", tlyric: "" };
      return {
        lyric: res.data.lrc?.lyric || "",
        tlyric: res.data.tlyric?.lyric || "",
      };
    } catch (e) {
      console.error("NeteaseProvider getLyric failed:", e);
      return null;
    }
  }

  // --- Extended Capabilities ---

  async getArtistDetail(id: string) {
    return getArtist(id);
  }

  async getAlbumDetail(id: string) {
    return getAlbum(id);
  }

  async getSongDetail(id: string) {
    return getSongDetail(id);
  }

  async getComments(id: string) {
    return getMusicComments(id);
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
    return this.search(query, page, count);
  }
}

import { IMusicProvider } from "../interface";
import {
  MusicTrack,
  SearchPageResult,
  SongLyric,
  SearchIntent,
} from "@/types/music";
import { Capacitor } from "@capacitor/core";
import { LocalMusicPlugin } from "@/plugins/local-music";
import { logger } from "@/lib/logger";

export class LocalProvider implements IMusicProvider {
  source = "local" as const;
  async search(
    _query: string,
    _page: number,
    _count: number,
    _signal?: AbortSignal,
    _intent?: SearchIntent
  ): Promise<SearchPageResult<MusicTrack>> {
    return { items: [], hasMore: false };
  }

  async getUrl(track: MusicTrack, _br?: number): Promise<string | null> {
    const path = track.url_id;

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await LocalMusicPlugin.getLocalFileUrl({
          localPath: path,
        });
        if (result.success && result.url) {
          return Capacitor.convertFileSrc(result.url);
        }
        logger.error("local-provider", "getLocalFileUrl failed", result.error);
        return null;
      } catch (e) {
        logger.error("local-provider", "getLocalFileUrl error", e);
        return null;
      }
    }
    return Capacitor.convertFileSrc(path);
  }

  async getPic(track: MusicTrack, _size?: number): Promise<string | null> {
    if (!track.pic_id) return null;

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await LocalMusicPlugin.getEmbeddedCover({
          localPath: track.pic_id,
        });
        if (result.success && result.dataUrl) return result.dataUrl;
        return null;
      } catch (e) {
        logger.error("local-provider", "getEmbeddedCover error", e, {
          localPath: track.pic_id,
          errorMessage: e instanceof Error ? e.message : String(e),
        });
        return null;
      }
    }

    return null;
  }

  async getLyric(track: MusicTrack): Promise<SongLyric | null> {
    if (!track.lyric_id) return null;

    if (Capacitor.isNativePlatform()) {
      try {
        const result = await LocalMusicPlugin.getEmbeddedLyrics({
          localPath: track.lyric_id,
        });
        if (result.success && result.lyric) {
          return { lyric: result.lyric, tlyric: "" };
        }
        return null;
      } catch (e) {
        logger.error("local-provider", "getEmbeddedLyrics error", e, {
          localPath: track.lyric_id,
          errorMessage: e instanceof Error ? e.message : String(e),
        });
        return null;
      }
    }

    return null;
  }
}

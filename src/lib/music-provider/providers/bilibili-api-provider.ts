import {
  AudioFormat,
  MusicTrack,
  SearchIntent,
  SearchPageResult,
  SongLyric,
} from "@otter-music/shared";
import {
  getBilibiliCollectionDetail,
  getBilibiliCoverUrl,
  getBilibiliSongUrl,
  getBilibiliVideoDetail,
  searchBilibiliCollections,
  searchBilibiliVideos,
} from "@/lib/bilibili/bilibili-api";
import { IMusicProvider } from "../interface";
import { normalizeText } from "@/lib/utils/music-key";

const audioFormatCache = new Map<string, AudioFormat>();

function formatCacheKey(track: Pick<MusicTrack, "id" | "source">): string {
  return `${track.source}:${track.id}`;
}

export function getCachedBilibiliAudioFormat(
  track: Pick<MusicTrack, "id" | "source">
): AudioFormat | undefined {
  return audioFormatCache.get(formatCacheKey(track));
}

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
    const result = await getBilibiliSongUrl(track.url_id || track.id);
    if (result?.format) {
      audioFormatCache.set(formatCacheKey(track), result.format);
    }
    return result?.url ?? null;
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
    count: number
  ): Promise<SearchPageResult<MusicTrack>> {
    return this.search(query, page, count);
  }

  async searchAlbum(
    query: string,
    page: number,
    count: number
  ): Promise<SearchPageResult<MusicTrack>> {
    return searchBilibiliCollections(query, page, count);
  }

  async getAlbumDetail(id: string): Promise<{
    meta: unknown;
    tracks: MusicTrack[];
    total: number;
  } | null> {
    return getBilibiliCollectionDetail(id);
  }

  async getSongDetail(id: string): Promise<unknown> {
    return getBilibiliVideoDetail(id);
  }

  getAutoMatchQuery(_target: MusicTrack, baseQuery: string): string {
    return `${baseQuery} 高音质 无损 HiFi Hi-Res`;
  }

  getAutoMatchCount(_target: MusicTrack): number {
    return 40;
  }

  getAutoMatchPredicate(target: MusicTrack) {
    const targetName = normalizeText(target.name);
    const targetArtist = normalizeText(target.artist[0] || "");
    return (candidate: MusicTrack) => {
      const blob = [
        candidate.name,
        candidate.artist[0] || "",
        candidate.album || "",
      ]
        .map(normalizeText)
        .join(" ");
      if (!blob.includes(targetName)) return false;
      if (targetArtist && !blob.includes(targetArtist)) return false;
      return true;
    };
  }
}

import type { AudioFormat, MusicTrack } from "@otter-music/shared";

const audioFormatCache = new Map<string, AudioFormat>();

function formatCacheKey(track: Pick<MusicTrack, "id" | "source">): string {
  return `${track.source}:${track.id}`;
}

export function getCachedBilibiliAudioFormat(
  track: Pick<MusicTrack, "id" | "source">
): AudioFormat | undefined {
  return audioFormatCache.get(formatCacheKey(track));
}

export function setCachedBilibiliAudioFormat(
  track: Pick<MusicTrack, "id" | "source">,
  format: AudioFormat
): void {
  audioFormatCache.set(formatCacheKey(track), format);
}

import type { MusicTrack } from "@otter-music/shared";
import { normalizeText, convertT2SOnly } from "@/lib/utils/music-key";

function getMaxContinuousOverlap(target: string, blob: string): number {
  let maxLen = 0;
  for (let i = 0; i < target.length; i++) {
    for (let j = i + 1; j <= target.length; j++) {
      const sub = target.substring(i, j);
      if (blob.includes(sub)) {
        maxLen = Math.max(maxLen, sub.length);
      } else {
        break;
      }
    }
  }
  return maxLen;
}

export function createAutoMatchPredicate(target: MusicTrack) {
  const targetName = normalizeText(target.name);
  const targetArtists = target.artist.map(normalizeText).filter(Boolean);

  return (candidate: MusicTrack) => {
    const blob = [
      candidate.name,
      candidate.artist.join(" "),
      candidate.album || "",
    ]
      .map((text) => {
        const t2s = convertT2SOnly(text);
        return t2s.replace(/[^\p{L}\p{N}]/gu, "");
      })
      .join(" ");

    const nameMatch = blob.includes(targetName);
    const artistMatch =
      targetArtists.length === 0 ||
      targetArtists.some((targetArtist) => {
        if (blob.includes(targetArtist)) return true;

        const overlapLen = getMaxContinuousOverlap(targetArtist, blob);

        return overlapLen >= 2 && overlapLen >= targetArtist.length * 0.4;
      });

    if (!nameMatch) return false;
    if (!artistMatch) return false;

    return true;
  };
}

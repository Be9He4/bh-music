import { useEffect, useRef, useState, useCallback } from "react";
import { MusicTrackList } from "@/components/MusicTrackList";
import {
  GenericDetailPage,
  type GenericDetailData,
} from "@/components/GenericDetailPage";
import { ListMusic } from "lucide-react";
import {
  getBilibiliCollectionDetail,
  getBilibiliMultiPDetail,
  getBilibiliCoverUrl,
} from "@/lib/bilibili/bilibili-api";
import {
  parseBilibiliAlbumId,
  parseBilibiliMultiPAlbumId,
} from "@otter-music/shared";
import { MusicTrack } from "@/types/music";

interface BilibiliCollectionDetailProps {
  id: string | null;
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[]) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

interface CollectionDetailData {
  title: string;
  coverUrl: string;
  trackCount: number;
  upName: string;
}

export function BilibiliCollectionDetail({
  id,
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: BilibiliCollectionDetailProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [{ loading, error, detail, tracks }, setState] = useState<{
    loading: boolean;
    error: boolean;
    detail: CollectionDetailData | null;
    tracks: MusicTrack[];
  }>({
    loading: true,
    error: false,
    detail: null,
    tracks: [],
  });

  const albumId = id || "";
  const isSeries = albumId ? !!parseBilibiliAlbumId(albumId) : false;
  const isMultiP = albumId ? !!parseBilibiliMultiPAlbumId(albumId) : false;

  useEffect(() => {
    if (!isSeries && !isMultiP) {
      setState({ loading: false, error: true, detail: null, tracks: [] });
      return;
    }

    let cancelled = false;

    const fetchDetail = async () => {
      try {
        setState((prev) => ({ ...prev, loading: true, error: false }));

        if (isSeries) {
          const res = await getBilibiliCollectionDetail(albumId);
          if (cancelled) return;
          if (!res || !res.meta) throw new Error("获取合集失败");
          const coverUrl = await getBilibiliCoverUrl(res.meta.cover || "");
          setState({
            loading: false,
            error: false,
            detail: {
              title: res.meta.name || "合集",
              coverUrl: coverUrl || "",
              trackCount: res.total,
              upName: res.meta.creator?.name || "",
            },
            tracks: res.tracks,
          });
        } else {
          const res = await getBilibiliMultiPDetail(albumId);
          if (cancelled) return;
          if (!res || !res.meta) throw new Error("获取分P失败");
          const coverUrl = await getBilibiliCoverUrl(res.meta.cover || "");
          setState({
            loading: false,
            error: false,
            detail: {
              title: res.meta.name || "系列",
              coverUrl: coverUrl || "",
              trackCount: res.total,
              upName: "",
            },
            tracks: res.tracks,
          });
        }
      } catch {
        if (!cancelled) {
          setState({ loading: false, error: true, detail: null, tracks: [] });
        }
      }
    };

    fetchDetail();

    return () => {
      cancelled = true;
    };
  }, [albumId, isSeries, isMultiP, retryCount]);

  const handleTrackPlay = useCallback(
    (track: MusicTrack) => {
      onPlay(track, tracks);
    },
    [onPlay, tracks]
  );

  const activeTracks = tracks.filter((t) => !t.is_deleted);

  const genericDetail: GenericDetailData | undefined = detail
    ? {
        title: detail.title,
        coverUrl: detail.coverUrl,
        creator: detail.upName || undefined,
        countDesc: `${detail.trackCount} 个视频`,
        fallbackIcon: <ListMusic className="h-8 w-8 text-primary/80" />,
      }
    : undefined;

  return (
    <GenericDetailPage
      loading={loading}
      error={error}
      title="合集"
      onBack={onBack}
      onRetry={() => setRetryCount((c) => c + 1)}
      detail={genericDetail}
      scrollRef={scrollRef}
    >
      <MusicTrackList
        tracks={activeTracks}
        onPlay={handleTrackPlay}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
      />
    </GenericDetailPage>
  );
}

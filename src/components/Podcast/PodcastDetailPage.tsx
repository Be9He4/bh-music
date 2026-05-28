import { useEffect, useRef, useState } from "react";
import { MusicTrackList } from "@/components/MusicTrackList";
import {
  GenericDetailPage,
  type GenericDetailData,
} from "@/components/GenericDetailPage";
import { Button } from "@/components/ui/button";
import { Podcast, SquareArrowOutUpRight } from "lucide-react";
import toast from "react-hot-toast";
import { formatDateZN } from "@/lib/utils";
import { parsePodcastRss } from "@/lib/api/podcast";
import { usePodcastStore } from "@/store/podcast-store";
import { forceHttps } from "@otter-music/shared";
import { MusicTrack } from "@/types/music";

interface PodcastDetailPageProps {
  id: string | null;
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[]) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

interface PodcastDetailData {
  name: string;
  coverImgUrl: string;
  description?: string;
  creator?: string;
  trackCount: number;
  rssUrl: string;
}

export function PodcastDetailPage({
  id,
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: PodcastDetailPageProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [retryCount, setRetryCount] = useState(0);

  const [{ loading, error, detail, tracks }, setState] = useState<{
    loading: boolean;
    error: boolean;
    detail: PodcastDetailData | null;
    tracks: MusicTrack[];
  }>({
    loading: true,
    error: false,
    detail: null,
    tracks: [],
  });

  const handleShare = async () => {
    if (!detail) return;

    try {
      await navigator.clipboard.writeText(
        `Podcast: ${detail.name}\n${detail.rssUrl}`
      );
      toast.success("链接已复制");
    } catch {
      toast.error("复制失败");
    }
  };

  useEffect(() => {
    if (!id) {
      setState({ loading: false, error: true, detail: null, tracks: [] });
      return;
    }

    let active = true;
    setState({ loading: true, error: false, detail: null, tracks: [] });

    const loadData = async () => {
      try {
        const sources = usePodcastStore.getState().rssSources;
        const source = sources.find(
          (item) => item.id === id && !item.is_deleted
        );
        if (!source) throw new Error("Podcast not found");

        const feed = await parsePodcastRss(source.rssUrl);
        const coverUrl = forceHttps(feed.coverUrl || source.coverUrl || "");

        const podcastTracks = feed.episodes.map((ep) => ({
          id: ep.audioUrl || ep.id,
          name: ep.title,
          artist: [feed.name],
          album: ep.pubDate ? formatDateZN(ep.pubDate) : "",
          pic_id: coverUrl,
          url_id: forceHttps(ep.audioUrl) || "",
          lyric_id: "_podcast",
          source: "podcast" as const,
        }));

        if (!active) return;

        setState({
          loading: false,
          error: false,
          detail: {
            name: feed.name,
            coverImgUrl: coverUrl,
            description: feed.description || source.description,
            trackCount: feed.episodes.length,
            creator: source.author,
            rssUrl: source.rssUrl,
          },
          tracks: podcastTracks,
        });
      } catch {
        if (active) {
          setState((prev) => ({ ...prev, loading: false, error: true }));
        }
      }
    };

    void loadData();

    return () => {
      active = false;
    };
  }, [id, retryCount]);

  const genericDetail: GenericDetailData | undefined = detail
    ? {
        title: detail.name,
        coverUrl: detail.coverImgUrl,
        description: detail.description,
        creator: detail.creator,
        countDesc: `最近 ${detail.trackCount} 集`,
        fallbackIcon: <Podcast className="h-8 w-8 text-muted-foreground/50" />,
      }
    : undefined;

  return (
    <GenericDetailPage
      loading={loading}
      error={error}
      title="Podcast"
      onBack={onBack}
      onRetry={() => setRetryCount((c) => c + 1)}
      detail={genericDetail}
      scrollRef={scrollRef}
      action={
        <Button
          variant="ghost"
          size="icon"
          className="text-muted-foreground hover:text-foreground"
          onClick={handleShare}
        >
          <SquareArrowOutUpRight className="w-4 h-4 mr-2" />
        </Button>
      }
    >
      <MusicTrackList
        tracks={tracks}
        scrollContainerRef={scrollRef}
        onPlay={(track) => onPlay(track, tracks)}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        emptyMessage="No episodes"
      />
    </GenericDetailPage>
  );
}

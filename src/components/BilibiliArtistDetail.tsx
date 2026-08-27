import { useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { filterTracks } from "@/lib/utils/filter-tracks";
import { MusicTrackList } from "@/components/MusicTrackList";
import {
  GenericDetailPage,
  type GenericDetailData,
} from "@/components/GenericDetailPage";
import { MusicCover } from "@/components/MusicCover";
import { Album, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { IS_NATIVE } from "@/lib/api/config";
import {
  getBilibiliUpCollections,
  getBilibiliUpInfo,
  getBilibiliCoverUrl,
  searchBilibiliUpVideos,
  enrichBilibiliSearchResults,
} from "@/lib/bilibili/bilibili-api";
import { normalizeResourceUrl } from "@otter-music/shared";
import { MusicTrack } from "@/types/music";
import { useDetailPage } from "@/hooks/useDetailPage";

interface BilibiliArtistDetailProps {
  id: string | null;
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[]) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}

interface ArtistDetailData {
  name: string;
  faceUrl: string;
  videoCount: number;
}

interface UpCollectionEntry {
  id: string;
  name: string;
  cover: string;
  count: number;
}

export function BilibiliArtistDetail({
  id,
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: BilibiliArtistDetailProps) {
  const navigate = useNavigate();
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCollections, setShowCollections] = useState(false);
  const [collections, setCollections] = useState<UpCollectionEntry[]>([]);
  const [collectionsLoading, setCollectionsLoading] = useState(false);

  const mid = Number(id);
  const validMid = Number.isFinite(mid) ? mid : NaN;

  const { loading, error, detail, tracks, setTracks, retry } =
    useDetailPage<ArtistDetailData>(async () => {
      if (!Number.isFinite(validMid)) throw new Error("Invalid mid");

      pageRef.current = 1;

      const [info, firstPage] = await Promise.all([
        getBilibiliUpInfo(validMid),
        searchBilibiliUpVideos(validMid, 1, 30),
      ]);

      // 回填合集/多分P 专辑信息，供歌曲菜单"专辑"入口使用
      const enrichedTracks = await enrichBilibiliSearchResults(firstPage.items);

      const faceUrl = info?.face
        ? await getBilibiliCoverUrl(normalizeResourceUrl(info.face))
        : "";
      const upName = info?.name || firstPage.items[0]?.artist?.[0] || "";

      return {
        detail: {
          name: upName || "UP 主页",
          faceUrl: faceUrl || "",
          videoCount: firstPage.total ?? 0,
        },
        tracks: enrichedTracks,
      };
    }, [validMid]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !Number.isFinite(validMid)) return;
    setLoadingMore(true);
    try {
      const nextPage = pageRef.current + 1;
      const res = await searchBilibiliUpVideos(
        validMid,
        nextPage,
        30,
        detail?.name || ""
      );
      if (res.items.length > 0) {
        const enriched = await enrichBilibiliSearchResults(res.items);
        setTracks((prev) => [...prev, ...enriched]);
        pageRef.current = nextPage;
      }
    } finally {
      setLoadingMore(false);
    }
  }, [validMid, loadingMore, detail?.name, setTracks]);

  const loadCollections = useCallback(async () => {
    if (!Number.isFinite(validMid) || collectionsLoading) return;
    setCollectionsLoading(true);
    try {
      const entries = await getBilibiliUpCollections(validMid);
      const entriesWithCovers = await Promise.all(
        entries.map(async (entry) => ({
          ...entry,
          cover:
            (await getBilibiliCoverUrl(normalizeResourceUrl(entry.cover))) ||
            entry.cover,
        }))
      );
      setCollections(entriesWithCovers);
    } finally {
      setCollectionsLoading(false);
    }
  }, [validMid, collectionsLoading]);

  const activeTracks = tracks.filter((t) => !t.is_deleted);
  const filteredTracks = useMemo(
    () => filterTracks(activeTracks, searchQuery),
    [activeTracks, searchQuery]
  );

  if (!IS_NATIVE) return null;

  const genericDetail: GenericDetailData | undefined = detail
    ? {
        title: detail.name,
        coverUrl: detail.faceUrl,
        creator: detail.name,
        countDesc: `${detail.videoCount} 个视频`,
        fallbackIcon: <User className="h-8 w-8 text-primary/80" />,
      }
    : undefined;

  const action = (
    <Button
      variant="ghost"
      size="icon"
      className="text-muted-foreground hover:text-foreground"
      onClick={() => {
        setShowCollections(true);
        if (collections.length === 0) loadCollections();
      }}
    >
      <Album className="w-5 h-5" />
    </Button>
  );

  return (
    <>
      <GenericDetailPage
        loading={loading}
        error={error}
        title="UP 主页"
        onBack={onBack}
        onRetry={retry}
        detail={genericDetail}
        scrollRef={scrollRef}
        action={action}
        tracks={activeTracks}
        onPlayTrack={(track) => onPlay(track, activeTracks)}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
      >
        <MusicTrackList
          tracks={filteredTracks}
          onPlay={(track) => onPlay(track, activeTracks)}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          scrollContainerRef={scrollRef}
          onLoadMore={loadMore}
          hasMore={detail ? detail.videoCount > tracks.length : false}
          loading={loading || loadingMore}
          emptyMessage="UP 暂无视频"
        />
      </GenericDetailPage>

      <Drawer open={showCollections} onOpenChange={setShowCollections}>
        <DrawerContent className="border-none rounded-t-[28px] bg-background/95 backdrop-blur-xl max-h-[85vh]">
          <DrawerHeader className="px-6 pt-6 pb-2 text-left">
            <DrawerTitle className="text-xl font-semibold tracking-tight">
              {detail?.name || "合集"}
            </DrawerTitle>
          </DrawerHeader>

          <div className="overflow-y-auto px-4 pb-12 pt-4 [scrollbar-width:none]">
            {collectionsLoading && collections.length === 0 ? (
              <div className="flex justify-center py-16 text-sm tracking-widest text-muted-foreground/40">
                加载中...
              </div>
            ) : collections.length > 0 ? (
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-x-3 gap-y-6">
                {collections.map((entry) => (
                  <button
                    key={entry.id}
                    onClick={() => {
                      setShowCollections(false);
                      navigate(`/bilibili-collection/${entry.id}`);
                    }}
                    className="group flex flex-col gap-2 text-left outline-none"
                  >
                    <div className="relative aspect-square w-full overflow-hidden rounded-xl shadow-sm ring-1 ring-black/5">
                      <MusicCover
                        src={entry.cover}
                        alt={entry.name}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="px-0.5 flex flex-col gap-0.5">
                      <h4 className="text-[13px] font-medium leading-tight line-clamp-2 text-foreground/80">
                        {entry.name}
                      </h4>
                      <p className="text-[10px] text-muted-foreground/60 uppercase tracking-wider">
                        {entry.count} 个视频
                      </p>
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <div className="flex justify-center py-20 text-sm tracking-widest text-muted-foreground/40">
                暂无合集
              </div>
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

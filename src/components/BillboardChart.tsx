import { useCallback, useEffect, useMemo, useState } from "react";
import { PageLayout } from "@/components/PageLayout";
import { MusicPlaylistView } from "@/components/MusicPlaylistView";
import { BillboardEntryGrid } from "@/components/PlaylistMarket/BillboardEntryGrid";
import { Button } from "@/components/ui/button";
import { Import, Loader2, RefreshCw } from "lucide-react";
import { fetchBillboardChart } from "@/lib/billboard/billboard-api";
import { getBillboardChartMeta } from "@/lib/billboard/billboard-charts";
import type { BillboardChartEntry } from "@otter-music/shared";
import type { MusicTrack } from "@/types/music";
import { usePlayContextHandler } from "@/hooks/usePlayContextHandler";
import { useImportPlaylist } from "@/hooks/useImportPlaylist";
import { logger } from "@/lib/logger";

/** 把 Billboard 的歌手串（"Shakira X Burna Boy" / "Sia Featuring Sean Paul"）拆成歌手数组 */
const splitArtists = (artist: string): string[] =>
  artist
    .split(/\s*(?:X|Featuring|Feat\.)\s*|\s*&\s*|\s*\/\s*/i)
    .map((s) => s.trim())
    .filter(Boolean);

/**
 * 榜单条目 -> 占位 MusicTrack。
 * 与文本导入一致：source:"all"、无真实 url；点击播放时 getUrl 失败后由播放器自动换源。
 */
const toMusicTrack = (entry: BillboardChartEntry): MusicTrack => {
  const id = `billboard:${entry.rank}`;
  return {
    id,
    name: entry.title,
    artist: splitArtists(entry.artist),
    album: "",
    pic_id: "",
    url_id: id,
    lyric_id: "",
    source: "all",
  };
};

interface BillboardCoverProps {
  name: string;
  colors: [string, string];
}

/** 深色渐变 + 文字绘制的榜单封面（与广场卡片同款质感） */
const BillboardCover = ({ name, colors }: BillboardCoverProps) => (
  <div
    className="h-full w-full flex flex-col items-center justify-center text-center px-2"
    style={{
      backgroundImage: `linear-gradient(135deg, ${colors[0]}, ${colors[1]})`,
    }}
  >
    <span className="text-white/60 font-black tracking-widest leading-none text-[9px] uppercase">
      Billboard
    </span>
    <span className="text-white font-black tracking-tight leading-tight mt-1.5 text-sm line-clamp-2">
      {name}
    </span>
  </div>
);

interface BillboardChartProps {
  chartId: string;
  date?: string;
  currentTrackId?: string;
  isPlaying?: boolean;
}

/**
 * Billboard 榜单页（按 chartId 参数化）：复用 MusicPlaylistView 渲染，
 * 曲目为 source:"all" 的占位（与文本导入一致），无 url；点击播放由播放器自动换源。
 * date 为历史周榜日期（YYYY-MM-DD），缺省最新一期。
 */
export function BillboardChart({
  chartId,
  date,
  currentTrackId,
  isPlaying,
}: BillboardChartProps) {
  const meta = getBillboardChartMeta(chartId);
  const [entries, setEntries] = useState<BillboardChartEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const tracks = useMemo(() => entries.map(toMusicTrack), [entries]);
  const onPlay = usePlayContextHandler(tracks, `billboard:${chartId}`);
  const importPlaylist = useImportPlaylist();

  const loadChart = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setEntries(await fetchBillboardChart(chartId, date));
    } catch (e) {
      logger.error(
        "Billboard",
        `Load chart ${chartId}${date ? ` at ${date}` : ""} failed`,
        e instanceof Error ? e : undefined
      );
      setError("榜单加载失败，请稍后重试");
    } finally {
      setLoading(false);
    }
  }, [chartId, date]);

  useEffect(() => {
    if (meta) loadChart();
  }, [meta, loadChart]);

  if (!meta) return null;

  // 专辑/歌手榜：条目非歌曲，直接展示封面+名称网格（点击触发搜索），无导入按钮
  if (meta.group !== "songs") {
    return (
      <PageLayout title={`Billboard ${meta.name}`}>
        <div className="p-4 pb-bottom-stack">
          {date && (
            <p className="px-1 mb-3 text-xs text-muted-foreground/60">
              {date} 周榜
            </p>
          )}
          <BillboardEntryGrid
            chartId={meta.id}
            group={meta.group}
            date={date}
          />
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={`Billboard ${meta.name}`}
      action={
        <Button
          variant="ghost"
          size="sm"
          className="h-8 rounded-full text-xs gap-1"
          disabled={tracks.length === 0}
          onClick={() =>
            importPlaylist(`Billboard ${meta.name}`, undefined, tracks)
          }
        >
          <Import className="h-3.5 w-3.5" />
        </Button>
      }
    >
      {loading ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <span className="text-xs tracking-widest uppercase opacity-50">
            加载中...
          </span>
        </div>
      ) : error ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 text-muted-foreground">
          <span className="text-sm">{error}</span>
          <button
            onClick={loadChart}
            className="inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            重新加载
          </button>
        </div>
      ) : (
        <MusicPlaylistView
          title={`Billboard ${meta.name}`}
          description={date ? `${date} 周榜` : undefined}
          tracks={tracks}
          icon={<BillboardCover name={meta.name} colors={meta.colors} />}
          onPlay={onPlay}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
        />
      )}
    </PageLayout>
  );
}

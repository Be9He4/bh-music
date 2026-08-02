import { useState, useEffect, useMemo, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { PageLayout } from "@/components/PageLayout";
import { PageError } from "@/components/PageError";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAlistStore } from "@/store/alist-store";
import { useMusicStore } from "@/store/music-store";
import { listDir, searchFiles, isAudioFile, joinPath } from "@/lib/alist";
import type { AlistServer, AlistFsItem } from "@/types/alist";
import type { MusicTrack } from "@/types/music";
import {
  Loader2,
  Folder,
  Music,
  Play,
  ChevronRight,
  Home,
  Search,
  X,
  ArrowDownAZ,
  FolderPlus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";
import toast from "react-hot-toast";

const splitPath = (path: string) => {
  if (!path || path === "/") return [{ name: "根目录", path: "/" }];
  let acc = "";
  return [
    { name: "根目录", path: "/" },
    ...path
      .split("/")
      .filter(Boolean)
      .map((p) => {
        acc += `/${p}`;
        return { name: p, path: acc };
      }),
  ];
};

const fsItemToTrack = (item: AlistFsItem, server: AlistServer): MusicTrack => {
  const fullPath = joinPath(item.parent, item.name);
  return {
    id: `alist:${server.id}:${fullPath}`,
    name: item.name.replace(/\.[^.]+$/, ""),
    artist: [server.name],
    album: item.parent,
    pic_id: "",
    url_id: fullPath,
    lyric_id: "_alist",
    source: "alist",
  };
};

// 中文数字与单位映射
const CN_DIGITS: Record<string, number> = {
  零: 0,
  一: 1,
  二: 2,
  两: 2,
  三: 3,
  四: 4,
  五: 5,
  六: 6,
  七: 7,
  八: 8,
  九: 9,
};
const CN_UNITS: Record<string, number> = {
  十: 10,
  百: 100,
  千: 1000,
  万: 10000,
  亿: 100000000,
};

const cnNumToInt = (s: string): number => {
  let total = 0,
    section = 0,
    num = 0;
  for (const ch of s) {
    if (ch in CN_DIGITS) {
      num = CN_DIGITS[ch];
      continue;
    }
    if (ch === "十" && num === 0) num = 1;
    const unit = CN_UNITS[ch];
    if (unit >= 10000) {
      section = (section + num) * unit;
      total += section;
      section = 0;
    } else {
      section += (num || 1) * unit;
    }
    num = 0;
  }
  return total + section + num;
};

const toSortKey = (name: string) =>
  name.replace(/[零一二两三四五六七八九十百千万亿]+/g, (m) =>
    String(cnNumToInt(m))
  );

// 自然升序排序函数 (仅需升序逻辑)
const naturalSort = (a: { name: string }, b: { name: string }) =>
  toSortKey(a.name).localeCompare(toSortKey(b.name), "zh-CN", {
    numeric: true,
    sensitivity: "base",
  });

/** 格式化文件大小:< 1MB 显示 KB,≥ 1MB 显示 MB,1 位小数 */
const formatSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return "";
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

/** 从文件路径提取扩展名(小写,无前导点) */
const getFormat = (path: string): string => {
  const m = path.match(/\.([^.]+)$/);
  return m ? m[1].toLowerCase() : "";
};

// --- 公共 UI 组件 ---
const PlayIndicator = () => (
  <div className="flex items-end gap-0.5 h-3 shrink-0 ml-2">
    <span className="w-0.5 h-full bg-primary rounded-full animate-pulse" />
    <span className="w-0.5 h-2/3 bg-primary rounded-full animate-pulse [animation-delay:150ms]" />
    <span className="w-0.5 h-4/5 bg-primary rounded-full animate-pulse [animation-delay:300ms]" />
  </div>
);

const StatusView = ({
  icon: Icon,
  text,
  action,
}: {
  icon?: any;
  text: string;
  action?: React.ReactNode;
}) => (
  <div className="h-40 flex flex-col items-center justify-center gap-3 text-xs text-muted-foreground/60">
    {Icon && <Icon className="h-4 w-4 animate-spin text-primary" />}
    <span>{text}</span>
    {action}
  </div>
);

const LIST_ITEM_CLASS =
  "flex items-center justify-between px-4 py-2.5 hover:bg-accent/40 transition-colors cursor-pointer group";

const DirItem = ({
  name,
  parent,
  onClick,
}: {
  name: string;
  parent?: string;
  onClick: () => void;
}) => (
  <div onClick={onClick} className={LIST_ITEM_CLASS}>
    <div className="flex items-center gap-3 min-w-0 flex-1">
      <Folder className="w-4 h-4 text-amber-500 fill-amber-500/20 shrink-0" />
      <div className="min-w-0">
        <span className="truncate font-medium text-foreground/90 block group-hover:text-foreground">
          {name}
        </span>
        {parent && (
          <span className="text-[11px] text-muted-foreground/50 truncate block">
            {parent}
          </span>
        )}
      </div>
    </div>
    <ChevronRight className="w-4 h-4 text-muted-foreground/30 shrink-0 group-hover:text-muted-foreground transition-transform group-hover:translate-x-0.5" />
  </div>
);

const TrackItem = ({
  track,
  parent,
  size,
  isActive,
  isPlaying,
  onClick,
}: {
  track: MusicTrack;
  parent?: string;
  size?: number;
  isActive: boolean;
  isPlaying?: boolean;
  onClick: () => void;
}) => {
  const fmt = getFormat(track.url_id);
  const sizeStr = formatSize(size);
  return (
    <div
      onClick={onClick}
      className={cn(
        LIST_ITEM_CLASS,
        isActive ? "bg-primary/10 text-primary" : "text-foreground/90"
      )}
    >
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <Music
          className={cn(
            "w-4 h-4 shrink-0",
            isActive
              ? "text-primary"
              : "text-muted-foreground/60 group-hover:text-foreground"
          )}
        />
        <div className="min-w-0">
          <span
            className={cn(
              "truncate font-medium block",
              isActive && "font-semibold"
            )}
          >
            {track.name}
          </span>
          {(parent || sizeStr || fmt) && (
            <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/50 mt-0.5">
              {parent && <span className="truncate">{parent}</span>}
              {sizeStr && (
                <span className="shrink-0 text-muted-foreground/40">
                  {sizeStr}
                </span>
              )}
              {fmt && (
                <span className="shrink-0 uppercase text-[10px] text-muted-foreground/40">
                  {fmt}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
      {isActive && isPlaying ? (
        <PlayIndicator />
      ) : (
        <Play className="w-3.5 h-3.5 text-muted-foreground/30 group-hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
      )}
    </div>
  );
};

export function AlistBrowser({
  serverId,
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: {
  serverId: string;
  onBack: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[], contextId?: string) => void;
  currentTrackId?: string;
  isPlaying?: boolean;
}) {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const servers = useAlistStore((s) => s.servers);
  const createPlaylist = useMusicStore((s) => s.createPlaylist);
  const addBatchToPlaylist = useMusicStore((s) => s.addBatchToPlaylist);
  const scrollRef = useRef<HTMLDivElement>(null);

  const server = useMemo(
    () => servers.find((s) => s.id === serverId && !s.is_deleted) ?? null,
    [servers, serverId]
  );
  const currentPath = searchParams.get("path") || server?.rootPath || "/";
  const breadcrumbs = useMemo(() => splitPath(currentPath), [currentPath]);

  const [loadState, setLoadState] = useState({
    path: "",
    items: [] as AlistFsItem[],
    error: false,
  });
  const [searchInput, setSearchInput] = useState("");
  const [searchState, setSearchState] = useState({
    query: null as string | null,
    results: [] as AlistFsItem[],
    loading: false,
    error: false,
  });
  const [isSorted, setIsSorted] = useState(false); // 排序状态：false:默认原有顺序, true:升序

  // 拉取目录
  useEffect(() => {
    if (!server) return;
    const controller = new AbortController();
    listDir(server, currentPath, 1, 0)
      .then(
        (items) =>
          !controller.signal.aborted &&
          setLoadState({ path: currentPath, items, error: false })
      )
      .catch((e) => {
        if (controller.signal.aborted) return;
        logger.error("alist", "listDir failed", String(e), {
          serverId,
          path: currentPath,
        });
        setLoadState({ path: currentPath, items: [], error: true });
      });
    return () => controller.abort();
  }, [server, currentPath, serverId]);

  const isLoaded = loadState.path === currentPath;
  const keyword = searchInput.trim().toLowerCase();

  // 数据过滤与自然排序,同时构建 trackId → size 映射供 TrackItem 展示
  const { subDirs, audioTracks, sizeMap } = useMemo(() => {
    if (!server || !isLoaded)
      return {
        subDirs: [],
        audioTracks: [],
        sizeMap: new Map<string, number>(),
      };
    const dirs: AlistFsItem[] = [];
    const tracks: MusicTrack[] = [];
    const sizeMap = new Map<string, number>();

    for (const item of loadState.items) {
      if (keyword && !item.name.toLowerCase().includes(keyword)) continue;
      if (item.is_dir) {
        dirs.push(item);
      } else if (isAudioFile(item.name)) {
        const track = fsItemToTrack(item, server);
        tracks.push(track);
        if (item.size) sizeMap.set(track.id, item.size);
      }
    }

    if (isSorted) {
      dirs.sort(naturalSort);
      tracks.sort(naturalSort);
    }

    return { subDirs: dirs, audioTracks: tracks, sizeMap };
  }, [isLoaded, loadState.items, server, keyword, isSorted]);

  const globalAudioTracks = useMemo(() => {
    if (!server) return [];
    const tracks = searchState.results.filter(
      (item) => !item.is_dir && isAudioFile(item.name)
    );
    if (isSorted) tracks.sort(naturalSort);
    return tracks.map((item) => fsItemToTrack(item, server));
  }, [searchState.results, server, isSorted]);

  const playableTracks =
    searchState.query !== null ? globalAudioTracks : audioTracks;

  // 搜索处理逻辑
  const clearSearch = () => {
    setSearchInput("");
    setSearchState({ query: null, results: [], loading: false, error: false });
  };

  const handleSearchSubmit = async () => {
    const kw = searchInput.trim();
    if (!kw || !server) return;
    setSearchState((s) => ({ ...s, query: kw, loading: true, error: false }));
    try {
      const results = await searchFiles(server, kw, 0, 1, 50, currentPath);
      setSearchState((s) => ({ ...s, results, loading: false }));
    } catch (e) {
      logger.error("alist", "searchFiles failed", String(e), {
        serverId,
        keyword: kw,
      });
      setSearchState((s) => ({
        ...s,
        results: [],
        loading: false,
        error: true,
      }));
    }
  };

  const navigateToDir = (path: string) => {
    clearSearch();
    setSearchParams({ path });
  };

  /** 把当前可见音频列表一次性导入为普通歌单(快照,不与 Alist 同步) */
  const handleImportToPlaylist = () => {
    if (!server || playableTracks.length === 0) return;
    const dirName =
      searchState.query !== null
        ? `搜索:${searchState.query}`
        : currentPath.split("/").filter(Boolean).pop() || "根目录";
    const playlistName = `${server.name} · ${dirName}`;
    try {
      const id = createPlaylist(playlistName);
      addBatchToPlaylist(id, playableTracks);
      toast.success(`已导入歌单「${playlistName}」`);
    } catch (e) {
      logger.error("alist", "import to playlist failed", String(e), {
        serverId: server.id,
        path: currentPath,
      });
      toast.error("导入失败,请重试");
    }
  };

  // 渲染主体内容(扁平化)
  const renderContent = () => {
    if (searchState.query !== null) {
      if (searchState.loading)
        return <StatusView icon={Loader2} text="搜索中..." />;
      if (searchState.error)
        return (
          <StatusView
            text="搜索失败，请检查站点与网络"
            action={
              <Button variant="outline" size="sm" onClick={handleSearchSubmit}>
                重试
              </Button>
            }
          />
        );

      const validResults = searchState.results.filter(
        (item) => item.is_dir || isAudioFile(item.name)
      );
      if (isSorted) validResults.sort(naturalSort);

      if (!validResults.length) return <StatusView text="未找到匹配结果" />;

      return (
        <div>
          <div className="flex items-center justify-between px-4 py-2 text-[11px] text-muted-foreground/60 border-b border-border/30">
            <span>
              搜索「{searchState.query}」 · {globalAudioTracks.length} 首
            </span>
          </div>
          <div className="divide-y divide-border/30 text-sm">
            {validResults.map((item) =>
              item.is_dir ? (
                <DirItem
                  key={joinPath(item.parent, item.name)}
                  name={item.name}
                  parent={item.parent}
                  onClick={() =>
                    navigateToDir(joinPath(item.parent, item.name))
                  }
                />
              ) : (
                <TrackItem
                  key={item.name}
                  parent={item.parent}
                  size={item.size}
                  track={fsItemToTrack(item, server!)}
                  isActive={currentTrackId === fsItemToTrack(item, server!).id}
                  isPlaying={isPlaying}
                  onClick={() =>
                    onPlay(
                      fsItemToTrack(item, server!),
                      globalAudioTracks,
                      "alist"
                    )
                  }
                />
              )
            )}
          </div>
        </div>
      );
    }

    if (!isLoaded) return <StatusView icon={Loader2} text="加载中..." />;
    if (loadState.error) return <PageError onRetry={() => navigate(0)} />;
    if (!subDirs.length && !audioTracks.length)
      return (
        <StatusView text={keyword ? "无匹配结果" : "此目录暂无音频文件"} />
      );

    return (
      <div>
        <div className="flex items-center justify-between px-4 py-2 text-[11px] text-muted-foreground/60 border-b border-border/30">
          <span>
            {subDirs.length > 0 && `${subDirs.length} 个文件夹`}
            {subDirs.length > 0 && audioTracks.length > 0 && " · "}
            {audioTracks.length > 0 && `${audioTracks.length} 首`}
          </span>
        </div>
        <div className="divide-y divide-border/30 text-sm">
          {subDirs.map((dir) => (
            <DirItem
              key={dir.name}
              name={dir.name}
              onClick={() => navigateToDir(joinPath(dir.parent, dir.name))}
            />
          ))}
          {audioTracks.map((track) => (
            <TrackItem
              key={track.id}
              track={track}
              size={sizeMap.get(track.id)}
              isActive={currentTrackId === track.id}
              isPlaying={isPlaying}
              onClick={() => onPlay(track, audioTracks, "alist")}
            />
          ))}
        </div>
      </div>
    );
  };

  if (!server) {
    return (
      <PageLayout title="Alist" onBack={() => navigate("/search")}>
        <PageError onBack={onBack} />
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={server.name}
      onBack={() => navigate("/search")}
      action={
        playableTracks.length > 0 ? (
          <div className="flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-primary"
              onClick={handleImportToPlaylist}
              title="导入歌单"
            >
              <FolderPlus className="w-4 h-4" />
            </Button>
          </div>
        ) : undefined
      }
    >
      {/* 面包屑 */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-border/30 overflow-x-auto no-scrollbar bg-background/50 text-xs">
        {breadcrumbs.map((crumb, idx) => (
          <div key={crumb.path} className="flex items-center gap-1.5 shrink-0">
            <button
              className={cn(
                "inline-flex items-center gap-1 transition-colors hover:text-foreground",
                idx === breadcrumbs.length - 1
                  ? "font-medium text-foreground"
                  : "text-muted-foreground/80"
              )}
              onClick={() => navigateToDir(crumb.path)}
            >
              {idx === 0 && <Home className="w-3.5 h-3.5" />}
              {crumb.name}
            </button>
            {idx < breadcrumbs.length - 1 && (
              <ChevronRight className="w-3 h-3 text-muted-foreground/40" />
            )}
          </div>
        ))}
      </div>

      {/* 搜索栏 + 排序按钮 */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border/30 bg-background/50">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/50 pointer-events-none" />
          <Input
            className="pl-9 pr-8 h-9 bg-background/60"
            placeholder="回车搜索当前目录"
            value={searchInput}
            onChange={(e) => {
              setSearchInput(e.target.value);
              if (!e.target.value) clearSearch();
            }}
            onKeyDown={(e) => e.key === "Enter" && handleSearchSubmit()}
          />
          {searchInput && (
            <button
              onClick={clearSearch}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 rounded-full text-muted-foreground/50 hover:text-foreground transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <Button
          variant="outline"
          size="icon"
          className={cn(
            "h-9 w-9 shrink-0 bg-background/60 transition-colors",
            isSorted
              ? "text-primary border-primary/50"
              : "text-muted-foreground hover:text-foreground"
          )}
          onClick={() => setIsSorted(!isSorted)}
          title={
            isSorted
              ? "当前为升序，点击恢复默认顺序"
              : "当前为默认顺序，点击切换升序"
          }
        >
          <ArrowDownAZ className="w-4 h-4" />
        </Button>
      </div>

      {/* 目录列表 */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto pb-bottom-stack">
        {renderContent()}
      </div>
    </PageLayout>
  );
}

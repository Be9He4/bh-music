"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import {
  RefreshCw,
  Music,
  HardDrive,
  HardDriveDownload,
  WifiOff,
  FolderX,
  Plus,
  Trash2,
  ChevronDown,
} from "lucide-react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { LocalMusicPlugin, LocalMusicFile } from "@/plugins/local-music";
import { MusicTrack } from "@/types/music";
import { MusicPlaylistView } from "./MusicPlaylistView";
import { cn } from "@/lib/utils";
import { PageLayout } from "./PageLayout";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import toast from "react-hot-toast";
import { convertToMusicTrack } from "@/lib/utils/download";
import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { getPlayAllStartIndex } from "@/hooks/usePlayHelper";
import { useLocalMusicStore } from "@/store/local-music-store";
import { LocalMusicPermissionDialog } from "./LocalMusicPermissionDialog";
import { logger } from "@/lib/logger";
import { useNavigate } from "react-router-dom";

function mergeLocalMusicFiles(
  oldFiles: LocalMusicFile[],
  newFiles: LocalMusicFile[]
): LocalMusicFile[] {
  const oldMap = new Map(oldFiles.map((f) => [f.localPath, f]));
  return newFiles.map((newFile) => {
    const oldFile = oldMap.get(newFile.localPath);
    if (!oldFile) return newFile;
    return {
      ...oldFile,
      ...newFile,
      name: newFile.name || oldFile.name,
      artist: newFile.artist || oldFile.artist,
      album: newFile.album || oldFile.album,
      duration: newFile.duration || oldFile.duration,
      fileSize: newFile.fileSize || oldFile.fileSize,
      modifiedTime: newFile.modifiedTime || oldFile.modifiedTime,
    };
  });
}

interface LocalMusicPageProps {
  onBack?: () => void;
  onPlay: (track: MusicTrack, list: MusicTrack[], contextId?: string) => void;
  currentTrackId?: string;
  isPlaying: boolean;
}

export function LocalMusicPage({
  onBack,
  onPlay,
  currentTrackId,
  isPlaying,
}: LocalMusicPageProps) {
  /* --- 状态 --- */
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);

  // 删除状态（统一为数组，单删/批删复用）
  const [deleteTargets, setDeleteTargets] = useState<MusicTrack[]>([]);
  const [deleteLocalFile, setDeleteLocalFile] = useState(false);
  const singleDeleteTarget =
    deleteTargets.length === 1 ? deleteTargets[0] : null;

  // 扫描与排除目录状态
  const [scanDrawerOpen, setScanDrawerOpen] = useState(false);
  const [excludedFolders, setExcludedFolders] = useState<string[]>([]);
  const [excludedExpanded, setExcludedExpanded] = useState(false);
  const [pickingFolder, setPickingFolder] = useState(false);
  const [excludedLoading, setExcludedLoading] = useState(false);

  /* --- Store --- */
  const { queue, currentIndex, skipToNext, isShuffle } = useMusicStore(
    useShallow((state) => ({
      queue: state.queue,
      currentIndex: state.currentIndex,
      skipToNext: state.skipToNext,
      isShuffle: state.isShuffle,
    }))
  );
  const { files, setFiles, updateFiles, setScanning } = useLocalMusicStore();
  const navigate = useNavigate();

  /* --- 扫描逻辑 --- */
  const performScan = useCallback(
    async (type: "quick" | "full") => {
      setIsLoading(true);
      setError(null);
      setScanning(true, type);

      try {
        const result =
          type === "quick"
            ? await LocalMusicPlugin.scanLocalMusic()
            : await LocalMusicPlugin.scanAllStorage();

        if (result.success) {
          const merged =
            type === "full"
              ? mergeLocalMusicFiles(files, result.files)
              : result.files;
          setFiles(merged);
          return merged.length;
        }

        if (result.needManageStorage) {
          setShowPermissionDialog(true);
          throw new Error(result.error || "需要授予存储权限");
        }
        throw new Error(result.error || "扫描失败");
      } catch (err: any) {
        const message = err.message || String(err);
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
        setScanning(false);
      }
    },
    [files, setFiles, setScanning]
  );

  const initRef = useRef(false);
  useEffect(() => {
    if (initRef.current || files.length > 0) return;
    initRef.current = true;

    performScan("quick").catch((err) => {
      logger.error("LocalMusicPage", "Initial local music scan failed", err);
    });
  }, [files.length, performScan]);

  const handleScan = (type: "quick" | "full") => {
    if (isLoading) return;
    toast.promise(performScan(type), {
      loading: type === "full" ? "全盘扫描中..." : "正在扫描本地音乐...",
      success: (count) =>
        count === 0 ? "未找到本地音乐" : `找到 ${count} 首本地音乐`,
      error: (err) => err.message,
    });
  };

  /* --- 删除逻辑 --- */
  const removeLocalTrack = useCallback(
    async (track: MusicTrack, shouldDeleteFile: boolean) => {
      if (!track.url_id) throw new Error("缺少文件路径");
      try {
        if (shouldDeleteFile) {
          const result = await LocalMusicPlugin.deleteLocalMusic({
            localPath: track.url_id,
          });
          if (!result.success) throw new Error(result.error || "删除失败");
        }
        updateFiles((prev) => prev.filter((f) => f.localPath !== track.url_id));
        if (queue[currentIndex]?.id === track.id) skipToNext();
      } catch (error) {
        logger.error("LocalMusicPage", "Delete local track failed", error, {
          trackId: track.id,
          localPath: track.url_id,
        });
        throw error;
      }
    },
    [currentIndex, queue, skipToNext, updateFiles]
  );

  const resetDeleteState = () => {
    setDeleteTargets([]);
    setDeleteLocalFile(false);
  };

  const confirmDeleteTracks = async () => {
    if (!deleteTargets.length) return;
    const promise = Promise.all(
      deleteTargets.map((t) => removeLocalTrack(t, deleteLocalFile))
    ).then(resetDeleteState);

    toast.promise(promise, {
      loading: deleteLocalFile ? "正在删除文件..." : "正在移除...",
      success: deleteLocalFile ? "已删除文件" : "已从列表移除",
      error: (err) => err.message,
    });
    await promise;
  };

  /* --- 排除目录逻辑 --- */
  const loadExcludedFolders = useCallback(async () => {
    setExcludedLoading(true);
    try {
      const result = await LocalMusicPlugin.getExcludedFolders();
      if (result.success) setExcludedFolders(result.folders);
    } catch (err) {
      logger.warn("LocalMusicPage", "加载排除目录失败", { err });
    } finally {
      setExcludedLoading(false);
    }
  }, []);

  useEffect(() => {
    if (scanDrawerOpen) loadExcludedFolders();
  }, [scanDrawerOpen, loadExcludedFolders]);

  const handlePickExcluded = useCallback(async () => {
    setPickingFolder(true);
    try {
      const result = await LocalMusicPlugin.pickExcludedDirectory();
      if (result.success && result.path) await loadExcludedFolders();
    } catch (err) {
      logger.warn("LocalMusicPage", "选择排除目录失败", { err });
    } finally {
      setPickingFolder(false);
    }
  }, [loadExcludedFolders]);

  const handleRemoveExcluded = useCallback(async (folder: string) => {
    try {
      await LocalMusicPlugin.removeExcludedFolder({ folder });
      setExcludedFolders((prev) => prev.filter((f) => f !== folder));
    } catch (err) {
      logger.warn("LocalMusicPage", "移除排除目录失败", { err, folder });
    }
  }, []);

  /* --- 数据转换与播放 --- */
  const tracks = useMemo(
    () =>
      files
        .map((file, index) => ({ file, index }))
        .sort(
          (a, b) =>
            (b.file.modifiedTime ?? -Infinity) -
              (a.file.modifiedTime ?? -Infinity) || a.index - b.index
        )
        .map(({ file }) => convertToMusicTrack(file)),
    [files]
  );

  const handlePlay = (track: MusicTrack | null, index?: number) => {
    const targetTrack =
      track ||
      (index !== undefined
        ? tracks[index]
        : tracks[getPlayAllStartIndex(tracks.length, isShuffle)]);
    if (targetTrack) onPlay(targetTrack, tracks, "local");
  };

  /* --- 渲染部分 --- */
  const isEmpty = files.length === 0;

  return (
    <PageLayout
      title="本地音乐"
      onBack={onBack}
      action={
        <button
          onClick={() => setScanDrawerOpen(true)}
          disabled={isLoading}
          className={cn(
            "flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg",
            isLoading && "opacity-50 cursor-not-allowed"
          )}
        >
          <HardDrive className="h-3.5 w-3.5" />
          全盘扫描
        </button>
      }
    >
      {/* 状态视图与内容视图 */}
      {isLoading && isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <RefreshCw className="h-10 w-10 text-primary/80 animate-spin" />
          <p className="text-foreground text-sm font-medium">
            正在扫描本地音乐...
          </p>
        </div>
      ) : error && isEmpty ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center px-6">
          <Music className="h-14 w-14 text-muted-foreground/30 mb-4" />
          <p className="text-sm mb-2">{error}</p>
          <button
            onClick={() => handleScan("quick")}
            className="px-4 py-2 bg-primary text-white rounded-lg"
          >
            重试
          </button>
        </div>
      ) : (
        <MusicPlaylistView
          title="本地音乐"
          tracks={tracks}
          icon={<HardDriveDownload className="h-8 w-8 text-primary/80" />}
          onPlay={handlePlay}
          currentTrackId={currentTrackId}
          isPlaying={isPlaying}
          onRemove={(track) => setDeleteTargets([track])}
          onBatchRemove={setDeleteTargets}
          removeLabel="删除"
          confirmRemove={false}
          action={
            <button
              onClick={() => navigate("/playlist/__offline__")}
              className="flex items-center gap-1.5 px-3 h-8 rounded-full text-xs text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
            >
              <WifiOff size={14} className="shrink-0" />
            </button>
          }
        />
      )}

      {/* 弹窗及抽屉 */}
      <LocalMusicPermissionDialog
        open={showPermissionDialog}
        onOpenChange={setShowPermissionDialog}
      />

      <Dialog
        open={deleteTargets.length > 0}
        onOpenChange={(open) => !open && resetDeleteState()}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {singleDeleteTarget
                ? `删除《${singleDeleteTarget.name}》`
                : `删除选中的 ${deleteTargets.length} 首歌曲`}
            </DialogTitle>
            <DialogDescription>
              默认只从当前列表移除，重新扫描后可能再次出现。
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              checked={deleteLocalFile}
              onCheckedChange={(checked) =>
                setDeleteLocalFile(checked === true)
              }
            />
            <span className="text-sm">同时删除本地文件</span>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={resetDeleteState}>
              取消
            </Button>
            <Button variant="destructive" onClick={confirmDeleteTracks}>
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Drawer open={scanDrawerOpen} onOpenChange={setScanDrawerOpen}>
        <DrawerContent className="outline-none">
          <DrawerHeader className="px-5 pt-6 pb-2">
            <DrawerTitle className="text-lg font-semibold text-center">
              全盘扫描
            </DrawerTitle>
          </DrawerHeader>
          <div className="px-5 py-4 space-y-4">
            <ExcludedFoldersSection
              folders={excludedFolders}
              loading={excludedLoading}
              picking={pickingFolder}
              isExpanded={excludedExpanded}
              onToggleExpand={() => setExcludedExpanded((v) => !v)}
              onPick={handlePickExcluded}
              onRemove={handleRemoveExcluded}
            />
            <button
              type="button"
              onClick={() => {
                setScanDrawerOpen(false);
                handleScan("full");
              }}
              disabled={isLoading}
              className="w-full h-10 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              <HardDrive className="h-4 w-4" />
              {isLoading ? "扫描中..." : "开始扫描"}
            </button>
          </div>
          <div className="h-6" />
        </DrawerContent>
      </Drawer>
    </PageLayout>
  );
}

/* --- 排除目录子组件保持原样但结构紧凑 --- */
interface ExcludedFoldersSectionProps {
  folders: string[];
  loading: boolean;
  picking: boolean;
  isExpanded: boolean;
  onToggleExpand: () => void;
  onPick: () => void;
  onRemove: (folder: string) => void;
}

function ExcludedFoldersSection({
  folders,
  loading,
  picking,
  isExpanded,
  onToggleExpand,
  onPick,
  onRemove,
}: ExcludedFoldersSectionProps) {
  const count = folders.length;
  return (
    <div className="rounded-lg border border-border/50 bg-card/40">
      <button
        type="button"
        onClick={onToggleExpand}
        className="w-full flex items-center gap-2 px-3 py-2.5 text-left"
      >
        <div className="h-7 w-7 rounded-md bg-primary/10 flex items-center justify-center shrink-0 flex-[0_0_28px] min-w-7 min-h-7">
          <div className="h-3.5 w-3.5 shrink-0 flex-[0_0_14px] min-w-3.5 min-h-3.5">
            <FolderX className="h-full w-full text-primary" />
          </div>
        </div>
        <div className="flex flex-col min-w-0 flex-1">
          <span className="text-sm text-foreground">排除目录</span>
          <span className="text-xs text-muted-foreground truncate">
            {count > 0 ? `已排除 ${count} 个目录` : "使用默认通话录音黑名单"}
          </span>
        </div>
        <ChevronDown
          className={cn(
            "h-4 w-4 text-muted-foreground transition-transform duration-200",
            isExpanded && "rotate-180"
          )}
        />
      </button>

      <div
        className={cn(
          "grid transition-all duration-200 ease-in-out",
          isExpanded
            ? "grid-rows-[1fr] opacity-100"
            : "grid-rows-[0fr] opacity-0"
        )}
      >
        <div className="overflow-hidden">
          <div className="px-3 pb-3 pt-1 space-y-3 border-t border-border/40">
            <button
              type="button"
              onClick={onPick}
              disabled={picking || loading}
              className="w-full h-8 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors disabled:opacity-50 flex items-center justify-center gap-1.5"
            >
              <Plus className="h-3.5 w-3.5" />
              {picking ? "选择中..." : "选择目录"}
            </button>
            <div className="space-y-1.5 max-h-56 overflow-y-auto">
              {count === 0 && !loading && (
                <div className="text-xs text-muted-foreground text-center py-3">
                  暂无自定义排除目录
                </div>
              )}
              {folders.map((folder) => (
                <div
                  key={folder}
                  className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-md bg-muted/40 border border-border/40"
                >
                  <span className="text-xs truncate flex-1" title={folder}>
                    {folder}
                  </span>
                  <button
                    type="button"
                    onClick={() => onRemove(folder)}
                    className="p-1 text-muted-foreground hover:text-foreground shrink-0"
                    title="移除"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

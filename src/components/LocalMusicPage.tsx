"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { RefreshCw, Music, HardDrive, HardDriveDownload } from "lucide-react";
import { LocalMusicPlugin } from "@/plugins/local-music";
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
import { useLocalMusicStore } from "@/store/local-music-store";
import { LocalMusicPermissionDialog } from "./LocalMusicPermissionDialog";
import { logger } from "@/lib/logger";

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
  /* =========================
     UI 状态
  ========================= */
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPermissionDialog, setShowPermissionDialog] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MusicTrack | null>(null);
  const [deleteTargets, setDeleteTargets] = useState<MusicTrack[]>([]);
  const [deleteLocalFile, setDeleteLocalFile] = useState(false);

  /* =========================
     Store
  ========================= */
  const { queue, currentIndex, skipToNext } = useMusicStore();
  const { files, setFiles, updateFiles, setScanning } = useLocalMusicStore();

  /* =========================
     扫描逻辑（单一职责）
  ========================= */
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
          setFiles(result.files);
          return result.files.length;
        }

        if (result.needManageStorage) {
          setShowPermissionDialog(true);
          throw new Error(result.error || "需要授予存储权限");
        }

        throw new Error(result.error || "扫描失败");
      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : String(err);
        setError(message);
        throw err;
      } finally {
        setIsLoading(false);
        setScanning(false);
      }
    },
    [setFiles, setScanning]
  );

  /* =========================
     初始化扫描（安全写法）
  ========================= */
  const initRef = useRef(false);

  useEffect(() => {
    if (initRef.current || files.length > 0) return;
    initRef.current = true;

    let mounted = true;

    (async () => {
      try {
        await performScan("quick");
      } catch (err) {
        if (mounted) {
          logger.error(
            "LocalMusicPage",
            "Initial local music scan failed",
            err
          );
        }
      }
    })();

    return () => {
      mounted = false;
    };
  }, [files.length, performScan]);

  /* =========================
     手动扫描（带 toast）
  ========================= */
  const handleScan = (type: "quick" | "full") => {
    if (isLoading) return;

    toast.promise(performScan(type), {
      loading: type === "full" ? "全盘扫描中..." : "正在扫描本地音乐...",
      success: (count: number) =>
        count === 0 ? "未找到本地音乐" : `找到 ${count} 首本地音乐`,
      error: (err: Error) => err.message,
    });
  };

  /* =========================
     删除
  ========================= */
  /** 从当前本地音乐列表移除歌曲，按需删除物理文件。 */
  const removeLocalTrack = useCallback(
    async (track: MusicTrack, shouldDeleteFile: boolean) => {
      const localPath = track.url_id;
      if (!localPath) {
        throw new Error("缺少文件路径");
      }

      try {
        if (shouldDeleteFile) {
          const result = await LocalMusicPlugin.deleteLocalMusic({ localPath });

          if (!result.success) {
            throw new Error(result.error || "删除失败");
          }
        }

        updateFiles((prev) => prev.filter((f) => f.localPath !== localPath));

        const currentTrack = queue[currentIndex];
        if (currentTrack?.id === track.id) {
          skipToNext();
        }
      } catch (error) {
        logger.error("LocalMusicPage", "Delete local track failed", error, {
          trackId: track.id,
          localPath,
        });
        throw error;
      }
    },
    [currentIndex, queue, skipToNext, updateFiles]
  );

  /** 打开本地音乐删除确认弹窗。 */
  const handleDeleteTrack = (track: MusicTrack) => {
    setDeleteTarget(track);
    setDeleteTargets([track]);
    setDeleteLocalFile(false);
  };

  /** 打开本地音乐批量删除确认弹窗。 */
  const handleBatchDeleteTracks = (tracks: MusicTrack[]) => {
    setDeleteTarget(null);
    setDeleteTargets(tracks);
    setDeleteLocalFile(false);
  };

  /** 执行已确认的本地音乐删除操作。 */
  const confirmDeleteTracks = async () => {
    const targets = deleteTargets;
    if (targets.length === 0) return;

    const promise = (async () => {
      for (const track of targets) {
        await removeLocalTrack(track, deleteLocalFile);
      }
      setDeleteTarget(null);
      setDeleteTargets([]);
      setDeleteLocalFile(false);
    })();

    toast.promise(promise, {
      loading: deleteLocalFile ? "正在删除文件..." : "正在移除...",
      success: deleteLocalFile ? "已删除文件" : "已从列表移除",
      error: (err: Error) => err.message,
    });

    await promise;
  };

  /* =========================
     转换数据
  ========================= */
  const tracks = useMemo(
    () =>
      files
        .map((file, index) => ({ file, index }))
        .sort((a, b) => {
          const aTime = a.file.modifiedTime ?? Number.NEGATIVE_INFINITY;
          const bTime = b.file.modifiedTime ?? Number.NEGATIVE_INFINITY;
          return bTime - aTime || a.index - b.index;
        })
        .map(({ file }) => convertToMusicTrack(file)),
    [files]
  );

  const handlePlay = (track: MusicTrack | null, index?: number) => {
    if (track) {
      onPlay(track, tracks, "local");
      return;
    }

    if (index !== undefined && tracks[index]) {
      onPlay(tracks[index], tracks, "local");
      return;
    }

    if (tracks.length > 0) {
      onPlay(tracks[0], tracks, "local");
    }
  };

  /* =========================
     UI
  ========================= */

  if (isLoading && files.length === 0) {
    return (
      <PageLayout title="本地音乐" onBack={onBack}>
        <div className="flex-1 flex flex-col items-center justify-center gap-4">
          <RefreshCw className="h-10 w-10 text-primary/80 animate-spin" />
          <p className="text-foreground text-sm font-medium">
            正在扫描本地音乐...
          </p>
        </div>
      </PageLayout>
    );
  }

  if (error && files.length === 0) {
    return (
      <PageLayout title="本地音乐" onBack={onBack}>
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
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title="本地音乐"
      onBack={onBack}
      action={
        <button
          onClick={() => handleScan("full")}
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
      <MusicPlaylistView
        title="本地音乐"
        tracks={tracks}
        icon={<HardDriveDownload className="h-8 w-8 text-primary/80" />}
        onPlay={handlePlay}
        currentTrackId={currentTrackId}
        isPlaying={isPlaying}
        onRemove={handleDeleteTrack}
        onBatchRemove={handleBatchDeleteTracks}
        removeLabel="删除"
        confirmRemove={false}
      />

      <LocalMusicPermissionDialog
        open={showPermissionDialog}
        onOpenChange={setShowPermissionDialog}
      />

      <Dialog
        open={deleteTargets.length > 0}
        onOpenChange={(open) => {
          if (open) return;
          setDeleteTarget(null);
          setDeleteTargets([]);
          setDeleteLocalFile(false);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {deleteTarget
                ? `删除《${deleteTarget.name}》`
                : `删除选中的 ${deleteTargets.length} 首歌曲`}
            </DialogTitle>
            <DialogDescription>
              默认只从当前列表移除，重新扫描后可能再次出现。
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 py-2">
            <Checkbox
              data-testid="delete-local-file"
              checked={deleteLocalFile}
              onCheckedChange={(checked) =>
                setDeleteLocalFile(checked === true)
              }
            />
            <span className="text-sm">同时删除本地文件</span>
          </div>
          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteTarget(null);
                setDeleteTargets([]);
                setDeleteLocalFile(false);
              }}
            >
              取消
            </Button>
            <Button
              variant="destructive"
              data-testid="confirm-local-delete"
              onClick={confirmDeleteTracks}
            >
              删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </PageLayout>
  );
}

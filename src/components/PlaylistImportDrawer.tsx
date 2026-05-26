import { useState, useEffect, useRef } from "react";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerFooter,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Link2, Loader2, Music4, Upload } from "lucide-react";
import { useMusicStore } from "@/store/music-store";
import { toastUtils } from "@/lib/utils/toast";
import { logger } from "@/lib/logger";
import { detectPlatform, type Platform } from "@/lib/platform-detector";
import {
  resolveUrl,
  getPlaylistDetail,
  convertSongToMusicTrack,
} from "@/lib/netease/netease-api";
import {
  parseQqMusicUrl,
  getQqPlaylistDetail,
  convertQqSongToMusicTrack,
} from "@/lib/qqmusic/qqmusic-api";
import {
  resolveKugouPlaylistId,
  getKugouPlaylistDetail,
  convertKugouSongToMusicTrack,
} from "@/lib/kugou/kugou-api";
import {
  parseKuwoPlaylistUrl,
  getKuwoPlaylistDetail,
  convertKuwoSongToMusicTrack,
} from "@/lib/kuwo/kuwo-api";
import {
  resolveMiguPlaylistId,
  getMiguPlaylistDetail,
  convertMiguSongToMusicTrack,
} from "@/lib/migu/migu-api";
import { importPlaylist } from "@/lib/utils/playlist-backup";
import type { MusicTrack } from "@/types/music";

function parseInput(text: string) {
  const raw = text.trim();
  const urlMatch = raw.match(/https?:\/\/[^\s]+/i);
  if (!urlMatch) return "";
  return urlMatch[0];
}

const PLATFORM_LABELS: Record<Platform, string> = {
  netease: "网易云音乐",
  qq: "QQ音乐",
  kugou: "酷狗音乐",
  kuwo: "酷我音乐",
  migu: "咪咕音乐",
};

type Phase = "input" | "loading" | "preview" | "error" | "importing";

interface PlaylistPreview {
  name: string;
  coverUrl: string;
  trackCount: number;
  tracks: MusicTrack[];
  platform: Platform;
}

interface PlaylistImportDrawerProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function PlaylistImportDrawer({
  open,
  onOpenChange,
}: PlaylistImportDrawerProps) {
  const [url, setUrl] = useState("");
  const [phase, setPhase] = useState<Phase>("input");
  const [preview, setPreview] = useState<PlaylistPreview | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setUrl("");
    setPhase("input");
    setPreview(null);
    setErrorMsg("");
  };

  const handleClose = () => {
    onOpenChange(false);
    reset();
  };

  // 自动读取剪贴板：从混合文本中提取 URL
  useEffect(() => {
    if (!open) return;
    navigator.clipboard
      ?.readText?.()
      .then((text) => {
        const url = parseInput(text);
        if (url && detectPlatform(url)) {
          setUrl(url);
          toastUtils.success("已自动填充链接", { id: "clipboard-import" });
        }
      })
      .catch(() => {});
  }, [open]);

  const handleFetch = async () => {
    const trimmed = url.trim();
    if (!trimmed) return;

    const platform = detectPlatform(trimmed);
    if (!platform) {
      setErrorMsg(
        "不支持的链接格式，目前支持网易云音乐、QQ音乐、酷狗音乐、酷我音乐和咪咕音乐的歌单链接"
      );
      setPhase("error");
      return;
    }

    setPhase("loading");

    try {
      if (platform === "netease") {
        const resolved = resolveUrl(trimmed);
        if (!resolved) {
          setErrorMsg("无法解析此链接");
          setPhase("error");
          return;
        }
        if (resolved.type !== "playlist") {
          setErrorMsg("此链接为单曲或专辑，暂仅支持歌单导入");
          setPhase("error");
          return;
        }

        const detail = await getPlaylistDetail(resolved.id);
        if (!detail) {
          setErrorMsg("获取歌单信息失败");
          setPhase("error");
          return;
        }
        if (!detail.tracks?.length) {
          setErrorMsg("歌单为空，无法导入");
          setPhase("error");
          return;
        }

        const tracks = detail.tracks.map(convertSongToMusicTrack);
        setPreview({
          name: detail.name,
          coverUrl: detail.coverImgUrl || "",
          trackCount: detail.trackCount || tracks.length,
          tracks,
          platform,
        });
      } else if (platform === "qq") {
        const playlistId = parseQqMusicUrl(trimmed);
        if (!playlistId) {
          setErrorMsg("无法从此链接提取歌单ID");
          setPhase("error");
          return;
        }

        const detail = await getQqPlaylistDetail(playlistId);
        if (!detail.songs?.length) {
          setErrorMsg("歌单为空，无法导入");
          setPhase("error");
          return;
        }

        const tracks = detail.songs.map(convertQqSongToMusicTrack);
        setPreview({
          name: detail.name,
          coverUrl: detail.coverUrl || "",
          trackCount: detail.trackCount || tracks.length,
          tracks,
          platform,
        });
      } else if (platform === "kugou") {
        const playlistId = await resolveKugouPlaylistId(trimmed);
        if (!playlistId) {
          setErrorMsg("无法从此链接提取歌单ID");
          setPhase("error");
          return;
        }

        const detail = await getKugouPlaylistDetail(playlistId);
        if (!detail.songs?.length) {
          setErrorMsg("歌单为空，无法导入");
          setPhase("error");
          return;
        }

        const tracks = detail.songs.map(convertKugouSongToMusicTrack);
        setPreview({
          name: detail.name,
          coverUrl: detail.coverUrl || "",
          trackCount: detail.trackCount || tracks.length,
          tracks,
          platform,
        });
      } else if (platform === "kuwo") {
        const playlistId = parseKuwoPlaylistUrl(trimmed);
        if (!playlistId) {
          setErrorMsg("无法从此链接提取歌单ID");
          setPhase("error");
          return;
        }

        const detail = await getKuwoPlaylistDetail(playlistId);
        if (!detail.songs?.length) {
          setErrorMsg("歌单为空，无法导入");
          setPhase("error");
          return;
        }

        const tracks = detail.songs.map(convertKuwoSongToMusicTrack);
        setPreview({
          name: detail.name,
          coverUrl: detail.coverUrl || "",
          trackCount: detail.trackCount || tracks.length,
          tracks,
          platform,
        });
      } else {
        const playlistId = await resolveMiguPlaylistId(trimmed);
        if (!playlistId) {
          setErrorMsg("无法从此链接提取歌单ID");
          setPhase("error");
          return;
        }

        const detail = await getMiguPlaylistDetail(playlistId);
        if (!detail.songs?.length) {
          setErrorMsg("歌单为空，无法导入");
          setPhase("error");
          return;
        }

        const tracks = detail.songs.map(convertMiguSongToMusicTrack);
        setPreview({
          name: detail.name,
          coverUrl: detail.coverUrl || "",
          trackCount: detail.trackCount || tracks.length,
          tracks,
          platform,
        });
      }
      setPhase("preview");
    } catch (e: unknown) {
      logger.error("PlaylistImportDrawer", "Fetch failed", e);
      const msg = e instanceof Error ? e.message : "获取歌单失败";
      setErrorMsg(msg.includes("timeout") ? "请求超时，请检查网络后重试" : msg);
      setPhase("error");
    }
  };

  const handleUrlImport = async () => {
    if (!preview) return;
    setPhase("importing");

    try {
      const playlistId = useMusicStore
        .getState()
        .createPlaylist(preview.name, preview.coverUrl);
      useMusicStore.getState().setPlaylistTracks(playlistId, preview.tracks);
      toastUtils.success(
        `成功导入歌单「${preview.name}」\n共 ${preview.trackCount} 首歌曲`
      );
      handleClose();
    } catch (e: unknown) {
      logger.error("PlaylistImportDrawer", "Import failed", e);
      toastUtils.error("导入失败，请重试");
      setPhase("preview");
    }
  };

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { name, tracks } = await importPlaylist(file);
      const playlistId = useMusicStore.getState().createPlaylist(name);
      useMusicStore.getState().setPlaylistTracks(playlistId, tracks);
      toastUtils.success(`成功导入歌单「${name}」\n共 ${tracks.length} 首歌曲`);
      handleClose();
    } catch (error: unknown) {
      logger.error("PlaylistImportDrawer", "File import failed", error);
      const message = error instanceof Error ? error.message : "导入失败";
      toastUtils.error(message);
    } finally {
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };

  return (
    <Drawer open={open} onOpenChange={(isOpen) => !isOpen && handleClose()}>
      <DrawerContent className="max-h-[92vh] outline-none">
        <DrawerHeader className="pb-2">
          <DrawerTitle className="text-center text-lg font-bold">
            导入歌单
          </DrawerTitle>
        </DrawerHeader>

        <Tabs defaultValue="link" className="px-5">
          <TabsList className="w-full">
            <TabsTrigger value="link" className="flex-1">
              <Link2 className="h-4 w-4 mr-1.5" />
              链接导入
            </TabsTrigger>
            <TabsTrigger value="file" className="flex-1">
              <Upload className="h-4 w-4 mr-1.5" />
              文件导入
            </TabsTrigger>
          </TabsList>

          <TabsContent value="link" className="mt-4 space-y-4">
            {phase === "input" && (
              <>
                <div className="relative">
                  <Link2 className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                  <Input
                    className="pl-9 h-11 bg-muted/40 border-none rounded-xl focus-visible:ring-1 font-mono text-sm"
                    placeholder="输入歌单分享链接，如 https://kuwo.cn/playlist_detail/3596743037"
                    value={url}
                    onChange={(e) => {
                      const url = parseInput(e.target.value);
                      setUrl(url);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleFetch()}
                    autoFocus
                  />
                </div>
                <p className="text-xs text-muted-foreground px-1">
                  「在官方 APP 打开歌单」 → 「分享到微信」 →
                  「在微信打开分享链接」 → 「点击右上角并复制链接」
                </p>
              </>
            )}

            {phase === "loading" && (
              <div className="flex flex-col items-center py-12 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p className="text-sm text-muted-foreground">
                  正在获取歌单信息...
                </p>
              </div>
            )}

            {phase === "preview" && preview && (
              <div className="space-y-4">
                <div className="bg-muted/30 rounded-2xl p-4 flex items-center gap-4">
                  {preview.coverUrl ? (
                    <img
                      src={preview.coverUrl}
                      alt={preview.name}
                      className="w-20 h-20 rounded-xl object-cover shadow-lg"
                    />
                  ) : (
                    <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center">
                      <Music4 className="h-8 w-8 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-base truncate">
                      {preview.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      {PLATFORM_LABELS[preview.platform]} · {preview.trackCount}{" "}
                      首歌曲
                    </p>
                  </div>
                </div>
              </div>
            )}

            {phase === "error" && (
              <div className="text-center py-8 space-y-4">
                <p className="text-sm text-destructive">{errorMsg}</p>
              </div>
            )}
          </TabsContent>

          <TabsContent value="file" className="mt-4">
            <div
              className="border-2 border-dashed border-muted-foreground/25 rounded-2xl p-8 text-center cursor-pointer hover:border-primary/50 hover:bg-muted/20 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="h-10 w-10 text-muted-foreground/60 mx-auto mb-3" />
              <p className="text-sm font-medium text-foreground">
                点击选择 JSON 文件
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                仅支持本 APP 导出的 .json 格式歌单文件
              </p>
              <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".json"
                onChange={handleFileImport}
              />
            </div>
          </TabsContent>
        </Tabs>

        <DrawerFooter className="px-5 pt-2 pb-8">
          {/* Link import tab footer buttons */}
          <div className="mt-2">
            {(phase === "input" || phase === "error") && (
              <>
                {phase === "error" && (
                  <Button
                    variant="outline"
                    className="h-12 rounded-2xl w-full"
                    onClick={() => setPhase("input")}
                  >
                    返回修改链接
                  </Button>
                )}
                <Button
                  className="h-12 rounded-2xl shadow-lg shadow-primary/20 w-full"
                  disabled={!url.trim()}
                  onClick={
                    phase === "error"
                      ? () => {
                          setPhase("input");
                          handleFetch();
                        }
                      : handleFetch
                  }
                >
                  {phase === "error" ? "重试" : "获取歌单"}
                </Button>
              </>
            )}
            {phase === "loading" && (
              <Button className="h-12 rounded-2xl w-full" disabled>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                获取中...
              </Button>
            )}
            {phase === "preview" && (
              <>
                <Button
                  className="h-12 rounded-2xl shadow-lg shadow-primary/20 w-full"
                  onClick={handleUrlImport}
                >
                  确认导入
                </Button>
                <Button
                  variant="ghost"
                  className="h-12 rounded-2xl w-full"
                  onClick={() => setPhase("input")}
                >
                  返回
                </Button>
              </>
            )}
            {phase === "importing" && (
              <Button className="h-12 rounded-2xl w-full" disabled>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                导入中...
              </Button>
            )}
          </div>
        </DrawerFooter>
      </DrawerContent>
    </Drawer>
  );
}

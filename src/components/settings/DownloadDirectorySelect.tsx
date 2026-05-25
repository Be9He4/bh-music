import { Capacitor } from "@capacitor/core";
import { useMusicStore } from "@/store/music-store";
import { SettingItem } from "./SettingItem";
import { LocalMusicPlugin } from "@/plugins/local-music";
import { FolderOpen, RotateCcw } from "lucide-react";
import { useState, useCallback } from "react";

export function DownloadDirectorySelect() {
  if (!Capacitor.isNativePlatform()) return null;

  return <DownloadDirectorySelectInner />;
}

function DownloadDirectorySelectInner() {
  const { downloadDirectory, setDownloadDirectory } = useMusicStore();
  const [picking, setPicking] = useState(false);

  const handlePick = useCallback(async () => {
    setPicking(true);
    try {
      const result = await LocalMusicPlugin.pickDownloadDirectory();
      if (result.success && result.path !== undefined) {
        setDownloadDirectory(result.path);
      }
    } catch (err) {
      console.warn("pickDownloadDirectory failed:", err);
    } finally {
      setPicking(false);
    }
  }, [setDownloadDirectory]);

  const handleReset = useCallback(() => {
    setDownloadDirectory("");
  }, [setDownloadDirectory]);

  return (
    <SettingItem
      icon={FolderOpen}
      title="下载目录"
      subtitle={downloadDirectory || "默认目录 (Download/OtterMusic)"}
      action={
        <div className="flex items-center gap-1">
          <button
            onClick={handlePick}
            disabled={picking}
            className="h-7 px-3 text-xs bg-primary/10 hover:bg-primary/20 text-primary rounded-md transition-colors disabled:opacity-50"
          >
            {picking ? "选择中..." : "选择目录"}
          </button>
          {downloadDirectory && (
            <button
              onClick={handleReset}
              className="p-1 text-muted-foreground hover:text-foreground"
              title="重置为默认"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      }
    />
  );
}

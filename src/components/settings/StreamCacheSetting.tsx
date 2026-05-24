import { useMusicStore } from "@/store/music-store";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { SettingItem } from "./SettingItem";
import { HardDrive, Trash2 } from "lucide-react";
import { useState, useEffect } from "react";
import { formatBytes, getAudioCacheStats, getStorageUsage, clearAudioCache } from "@/lib/cache-stats";
import { toastUtils } from "@/lib/utils/toast";

export function StreamCacheSetting() {
  const { enableStreamCache, setEnableStreamCache } = useMusicStore();
  const [expanded, setExpanded] = useState(false);
  const [stats, setStats] = useState({ entryCount: 0, approxSize: 0 });

  useEffect(() => {
    if (expanded) {
      Promise.all([getAudioCacheStats(), getStorageUsage()]).then(([s, usage]) => {
        setStats({ entryCount: s.entryCount, approxSize: usage });
      });
    }
  }, [expanded]);

  return (
    <SettingItem
      icon={HardDrive}
      title="边听边缓存"
      subtitle={enableStreamCache ? "播放时自动缓存，离线也能听" : "缓存已关闭"}
      action={
        <Switch
          checked={enableStreamCache}
          onCheckedChange={setEnableStreamCache}
        />
      }
      onClick={() => setExpanded(!expanded)}
      showChevron
      isExpanded={expanded}
      expandedContent={
        <div className="space-y-3">
          <div className="rounded-lg bg-muted/30 p-3">
            {stats.entryCount > 0 ? (
              <p className="text-sm text-center">
                <span className="text-muted-foreground">已缓存 </span>
                <span className="font-medium">{stats.entryCount}</span>
                <span className="text-muted-foreground"> 个片段</span>
                <span className="text-border mx-2">·</span>
                <span className="text-muted-foreground">约占用 </span>
                <span className="font-medium">{formatBytes(stats.approxSize)}</span>
              </p>
            ) : (
              <p className="text-xs text-center text-muted-foreground">暂无缓存数据</p>
            )}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full border-destructive/30 text-destructive hover:bg-destructive/10"
            disabled={stats.entryCount === 0}
            onClick={async (e) => {
              e.stopPropagation();
              if (window.confirm("确定要清空所有音频缓存吗？此操作不可恢复。")) {
                await clearAudioCache();
                setStats({ entryCount: 0, approxSize: 0 });
                toastUtils.info("音频缓存已清空");
              }
            }}
          >
            <Trash2 className="h-3.5 w-3.5 mr-1" />
            清空缓存
          </Button>
        </div>
      }
    />
  );
}

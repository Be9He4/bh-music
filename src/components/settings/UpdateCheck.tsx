import { useState } from "react";
import { SettingItem } from "./SettingItem";
import { Milestone, RefreshCw } from "lucide-react"; // 引入 RefreshCw 图标
import { useAppStore } from "@/store/app-store";
import { Badge } from "@/components/ui/badge";
import { Footer } from "@/components/footer";
import { Button } from "@/components/ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Download, ExternalLink } from "lucide-react";
import { format } from "date-fns";
import { openUrl } from "@/lib/utils";

interface UpdateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function UpdateDialog({ open, onOpenChange }: UpdateDialogProps) {
  const {
    currentVersion,
    latestVersionInfo,
    hasUpdate,
    isChecking,
    checkUpdate,
    lastCheckTime,
  } = useAppStore();

  const neverChecked = lastCheckTime === 0;

  return (
    <Drawer open={open} onOpenChange={onOpenChange}>
      <DrawerContent className="max-h-[85vh]">
        <DrawerHeader className="items-center pt-4">
          <img
            src="/favicon.svg"
            alt="Otter Music"
            className="w-16 h-16 rounded-xl shadow"
          />
          <DrawerTitle className="text-xl font-bold mt-2">
            Otter Music
          </DrawerTitle>
          <div className="text-xs font-mono text-muted-foreground">
            {currentVersion}
          </div>
        </DrawerHeader>

        <div className="space-y-4 overflow-y-auto px-4 pb-5">
          <div className="border rounded-lg p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">版本更新</span>
              {/* Badge 支持点击检查更新，带 Icon 和 Loading 动画 */}
              <Badge
                variant={hasUpdate ? "default" : "secondary"}
                className={`gap-1 cursor-pointer select-none ${isChecking ? "opacity-70" : ""}`}
                onClick={() => !isChecking && checkUpdate(false)}
              >
                <RefreshCw
                  className={`h-3 w-3 ${isChecking ? "animate-spin" : ""}`}
                />
                {isChecking
                  ? "检查中..."
                  : neverChecked
                    ? "检查更新"
                    : hasUpdate
                      ? `新版本 ${latestVersionInfo?.latestVersion}`
                      : "已是最新版本"}
              </Badge>
            </div>

            {/* 不管是否为最新版本，只要有数据就显示更新日志 */}
            {latestVersionInfo && (
              <div className="text-xs text-muted-foreground space-y-1">
                <div className="flex justify-between">
                  <span>
                    {format(
                      new Date(latestVersionInfo.publishDate),
                      "yyyy-MM-dd HH:mm"
                    )}
                  </span>
                  <span>
                    {(latestVersionInfo.size / 1024 / 1024).toFixed(2)} MB
                  </span>
                </div>

                <div className="max-h-32 overflow-y-auto whitespace-pre-wrap text-[11px] leading-relaxed bg-muted/40 p-2 rounded">
                  {latestVersionInfo.changelog}
                </div>
              </div>
            )}

            {/* 仅在有新版本更新时才显示下载按钮 */}
            {latestVersionInfo && (
              <>
                <Button
                  className="w-full"
                  onClick={() => openUrl(latestVersionInfo.downloadUrl)}
                >
                  <Download className="mr-2 h-4 w-4" />
                  国内下载
                </Button>

                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => openUrl(latestVersionInfo.directUrl)}
                >
                  <ExternalLink className="mr-2 h-4 w-4" />从 GitHub 下载
                </Button>
              </>
            )}
          </div>

          <Footer />
        </div>
      </DrawerContent>
    </Drawer>
  );
}

export function UpdateCheck() {
  const [showDialog, setShowDialog] = useState(false);
  const { currentVersion, hasUpdate } = useAppStore();

  return (
    <>
      <SettingItem
        icon={Milestone}
        title="版本更新"
        onClick={() => setShowDialog(true)}
        action={
          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {currentVersion}
            </span>

            {hasUpdate && (
              <Badge variant="destructive" className="gap-1 animate-bounce">
                新版本
              </Badge>
            )}
          </div>
        }
        showChevron
      />

      <UpdateDialog open={showDialog} onOpenChange={setShowDialog} />
    </>
  );
}

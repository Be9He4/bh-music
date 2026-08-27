"use client";

import { useState, useCallback } from "react";
import {
  CloudUpload,
  Save,
  Wifi,
  Trash2,
  Upload,
  Download,
  MoreHorizontal,
} from "lucide-react";
import { Button } from "../ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "../ui/drawer";
import { Input } from "../ui/input";
import { SettingItem } from "./SettingItem";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../ui/dropdown-menu";
import { useWebdavStore } from "@/store/webdav-store";
import { toastUtils } from "@/lib/utils/toast";
import {
  testConnection,
  uploadBackup,
  downloadBackup,
  type WebdavConfig,
} from "@/lib/webdav/client";
import {
  serializeStoreData,
  validateBackupData,
  importStoreData,
} from "@/lib/utils/data-backup";

/** 掩码展示服务器地址：仅保留协议 + 主机 + 末尾目录 */
function maskUrl(url: string): string {
  try {
    const u = new URL(url);
    const tail = url.replace(/\/+$/, "").split("/").pop();
    return `${u.protocol}//${u.host}${tail ? `/${tail}` : ""}`;
  } catch {
    return url.length > 30 ? `${url.slice(0, 27)}...` : url;
  }
}

export function WebDavBackup() {
  const { url, username, password, setConfig, clearConfig } = useWebdavStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState("");
  const [inputUsername, setInputUsername] = useState("");
  const [inputPassword, setInputPassword] = useState("");
  const [testing, setTesting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const isComplete =
    inputUrl.trim() && inputUsername.trim() && inputPassword.trim();
  const currentConfig: WebdavConfig | null = isComplete
    ? {
        url: inputUrl.trim(),
        username: inputUsername.trim(),
        password: inputPassword,
      }
    : null;

  const handleOpenChange = useCallback(
    (open: boolean) => {
      setDialogOpen(open);
      if (open) {
        setInputUrl(url);
        setInputUsername(username);
        setInputPassword(password ?? "");
      }
    },
    [url, username, password]
  );

  const handleSave = () => {
    if (!currentConfig) return;
    setConfig(currentConfig);
    toastUtils.success("配置已保存");
  };

  const handleTest = async () => {
    if (!currentConfig) return;
    setTesting(true);
    try {
      await testConnection(currentConfig);
      toastUtils.success("连接成功");
    } catch (e) {
      toastUtils.error(e instanceof Error ? e.message : "连接失败");
    } finally {
      setTesting(false);
    }
  };

  const handleUpload = async () => {
    if (!currentConfig) return;
    setUploading(true);
    try {
      const json = serializeStoreData();
      await uploadBackup(currentConfig, json);
      toastUtils.success("备份已上传到云端");
    } catch (e) {
      toastUtils.error(e instanceof Error ? e.message : "上传失败");
    } finally {
      setUploading(false);
    }
  };

  const handleDownload = async () => {
    if (!currentConfig) return;
    setDownloading(true);
    try {
      const raw = await downloadBackup(currentConfig);
      const validation = validateBackupData(raw);
      if (!validation.valid) {
        toastUtils.error(validation.error);
        return;
      }
      if (!confirm("将用云端备份覆盖当前收藏与歌单，确定恢复吗？")) return;
      importStoreData(validation.data);
      toastUtils.success("已从云端恢复备份");
      setDialogOpen(false);
    } catch (e) {
      toastUtils.error(e instanceof Error ? e.message : "下载失败");
    } finally {
      setDownloading(false);
    }
  };

  const handleClear = () => {
    if (!confirm("确认清除当前配置吗？")) return;
    clearConfig();
    setInputUrl("");
    setInputUsername("");
    setInputPassword("");
    setDialogOpen(false);
  };

  return (
    <>
      <SettingItem
        icon={CloudUpload}
        title="WebDAV 云端备份"
        subtitle={
          url ? `已配置: ${maskUrl(url)}` : "上传或恢复备份到 WebDAV 网盘"
        }
        action={
          <span className="text-xs text-muted-foreground">
            {url ? "已配置" : "未配置"}
          </span>
        }
        onClick={() => handleOpenChange(true)}
      />

      <Drawer open={dialogOpen} onOpenChange={handleOpenChange}>
        <DrawerContent className="max-h-[90vh]">
          <DrawerHeader>
            <DrawerTitle>WebDAV 云端备份</DrawerTitle>
            <DrawerDescription>
              配置 WebDAV 服务器，将收藏、歌单与设置备份到云端
            </DrawerDescription>
          </DrawerHeader>

          <div className="px-4 space-y-3">
            <Input
              placeholder="服务器地址，如 https://dav.example.com/backup"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
            />
            <Input
              placeholder="用户名"
              value={inputUsername}
              onChange={(e) => setInputUsername(e.target.value)}
            />
            <Input
              type="password"
              placeholder="密码"
              value={inputPassword}
              onChange={(e) => setInputPassword(e.target.value)}
            />

            <div className="flex gap-2">
              <Button
                onClick={handleUpload}
                className="flex-1"
                disabled={!currentConfig || uploading || downloading}
              >
                <Upload className="h-4 w-4" />
                {uploading ? "上传中..." : "上传备份"}
              </Button>

              <Button
                onClick={handleSave}
                variant="outline"
                className="flex-1"
                disabled={!currentConfig}
              >
                <Save className="h-4 w-4" />
                保存配置
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    title="更多操作"
                    disabled={uploading || downloading || testing}
                  >
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem
                    disabled={!currentConfig || testing}
                    onSelect={() => void handleTest()}
                  >
                    <Wifi />
                    {testing ? "测试中..." : "测试连接"}
                  </DropdownMenuItem>
                  <DropdownMenuItem
                    disabled={!currentConfig || uploading || downloading}
                    onSelect={() => void handleDownload()}
                  >
                    <Download />
                    {downloading ? "下载中..." : "下载备份"}
                  </DropdownMenuItem>
                  {url && (
                    <>
                      <DropdownMenuSeparator />
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={handleClear}
                      >
                        <Trash2 />
                        清除配置
                      </DropdownMenuItem>
                    </>
                  )}
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

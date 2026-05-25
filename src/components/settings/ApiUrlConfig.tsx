"use client";

import { useState } from "react";
import { Globe, Trash2 } from "lucide-react";
import { Button } from "../ui/button";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerFooter,
  DrawerHeader,
  DrawerTitle,
} from "../ui/drawer";
import { Input } from "../ui/input";
import { SettingItem } from "./SettingItem";
import {
  getApiUrl,
  getCustomApiUrl,
  setCustomApiUrl,
  clearCustomApiUrl,
  fetchWithTimeout,
} from "@/lib/api/config";
import { toast } from "react-hot-toast";

const MAX_DISPLAY_LEN = 30;

function displayUrl(url: string) {
  if (url.length <= MAX_DISPLAY_LEN) return url;
  return `${url.slice(0, 15)}...${url.slice(-10)}`;
}

function isValidUrl(url: string) {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}

export function ApiUrlConfig() {
  const [dialogOpen, setDialogOpen] = useState(false);
  const [inputUrl, setInputUrl] = useState("");
  const [saving, setSaving] = useState(false);

  const currentUrl = getApiUrl();
  const customUrl = getCustomApiUrl();

  const handleOpen = () => {
    setInputUrl(customUrl || "");
    setDialogOpen(true);
  };

  const handleSave = async () => {
    const trimmed = inputUrl.trim();
    if (!trimmed) return;

    if (!isValidUrl(trimmed)) {
      toast.error("URL 格式不正确");
      return;
    }

    setSaving(true);
    try {
      await fetchWithTimeout(`${trimmed}/update/check`);
      setCustomApiUrl(trimmed);
      setDialogOpen(false);
      toast.success("API 地址已更新");
    } catch {
      toast.error("连接失败，无法访问该地址");
    } finally {
      setSaving(false);
    }
  };

  const handleClear = () => {
    clearCustomApiUrl();
    setInputUrl("");
    setDialogOpen(false);
    toast.success("已恢复默认地址");
  };

  return (
    <>
      <SettingItem
        icon={Globe}
        title="API 地址"
        subtitle={customUrl ? "已自定义" : "使用默认地址"}
        action={
          <span className="text-xs text-muted-foreground">
            {customUrl ? displayUrl(customUrl) : displayUrl(currentUrl)}
          </span>
        }
        onClick={handleOpen}
      />

      <Drawer open={dialogOpen} onOpenChange={setDialogOpen}>
        <DrawerContent className="max-h-[85vh]">
          <DrawerHeader>
            <DrawerTitle>自定义 API 地址</DrawerTitle>
            <DrawerDescription>
              自建后端用户可在此修改 API 地址，留空则恢复默认。
              {customUrl && (
                <span className="block mt-1 text-muted-foreground">
                  当前: {customUrl}
                </span>
              )}
            </DrawerDescription>
          </DrawerHeader>
          <div className="px-4 pb-4">
            <Input
              placeholder="输入自建后端地址，如 https://my-api.example.com"
              value={inputUrl}
              onChange={(e) => setInputUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
          </div>
          <DrawerFooter className="gap-2 pt-0">
            {customUrl && (
              <Button
                variant="outline"
                onClick={handleClear}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                恢复默认
              </Button>
            )}
            <Button
              onClick={handleSave}
              disabled={saving || !inputUrl.trim()}
              className="h-11"
            >
              {saving ? "验证中..." : "保存"}
            </Button>
          </DrawerFooter>
        </DrawerContent>
      </Drawer>
    </>
  );
}

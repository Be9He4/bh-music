import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import { Switch } from "@/components/ui/switch";
import { SettingItem } from "./SettingItem";
import { Download, FileText } from "lucide-react";

export function DownloadSettingToggles() {
  const { embedCover, setEmbedCover, embedLyric, setEmbedLyric } =
    useMusicStore(
      useShallow((state) => ({
        embedCover: state.embedCover,
        setEmbedCover: state.setEmbedCover,
        embedLyric: state.embedLyric,
        setEmbedLyric: state.setEmbedLyric,
      }))
    );

  return (
    <>
      <SettingItem
        icon={Download}
        title="内嵌封面"
        subtitle="下载时写入歌曲封面图"
        action={<Switch checked={embedCover} onCheckedChange={setEmbedCover} />}
      />
      <SettingItem
        icon={FileText}
        title="内嵌歌词"
        subtitle="下载时写入歌词信息"
        action={<Switch checked={embedLyric} onCheckedChange={setEmbedLyric} />}
      />
    </>
  );
}

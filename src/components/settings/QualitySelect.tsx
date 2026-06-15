import { useMusicStore } from "@/store/music-store";
import { useShallow } from "zustand/react/shallow";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Music } from "lucide-react";
import { SettingItem } from "./SettingItem";
import { QUALITY_OPTIONS } from "@/lib/utils/quality";

export function QualitySelect() {
  const { quality, setQuality } = useMusicStore(
    useShallow((state) => ({
      quality: state.quality,
      setQuality: state.setQuality,
    }))
  );

  return (
    <SettingItem
      icon={Music}
      title="音质设置"
      action={
        <Select value={quality} onValueChange={setQuality}>
          <SelectTrigger className="h-7 px-2 bg-transparent border-muted hover:bg-muted/20 w-36">
            <SelectValue placeholder="音质" />
          </SelectTrigger>
          <SelectContent>
            {QUALITY_OPTIONS.map(({ value, label }) => (
              <SelectItem key={value} value={value}>
                {label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      }
    />
  );
}

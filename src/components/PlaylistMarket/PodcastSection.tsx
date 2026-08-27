import { useState } from "react";
import { Plus } from "lucide-react";
import { usePodcastStore } from "@/store/podcast-store";
import { PodcastCard } from "../Podcast/PodcastCard";
import { PodcastAdd } from "../Podcast/PodcastAdd";

export function PodcastSection() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const rssSources = usePodcastStore((s) => s.rssSources);

  return (
    <div className="p-4 pb-bottom-stack">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-4">
        <div
          className="group flex flex-col gap-2.5 transition-all hover:translate-y-[-4px] relative cursor-pointer"
          onClick={() => setIsAddOpen(true)}
        >
          <div className="relative aspect-square rounded-md overflow-hidden border-2 border-dashed border-muted-foreground/20 hover:border-primary/50 hover:bg-muted/50 transition-colors flex items-center justify-center bg-muted/20">
            <div className="w-8 h-8 shrink-0 flex-[0_0_32px] min-w-8 min-h-8">
              <Plus
                size={32}
                className="h-full w-full text-muted-foreground/50 group-hover:text-primary transition-colors"
              />
            </div>
          </div>
          <div className="px-0.5 text-center">
            <h3 className="text-[13px] font-medium leading-snug text-muted-foreground group-hover:text-primary transition-colors">
              添加播客
            </h3>
          </div>
        </div>
        {rssSources
          .filter((s) => !s.is_deleted)
          .map((rss) => (
            <PodcastCard key={rss.id} rssSource={rss} />
          ))}
      </div>
      <PodcastAdd open={isAddOpen} onOpenChange={setIsAddOpen} />
    </div>
  );
}

import { useState } from "react";
import { Plus } from "lucide-react";
import { useAlistStore } from "@/store/alist-store";
import type { AlistServer } from "@/types/alist";
import { AlistServerCard, AlistServerAdd } from "./Alist";

export function AlistSection() {
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingServer, setEditingServer] = useState<AlistServer | null>(null);
  const alistServers = useAlistStore((s) => s.servers);

  return (
    <div className="p-4 pb-bottom-stack">
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 gap-x-3 gap-y-4">
        <div
          className="group flex flex-col gap-2.5 transition-all hover:translate-y-[-4px] relative cursor-pointer"
          onClick={() => {
            setEditingServer(null);
            setIsAddOpen(true);
          }}
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
              添加站点
            </h3>
          </div>
        </div>
        {alistServers
          .filter((s) => !s.is_deleted)
          .map((server) => (
            <AlistServerCard
              key={server.id}
              server={server}
              onEdit={() => {
                setEditingServer(server);
                setIsAddOpen(true);
              }}
            />
          ))}
      </div>
      <AlistServerAdd
        open={isAddOpen}
        onOpenChange={(open) => {
          setIsAddOpen(open);
          if (!open) setEditingServer(null);
        }}
        editingServer={editingServer}
      />
    </div>
  );
}

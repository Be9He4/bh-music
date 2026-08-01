import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { MoreHorizontal, Server } from "lucide-react";
import type { AlistServer } from "@/types/alist";

interface AlistServerCardProps {
  server: AlistServer;
  onEdit: () => void;
}

export function AlistServerCard({ server, onEdit }: AlistServerCardProps) {
  const navigate = useNavigate();

  const handleCardClick = () => {
    navigate(`/alist/${server.id}`);
  };

  return (
    <div
      className="group flex flex-col gap-2.5 transition-all hover:translate-y-[-4px] relative"
      onClick={handleCardClick}
    >
      <div className="relative aspect-square rounded-md overflow-hidden shadow-md ring-1 ring-black/5 hover:shadow-xl transition-shadow cursor-pointer bg-gradient-to-br from-primary/10 to-muted/40 flex items-center justify-center">
        <div className="w-8 h-8 shrink-0 flex-[0_0_32px] min-w-8 min-h-8">
          <Server
            size={36}
            className="h-full w-full text-primary/70 group-hover:text-primary transition-colors"
          />
        </div>
        <div
          className="absolute top-1 right-1 z-10 transition-opacity duration-200"
          onClick={(e) => e.stopPropagation()}
        >
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 rounded-md bg-black/20 hover:bg-black/40 text-white backdrop-blur-sm"
            onClick={onEdit}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div className="px-0.5">
        <h3 className="text-[13px] font-medium leading-snug line-clamp-1 text-foreground/80 group-hover:text-primary transition-colors cursor-pointer">
          {server.name}
        </h3>
      </div>
    </div>
  );
}

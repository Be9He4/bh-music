"use client";

import { ChevronLeft, Home } from "lucide-react";
import { Button } from "./ui/button";

interface PageHeaderProps {
  title: string;
  onBack: () => void;
  onHome?: () => void;
  action?: React.ReactNode;
}

export function PageHeader({ title, onBack, onHome, action }: PageHeaderProps) {
  return (
    <div className="flex items-center justify-between px-4 pb-1 pt-2 border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <Button
          variant="ghost"
          size="icon"
          className="-ml-2 h-8 w-8 rounded-full hover:bg-muted/50"
          onClick={onBack}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        {onHome && (
          <Button
            variant="ghost"
            size="icon"
            className="-ml-1 h-8 w-8 rounded-full hover:bg-muted/50"
            onClick={onHome}
            title="回到首页"
          >
            <Home className="h-4 w-4" />
          </Button>
        )}
        <div className="flex flex-col min-w-0">
          <h1 className="font-semibold tracking-tight truncate">{title}</h1>
        </div>
      </div>
      {action && <div className="flex-none pl-4">{action}</div>}
    </div>
  );
}

"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Music2, Download } from "lucide-react";
import { cn } from "@/lib/utils";
import { forceHttps } from "@otter-music/shared";
import { Capacitor } from "@capacitor/core";
import { Filesystem, Directory } from "@capacitor/filesystem";
import { FileTransfer } from "@capacitor/file-transfer";
import { ensurePermission, triggerBlobDownload } from "@/lib/utils/download";
import { useExitLayer } from "@/hooks/useExitLayer";
import toast from "react-hot-toast";

interface MusicCoverProps {
  src?: string | null;
  alt?: string;
  className?: string;
  iconClassName?: string;
  fallbackIcon?: React.ReactNode;
  previewable?: boolean;
}

export function MusicCover({
  src,
  alt = "Cover",
  className,
  iconClassName,
  fallbackIcon,
  previewable = false,
}: MusicCoverProps) {
  const [error, setError] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const { push, pop } = useExitLayer();
  const coverUrl = forceHttps(src);

  useEffect(() => {
    if (!isPreviewOpen) return;
    const id = push({ close: () => setIsPreviewOpen(false) });
    return () => {
      pop(id);
    };
  }, [isPreviewOpen, push, pop]);

  const handleSave = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!coverUrl || isSaving) return;
    setIsSaving(true);

    try {
      const filename = `${alt.replace(/[\\/:*?"<>|]/g, "_")}.jpg`;

      if (Capacitor.isNativePlatform()) {
        await ensurePermission();
        const fileUri = await Filesystem.getUri({
          directory: Directory.ExternalStorage,
          path: `Pictures/OtterMusic/${filename}`,
        });
        await FileTransfer.downloadFile({
          url: coverUrl,
          path: fileUri.uri,
        });
        toast.success(`已保存到 Pictures/OtterMusic`);
      } else {
        const response = await fetch(coverUrl);
        const blob = await response.blob();
        triggerBlobDownload(blob, filename);
      }
    } catch {
      toast.error("保存失败，请重试");
    } finally {
      setIsSaving(false);
    }
  };

  if (!src || error) {
    return (
      <div
        className={cn(
          "w-full h-full bg-muted flex items-center justify-center shrink-0",
          className
        )}
      >
        {fallbackIcon || (
          <Music2 className={cn("text-muted-foreground/50", iconClassName)} />
        )}
      </div>
    );
  }

  return (
    <>
      <img
        src={coverUrl}
        alt={alt}
        className={cn(
          "w-full h-full object-cover shrink-0",
          previewable && "cursor-pointer",
          className
        )}
        draggable={false}
        onError={() => setError(true)}
        onClick={() => previewable && setIsPreviewOpen(true)}
        onContextMenu={(e) => e.preventDefault()}
      />

      {previewable &&
        isPreviewOpen &&
        createPortal(
          <div
            data-testid="cover-preview-portal"
            className="fixed inset-0 z-500 flex flex-col items-center justify-center bg-black select-none animate-in fade-in duration-200"
            onClick={() => setIsPreviewOpen(false)}
          >
            <img
              src={coverUrl}
              alt={alt}
              className="max-w-full max-h-[80vh] object-contain pointer-events-none"
            />

            <button
              onClick={handleSave}
              disabled={isSaving}
              className="absolute bottom-5 flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-full text-sm transition-colors border border-white/10 disabled:opacity-50"
            >
              <Download size={16} />
              {isSaving ? "保存中..." : "保存图片"}
            </button>
          </div>,
          document.body
        )}
    </>
  );
}

"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Copy, Check, Download, FileUp, Upload } from "lucide-react";
import { toastUtils } from "@/lib/utils/toast";
import { writeClipboardText } from "@/lib/clipboard";
import {
  serializeStoreData,
  validateBackupData,
  importStoreData,
  saveBackupFile,
  type BackupValidationResult,
} from "@/lib/utils/data-backup";

interface DataBackupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

/** 从校验结果中提取预览文字 */
function summaryText(result: BackupValidationResult): string {
  if (!result.valid) return "";
  const s = result.summary;
  const parts: string[] = [];
  if (s.favoritesCount > 0) parts.push(`${s.favoritesCount} 首喜欢`);
  if (s.playlistsCount > 0) parts.push(`${s.playlistsCount} 个歌单`);
  return parts.length > 0 ? `共 ${parts.join("、")}` : "备份中无收藏或歌单数据";
}

/**
 * 数据备份对话框 —— 支持 JSON 文本导出（复制）与导入（粘贴）
 */
export function DataBackup({ open, onOpenChange }: DataBackupProps) {
  const [importText, setImportText] = useState("");
  const [fileText, setFileText] = useState("");
  const [selectedFileName, setSelectedFileName] = useState("");
  const [copied, setCopied] = useState(false);
  const [validation, setValidation] = useState<BackupValidationResult | null>(
    null
  );
  const [importing, setImporting] = useState(false);
  const [exporting, setExporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 每次打开对话框时重新序列化导出数据
  const exportJson = open ? serializeStoreData() : "";

  // 实时校验导入文本
  useEffect(() => {
    const raw = importText || fileText;
    if (!raw.trim()) {
      setValidation(null);
      return;
    }
    setValidation(validateBackupData(raw));
  }, [fileText, importText]);

  /** 复制导出数据到剪贴板 */
  const handleCopy = useCallback(async () => {
    const ok = await writeClipboardText(exportJson);
    if (ok) {
      setCopied(true);
      toastUtils.success("已复制到剪贴板");
      setTimeout(() => setCopied(false), 2000);
    } else {
      toastUtils.error("复制失败，请手动选择复制");
    }
  }, [exportJson]);

  /** 保存备份文件 */
  const handleExportFile = useCallback(async () => {
    setExporting(true);
    try {
      const location = await saveBackupFile(exportJson);
      toastUtils.success(`备份文件已保存：\n${location}`, { duration: 4000 });
    } catch {
      toastUtils.error("保存文件失败，请检查存储权限");
    } finally {
      setExporting(false);
    }
  }, [exportJson]);

  /** 从文件读取备份文本，并复用文本导入校验流程 */
  const handleFileChange = useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = "";
      if (!file) return;

      try {
        setImportText("");
        setFileText(await file.text());
        setSelectedFileName(file.name);
      } catch {
        toastUtils.error("读取备份文件失败");
      }
    },
    []
  );

  /** 执行导入 */
  const handleImport = useCallback(async () => {
    if (!validation?.valid) return;
    setImporting(true);
    try {
      importStoreData(validation.data);
      toastUtils.success(
        `导入成功：${validation.summary.favoritesCount} 首收藏、${validation.summary.playlistsCount} 个歌单`
      );
      setImportText("");
      setFileText("");
      setSelectedFileName("");
      setValidation(null);
      onOpenChange(false);
    } catch (_e) {
      console.error("导入失败", _e);
      toastUtils.error("导入失败，数据可能不完整");
    } finally {
      setImporting(false);
    }
  }, [validation, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg overflow-hidden">
        <DialogHeader>
          <DialogTitle>数据备份</DialogTitle>
        </DialogHeader>

        <Tabs defaultValue="export">
          <TabsList className="w-full">
            <TabsTrigger value="export" className="flex-1">
              导出数据
            </TabsTrigger>
            <TabsTrigger value="import" className="flex-1">
              导入数据
            </TabsTrigger>
          </TabsList>

          {/* 导出 Tab */}
          <TabsContent value="export" className="mt-3 space-y-3">
            <Textarea
              readOnly
              value={exportJson}
              className="h-64 font-mono text-xs resize-none max-w-full break-all"
            />
            <div className="flex gap-2">
              <Button
                onClick={handleExportFile}
                className="flex-1"
                disabled={exporting}
              >
                <Download className="h-4 w-4" />
                {exporting ? "保存中..." : "保存为文件"}
              </Button>
              <Button
                onClick={handleCopy}
                className="flex-1"
                variant={copied ? "secondary" : "outline"}
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    已复制
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    复制文本
                  </>
                )}
              </Button>
            </div>
          </TabsContent>

          {/* 导入 Tab */}
          <TabsContent value="import" className="mt-3 space-y-3">
            <Textarea
              placeholder="在此粘贴备份数据（JSON 格式）..."
              value={importText}
              onChange={(e) => {
                setFileText("");
                setSelectedFileName("");
                setImportText(e.target.value);
              }}
              className="h-64 font-mono text-xs resize-none max-w-full break-all"
            />

            {/* 预览/错误信息 */}
            {validation && (
              <div
                className={`text-sm px-3 py-2 rounded-md ${
                  validation.valid
                    ? "bg-primary/10 text-primary"
                    : "bg-destructive/10 text-destructive"
                }`}
              >
                {validation.valid ? summaryText(validation) : validation.error}
              </div>
            )}

            <input
              ref={fileInputRef}
              type="file"
              accept=".json,application/json"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              className="w-full"
              onClick={() => fileInputRef.current?.click()}
            >
              <FileUp className="h-4 w-4" />
              {selectedFileName || "从文件读取"}
            </Button>

            <Button
              onClick={handleImport}
              disabled={!validation?.valid || importing}
              className="w-full"
            >
              <Upload className="h-4 w-4" />
              {importing ? "导入中..." : "导入数据"}
            </Button>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

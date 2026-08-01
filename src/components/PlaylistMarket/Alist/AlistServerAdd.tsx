import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { useAlistStore } from "@/store/alist-store";
import { listDir } from "@/lib/alist";
import type { AlistServer } from "@/types/alist";
import { Loader2, Server, Link2, KeyRound, Folder } from "lucide-react";
import toast from "react-hot-toast";

interface AlistServerAddProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** 传入则进入编辑模式 */
  editingServer?: AlistServer | null;
}

export function AlistServerAdd({
  open,
  onOpenChange,
  editingServer,
}: AlistServerAddProps) {
  const { addServer, updateServer, removeServer } = useAlistStore();
  const isEdit = !!editingServer;

  const [name, setName] = useState(editingServer?.name ?? "");
  const [serverUrl, setServerUrl] = useState(editingServer?.serverUrl ?? "");
  const [token, setToken] = useState(editingServer?.token ?? "");
  const [rootPath, setRootPath] = useState(editingServer?.rootPath ?? "");
  const [submitting, setSubmitting] = useState(false);

  // 编辑时回填原数据：组件常驻挂载，editingServer 变化时需同步表单状态
  useEffect(() => {
    setName(editingServer?.name ?? "");
    setServerUrl(editingServer?.serverUrl ?? "");
    setToken(editingServer?.token ?? "");
    setRootPath(editingServer?.rootPath ?? "");
  }, [editingServer]);

  const normalizedUrl = serverUrl.trim();
  const normalizedRoot = rootPath.trim() || "/";

  const canSubmit = useMemo(() => {
    if (!normalizedUrl) return false;
    try {
      const u = new URL(normalizedUrl);
      return u.protocol === "http:" || u.protocol === "https:";
    } catch {
      return false;
    }
  }, [normalizedUrl]);

  const resetState = () => {
    setName("");
    setServerUrl("");
    setToken("");
    setRootPath("");
    setSubmitting(false);
  };

  const buildServer = (): AlistServer => ({
    id: editingServer?.id ?? "",
    name:
      name.trim() ||
      (() => {
        try {
          return new URL(normalizedUrl).hostname;
        } catch {
          return normalizedUrl;
        }
      })(),
    serverUrl: normalizedUrl,
    token: token.trim() || undefined,
    rootPath: normalizedRoot,
    is_deleted: false,
  });

  const handleSubmit = async () => {
    if (!canSubmit) {
      toast("请填写合法的站点地址");
      return;
    }

    setSubmitting(true);
    try {
      // 验证连通性：尝试列出根目录
      const probe = buildServer();
      await listDir(probe, normalizedRoot, 1, 1);

      if (isEdit && editingServer) {
        updateServer(editingServer.id, {
          name: probe.name,
          serverUrl: probe.serverUrl,
          token: probe.token,
          rootPath: probe.rootPath,
        });
        toast.success("已更新");
      } else {
        addServer(probe.name, probe.serverUrl, probe.token, probe.rootPath);
        toast.success("添加成功");
      }
      onOpenChange(false);
      resetState();
    } catch (e) {
      toast.error(
        e instanceof Error
          ? `验证失败：${e.message}`
          : "验证失败，请检查地址与 token"
      );
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = () => {
    if (!editingServer) return;
    if (!confirm("确定删除此站点?")) return;
    removeServer(editingServer.id);
    toast.success("已删除");
    onOpenChange(false);
  };

  return (
    <Drawer
      open={open}
      onOpenChange={(val) => {
        onOpenChange(val);
        if (!val && !isEdit) resetState();
      }}
    >
      <DrawerContent className="max-h-[90vh] overflow-hidden">
        <DrawerHeader className="mb-1 px-4">
          <DrawerTitle className="text-center text-lg">
            {isEdit ? "编辑 Alist 站点" : "添加 Alist 站点"}
          </DrawerTitle>
          <DrawerDescription className="text-center text-xs">
            填写站点地址与访问凭证，将验证根目录连通性
          </DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 min-h-0 space-y-3 overflow-y-auto px-4 pb-5">
          <div className="relative">
            <Link2 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="https://alist.example.com"
              value={serverUrl}
              onChange={(e) => setServerUrl(e.target.value)}
            />
          </div>

          <div className="relative">
            <Server className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="名称（可选，默认取域名）"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
          </div>

          <div className="relative">
            <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="Token（可选）"
              value={token}
              onChange={(e) => setToken(e.target.value)}
            />
          </div>

          <div className="relative">
            <Folder className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              className="pl-9"
              placeholder="根路径（可选，默认 /）"
              value={rootPath}
              onChange={(e) => setRootPath(e.target.value)}
            />
          </div>

          <Button
            className="w-full rounded-full"
            onClick={() => void handleSubmit()}
            disabled={!canSubmit || submitting}
          >
            {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isEdit ? "验证并更新" : "验证并添加"}
          </Button>

          {isEdit && (
            <Button
              variant="outline"
              className="w-full rounded-full text-destructive hover:text-destructive"
              onClick={handleDelete}
              disabled={submitting}
            >
              删除站点
            </Button>
          )}
        </div>
      </DrawerContent>
    </Drawer>
  );
}

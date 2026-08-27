import { useState } from "react";
import { Copy, LogOut, User, Loader2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SettingItem } from "./SettingItem";
import { IS_NATIVE } from "@/lib/api/config";
import {
  getQqUserByCookie,
  normalizeQqCookie,
} from "@/lib/qqmusic/qqmusic-auth";
import { useQqStore } from "@/store/qq-store";
import { writeClipboardText } from "@/lib/clipboard";
import toast from "react-hot-toast";

export function QqMusicLogin() {
  const { user, setLogin, logout } = useQqStore();
  const [open, setOpen] = useState(false);
  const [cookie, setCookie] = useState("");
  const [loading, setLoading] = useState(false);

  if (!IS_NATIVE && !import.meta.env.DEV) return null;

  const reset = () => {
    setCookie("");
    setLoading(false);
  };

  const handleLogin = async () => {
    const value = normalizeQqCookie(cookie);
    if (!value) return;

    setLoading(true);
    try {
      const profile = await getQqUserByCookie(value);
      if (!profile) {
        toast.error("Cookie 无效或已过期");
        return;
      }
      setLogin(value, profile);
      setOpen(false);
      reset();
      toast.success("QQ 音乐登录成功");
    } catch {
      toast.error("验证失败，请检查 Cookie");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (!window.confirm("确定要退出 QQ 音乐登录吗？")) return;
    logout();
    setOpen(false);
    reset();
    toast.success("已退出 QQ 音乐登录");
  };

  const handleCopyCookie = async () => {
    const ok = await writeClipboardText(useQqStore.getState().cookie);
    if (ok) {
      toast.success("已复制 Cookie");
      setOpen(false);
    } else {
      toast.error("复制失败");
    }
  };

  return (
    <>
      <SettingItem
        icon={User}
        title="QQ 音乐账号"
        subtitle={
          user
            ? `${user.nickname}${user.isVip ? " · VIP" : ""}`
            : "登录后可播放 VIP 歌曲"
        }
        action={
          user ? (
            <Avatar
              className="h-10 w-10 cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => setOpen(true)}
            >
              <AvatarImage src={user.avatarUrl} />
              <AvatarFallback>{user.nickname?.[0] || "Q"}</AvatarFallback>
            </Avatar>
          ) : (
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              登录
            </Button>
          )
        }
      />

      <Drawer
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (!nextOpen) reset();
        }}
      >
        <DrawerContent>
          <DrawerHeader className="px-4 text-center">
            <DrawerTitle>{user ? user.nickname : "QQ 音乐登录"}</DrawerTitle>
            <DrawerDescription>
              {user
                ? user.isVip
                  ? "已验证 VIP 账号"
                  : "账号已登录"
                : "粘贴 QQ 音乐完整 Cookie"}
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 px-6 pb-8">
            {user ? (
              <div className="flex flex-col gap-3">
                <Button
                  variant="secondary"
                  className="h-11 w-full justify-center"
                  onClick={handleCopyCookie}
                >
                  <Copy className="mr-2 h-4 w-4" />
                  复制 Cookie
                </Button>
                <Button
                  variant="destructive"
                  className="h-11 w-full justify-center"
                  onClick={handleLogout}
                >
                  <LogOut className="mr-2 h-4 w-4" />
                  退出登录
                </Button>
              </div>
            ) : (
              <ManualCookieInput
                cookie={cookie}
                loading={loading}
                onChange={setCookie}
                onSubmit={handleLogin}
              />
            )}
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function ManualCookieInput({
  cookie,
  loading,
  onChange,
  onSubmit,
}: {
  cookie: string;
  loading: boolean;
  onChange: (value: string) => void;
  onSubmit: () => void;
}) {
  return (
    <>
      <Textarea
        value={cookie}
        onChange={(event) => onChange(event.target.value)}
        placeholder="粘贴 Cookie: uin=...; qm_keyst=..."
        className="h-36 resize-none font-mono text-xs"
      />
      <p className="text-xs leading-relaxed text-muted-foreground">
        请先在 QQ 音乐官网登录，再从浏览器开发者工具的 Cookies 中复制完整
        Cookie。凭证仅保存在本地。
      </p>
      <Button
        className="w-full"
        onClick={onSubmit}
        disabled={loading || !cookie.trim()}
      >
        {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        验证并登录
      </Button>
    </>
  );
}

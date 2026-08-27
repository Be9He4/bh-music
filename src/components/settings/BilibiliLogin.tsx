import { useState } from "react";
import { Copy, LogOut, User, Loader2, ScanLine, Info } from "lucide-react";
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
  openBilibiliLogin,
  clearBilibiliCookies,
} from "@/plugins/webview-login";
import {
  getBilibiliUserByCookie,
  normalizeBilibiliCookie,
} from "@/lib/bilibili/bilibili-auth";
import { useBilibiliStore } from "@/store/bilibili-store";
import { writeClipboardText } from "@/lib/clipboard";
import toast from "react-hot-toast";

type LoginMode = "webview" | "cookie";

export function BilibiliLogin() {
  const { user, setLogin, logout } = useBilibiliStore();
  const [open, setOpen] = useState(false);
  const [showLogin, setShowLogin] = useState(false);
  const [loginMode, setLoginMode] = useState<LoginMode>("webview");
  const [cookieInput, setCookieInput] = useState("");
  const [loading, setLoading] = useState(false);

  if (!IS_NATIVE) return null;

  const resetLogin = () => {
    setLoginMode("webview");
    setCookieInput("");
    setLoading(false);
  };

  const handleWebviewLogin = async () => {
    setLoading(true);
    try {
      const result = await openBilibiliLogin();
      if (!result?.cookie) return;

      const profile = await getBilibiliUserByCookie(result.cookie);
      if (!profile) {
        toast.error("Cookie 无效或已过期");
        return;
      }
      setLogin(result.cookie, profile);
      setShowLogin(false);
      resetLogin();
      toast.success("B 站登录成功");
    } catch {
      toast.error("登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  const handleCookieLogin = async () => {
    const value = normalizeBilibiliCookie(cookieInput);
    if (!value) return;

    setLoading(true);
    try {
      const profile = await getBilibiliUserByCookie(value);
      if (!profile) {
        toast.error("Cookie 无效或已过期");
        return;
      }
      setLogin(value, profile);
      setShowLogin(false);
      resetLogin();
      toast.success("B 站登录成功");
    } catch {
      toast.error("验证失败，请检查 Cookie");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    if (!window.confirm("确定要退出 B 站登录吗？")) return;
    // 后台清除残留 cookie，不阻塞退出流程
    clearBilibiliCookies().catch(() => {});
    logout();
    setOpen(false);
    toast.success("已退出 B 站登录");
  };

  const handleCopyCookie = async () => {
    const ok = await writeClipboardText(useBilibiliStore.getState().cookie);
    if (ok) {
      toast.success("已复制 Cookie");
      setOpen(false);
    } else {
      toast.error("复制失败");
    }
  };

  const toggleLoginMode = () => {
    setLoginMode((prev) => (prev === "webview" ? "cookie" : "webview"));
  };

  return (
    <>
      <SettingItem
        icon={User}
        title="B 站账号"
        subtitle={user ? user.uname : "登录后支持获取 B 站 UP 主上传字幕"}
        action={
          user ? (
            <Avatar
              className="h-10 w-10 cursor-pointer transition-opacity hover:opacity-80"
              onClick={() => setOpen(true)}
            >
              {user.face ? <AvatarImage src={user.face} /> : null}
              <AvatarFallback>{user.uname?.[0] || "B"}</AvatarFallback>
            </Avatar>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowLogin(true)}
            >
              登录
            </Button>
          )
        }
      />

      {/* 登录弹窗 */}
      <Drawer
        open={showLogin}
        onOpenChange={(nextOpen) => {
          setShowLogin(nextOpen);
          if (!nextOpen) resetLogin();
        }}
      >
        <DrawerContent>
          <DrawerHeader className="px-4 text-center">
            <DrawerTitle>
              {loginMode === "webview" ? "扫码 / WebView 登录" : "Cookie 登录"}
            </DrawerTitle>
            <DrawerDescription>
              {loginMode === "webview"
                ? "打开 B 站登录页完成登录"
                : "粘贴完整 Cookie 字符串"}
            </DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 px-6 pb-8">
            {loginMode === "webview" ? (
              <div className="flex flex-col gap-3">
                <Button
                  variant="secondary"
                  className="h-11 w-full justify-center"
                  onClick={handleWebviewLogin}
                  disabled={loading}
                >
                  {loading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <ScanLine className="mr-2 h-4 w-4" />
                  )}
                  打开 B 站登录页
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <Textarea
                  wrap="soft"
                  placeholder="粘贴完整 Cookie 字符串（需包含 SESSDATA）..."
                  value={cookieInput}
                  onChange={(e) => setCookieInput(e.target.value)}
                  className="h-[140px] w-full resize-none overflow-y-auto rounded-xl border-0 bg-muted/20 p-4 font-mono text-[13px] leading-relaxed whitespace-pre-wrap break-all wrap-anywhere placeholder:text-muted-foreground/50 focus-visible:ring-1 focus-visible:ring-primary/20"
                />

                <div className="bg-muted/30 rounded-lg p-3 space-y-1.5">
                  <p className="text-[11px] font-medium text-muted-foreground flex items-center">
                    <Info className="w-3 h-3 mr-1" /> 如何获取？
                  </p>
                  <ol className="text-[10px] text-muted-foreground/80 leading-relaxed list-decimal list-inside space-y-0.5">
                    <li>
                      以 PC 模式访问官网{" "}
                      <a
                        href="https://www.bilibili.com/"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:underline underline-offset-2"
                      >
                        bilibili.com
                      </a>{" "}
                      并登录
                    </li>
                    <li>开发者工具 → Application → Cookies</li>
                    <li>
                      复制{" "}
                      <code className="bg-background px-1.5 py-0.5 rounded border text-primary font-mono text-[9px]">
                        www.bilibili.com
                      </code>{" "}
                      下的完整 Cookie
                    </li>
                  </ol>
                </div>

                <Button
                  className="w-full rounded-full"
                  onClick={handleCookieLogin}
                  disabled={loading || !cookieInput.trim()}
                >
                  {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  验证并登录
                </Button>
              </div>
            )}

            <Button
              variant="link"
              className="h-auto w-full px-0 text-xs text-muted-foreground/70 hover:text-muted-foreground"
              onClick={toggleLoginMode}
            >
              {loginMode === "webview"
                ? "通过 Cookie 登录"
                : "返回扫码 / WebView 登录"}
            </Button>
          </div>
        </DrawerContent>
      </Drawer>

      {/* 登录后点击头像的用户操作面板 */}
      <Drawer
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
        }}
      >
        <DrawerContent>
          <DrawerHeader className="px-4 text-center">
            <DrawerTitle>{user?.uname || "B 站账号"}</DrawerTitle>
            <DrawerDescription>账号已登录</DrawerDescription>
          </DrawerHeader>

          <div className="space-y-4 px-6 pb-8">
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
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}

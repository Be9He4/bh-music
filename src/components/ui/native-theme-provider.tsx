"use client";

import { useEffect, useState } from "react";
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";
import { App } from "@capacitor/app";
import { IS_NATIVE } from "@/lib/api/config";
import { LocalMusicPlugin } from "@/plugins/local-music";

/**
 * 获取系统主题并更新状态
 */
async function fetchSystemTheme(): Promise<"light" | "dark" | null> {
  try {
    const result = await LocalMusicPlugin.getSystemDarkMode();
    return result.isDarkMode ? "dark" : "light";
  } catch {
    return null;
  }
}

/**
 * 原生平台主题 Provider
 *
 * 解决 Capacitor WebView 中 next-themes 无法正确检测系统主题的问题。
 * 在原生平台时，通过原生插件获取真实的系统主题状态，并在应用从后台恢复时重新检测。
 */
export function NativeThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {
  const [nativeTheme, setNativeTheme] = useState<"light" | "dark" | null>(null);
  const [isReady, setIsReady] = useState(!IS_NATIVE);

  useEffect(() => {
    if (!IS_NATIVE) return;

    // 初始获取系统主题
    fetchSystemTheme().then((theme) => {
      if (theme) setNativeTheme(theme);
      setIsReady(true);
    });

    // 应用从后台恢复时重新检测系统主题
    const handleResume = () => {
      fetchSystemTheme().then((theme) => {
        if (theme) setNativeTheme(theme);
      });
    };

    App.addListener("resume", handleResume);

    return () => {
      App.removeAllListeners();
    };
  }, []);

  // 原生平台且获取到主题后，强制使用该主题
  if (IS_NATIVE && nativeTheme) {
    return (
      <NextThemesProvider {...props} forcedTheme={nativeTheme}>
        {children}
      </NextThemesProvider>
    );
  }

  // 原生平台但未获取到主题时，显示空白或加载状态
  if (IS_NATIVE && !isReady) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  // 非原生平台，使用默认行为
  return <NextThemesProvider {...props}>{children}</NextThemesProvider>;
}

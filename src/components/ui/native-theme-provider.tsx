"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  ThemeProvider as NextThemesProvider,
  type ThemeProviderProps,
} from "next-themes";
import { App } from "@capacitor/app";
import { IS_NATIVE } from "@/lib/api/config";
import { LocalMusicPlugin } from "@/plugins/local-music";

type ThemePreference = "system" | "light" | "dark";

interface ThemePreferenceContextValue {
  themePref: ThemePreference;
  setThemePref: (pref: ThemePreference) => void;
}

const ThemePreferenceContext = createContext<ThemePreferenceContextValue>({
  themePref: "system",
  setThemePref: () => {},
});

export function useThemePreference() {
  return useContext(ThemePreferenceContext);
}

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
 * 通过原生插件获取真实的系统主题状态，同时支持用户手动切换主题。
 * 当用户选择"跟随系统"时使用原生检测值，否则使用用户显式选择。
 */
export function NativeThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {
  const [systemTheme, setSystemTheme] = useState<"light" | "dark" | null>(null);
  const [themePref, setThemePrefState] = useState<ThemePreference>("system");
  const [isReady, setIsReady] = useState(!IS_NATIVE);

  const setThemePref = useCallback((pref: ThemePreference) => {
    setThemePrefState(pref);
  }, []);

  useEffect(() => {
    if (!IS_NATIVE) return;

    fetchSystemTheme().then((theme) => {
      if (theme) setSystemTheme(theme);
      setIsReady(true);
    });

    const handleResume = () => {
      fetchSystemTheme().then((theme) => {
        if (theme) setSystemTheme(theme);
      });
    };

    App.addListener("resume", handleResume);

    return () => {
      App.removeAllListeners();
    };
  }, []);

  const forcedTheme: string | undefined =
    themePref === "system"
      ? IS_NATIVE
        ? (systemTheme ?? undefined)
        : undefined
      : themePref;

  if (IS_NATIVE && !isReady) {
    return <div style={{ visibility: "hidden" }}>{children}</div>;
  }

  return (
    <ThemePreferenceContext.Provider value={{ themePref, setThemePref }}>
      <NextThemesProvider {...props} forcedTheme={forcedTheme}>
        {children}
      </NextThemesProvider>
    </ThemePreferenceContext.Provider>
  );
}

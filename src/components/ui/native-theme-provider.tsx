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

function getMatchMediaTheme(): "light" | "dark" | null {
  if (typeof window === "undefined") return null;
  try {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  } catch {
    return null;
  }
}

function readStoredPreference(): ThemePreference {
  try {
    const stored = localStorage.getItem("theme");
    if (stored === "light" || stored === "dark" || stored === "system") {
      return stored;
    }
  } catch {}
  return "system";
}

/**
 * 原生平台主题 Provider
 *
 * 解决 Capacitor WebView 中 next-themes 无法正确检测系统主题的问题。
 * 通过原生插件 + matchMedia 双重监听，实现系统主题实时感知。
 * 当用户选择"跟随系统"时实时响应系统主题变更，无需退出重进。
 * 使用 next-themes 默认 localStorage key("theme")持久化用户选择。
 */
export function NativeThemeProvider({
  children,
  ...props
}: ThemeProviderProps) {
  const [systemTheme, setSystemTheme] = useState<"light" | "dark" | null>(
    !IS_NATIVE ? null : getMatchMediaTheme()
  );
  const [themePref, setThemePrefState] =
    useState<ThemePreference>(readStoredPreference);
  const [isReady, setIsReady] = useState(!IS_NATIVE);

  const setThemePref = useCallback((pref: ThemePreference) => {
    setThemePrefState(pref);
    try {
      localStorage.setItem("theme", pref);
    } catch {}
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

    let darkModeListener: Awaited<
      ReturnType<typeof LocalMusicPlugin.addListener>
    > | null = null;
    LocalMusicPlugin.addListener("darkModeChange", (event) => {
      setSystemTheme(event.isDarkMode ? "dark" : "light");
    }).then((handle) => {
      darkModeListener = handle;
    });

    const mql = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = (e: MediaQueryListEvent) => {
      setSystemTheme(e.matches ? "dark" : "light");
    };
    mql.addEventListener("change", handleChange);

    return () => {
      App.removeAllListeners();
      darkModeListener?.remove();
      mql.removeEventListener("change", handleChange);
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

"use client";

import { Moon, Sun, SunMoon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useTheme } from "next-themes";

/**
 * 提供系统、浅色、深色三种主题模式切换。
 */
export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const currentTheme = theme ?? "system";
  const ThemeIcon =
    currentTheme === "system" ? SunMoon : currentTheme === "dark" ? Moon : Sun;

  const handleToggleTheme = () => {
    setTheme(
      currentTheme === "system"
        ? "light"
        : currentTheme === "light"
          ? "dark"
          : "system"
    );
  };

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={handleToggleTheme}
      className="h-9 w-9 text-foreground/60 hover:text-foreground hover:bg-secondary/50"
      title="主题切换"
      aria-label="主题切换"
    >
      <ThemeIcon className="h-4 w-4" />
    </Button>
  );
}

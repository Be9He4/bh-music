import { useState, useEffect, useRef } from "react";
import Vibrant from "node-vibrant";
import type { SwatchData } from "@/lib/utils/color";

interface UseCoverColorsResult {
  swatches: SwatchData[] | null;
  error: Error | null;
}

/**
 * 从封面图片 URL 提取调色板数据（含像素占比）
 * 直接使用 node-vibrant，保留 CORS fallback 逻辑
 */
export function useCoverColors(url: string | null): UseCoverColorsResult {
  const [swatches, setSwatches] = useState<SwatchData[] | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const latestUrlRef = useRef<string | null>(null);

  useEffect(() => {
    if (!url) return;

    let cancelled = false;
    latestUrlRef.current = url;

    async function extract(imageUrl: string): Promise<SwatchData[]> {
      // 主路径：直接获取调色板
      try {
        const palette = await Vibrant.from(imageUrl).getPalette();
        return paletteToSwatchData(palette);
      } catch {
        // 主路径失败，继续 CORS fallback
      }

      // CORS fallback：用带 crossOrigin 的 Image 重新加载
      const ImageClass = Vibrant.DefaultOpts.ImageClass;
      if (!ImageClass) throw new Error("ImageClass not available");
      const imgInstance = new ImageClass();
      const loaded = await imgInstance.load(imageUrl);
      // BrowserImage.load() 返回的实例带有 .image 属性（HTMLImageElement）
      const htmlImg = (loaded as { image?: HTMLImageElement }).image;
      if (!htmlImg) throw new Error("Failed to load image for CORS fallback");
      const palette = await Vibrant.from(htmlImg).getPalette();
      return paletteToSwatchData(palette);
    }

    extract(url)
      .then((result) => {
        if (!cancelled && latestUrlRef.current === url) {
          setSwatches(result);
          setError(null);
        }
      })
      .catch((err) => {
        if (!cancelled && latestUrlRef.current === url) {
          setSwatches(null);
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      });

    return () => {
      cancelled = true;
    };
  }, [url]);

  return { swatches, error };
}

/** 将 Vibrant Palette 转换为 SwatchData 数组 */
function paletteToSwatchData(palette: Record<string, unknown>): SwatchData[] {
  const swatchData: SwatchData[] = [];
  for (const swatch of Object.values(palette)) {
    if (
      swatch &&
      typeof (swatch as { getHex?: unknown }).getHex === "function"
    ) {
      const s = swatch as { getHex(): string; getPopulation(): number };
      swatchData.push({
        hex: s.getHex(),
        population: s.getPopulation(),
      });
    }
  }
  return swatchData;
}

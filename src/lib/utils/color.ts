import { colord, Colord } from "colord";

export type HSL = [h: number, s: number, l: number];

/** 颜色候选数据，包含像素占比 */
export interface SwatchData {
  hex: string;
  population?: number;
}

/**
 * 第一阶段：从颜色候选列表中选出代表色（Dominant Color）
 * 评分维度：population（像素占比）、vibrance（饱和度与亮度平衡）、colorfulness（HSV V×S）
 */
export function pickBestColor(candidates: (string | SwatchData)[]): HSL | null {
  if (!candidates?.length) return null;

  // 过滤并解析合法的候选颜色，同时剔除不符合亮度/饱和度区间的杂色
  const validCandidates = candidates
    .map((item) => (typeof item === "string" ? { hex: item } : item))
    .filter((data): data is SwatchData => !!data.hex)
    .map((data) => ({ data, color: colord(data.hex) }))
    .filter(({ color }) => {
      if (!color.isValid()) return false;
      const { s, l } = color.toHsl();
      // 过滤过暗、过亮且无色彩、或饱和度过低的颜色
      return !(l < 8 || (l > 95 && s < 15) || s < 10);
    });

  if (!validCandidates.length) return null;

  // 获取最大像素占比，用于后续归一化计算
  const maxPopulation = Math.max(
    ...validCandidates.map(({ data }) => data.population ?? 0)
  );
  const hasPopulation = maxPopulation > 0;

  // 遍历并计算最高得分的颜色
  let bestColor: Colord | null = null;
  let bestScore = -1;

  for (const { data, color } of validCandidates) {
    const { s, l } = color.toHsl();
    const { v } = color.toHsv();

    // 核心算法：计算色彩平衡度与鲜艳度
    const vibrance = s * (1 - Math.abs(l - 50) / 50);
    const colorfulness = (v * s) / 100;
    const populationScore =
      hasPopulation && data.population
        ? (data.population / maxPopulation) * 100
        : 0;

    // 权重大于零时加入占比分，否则仅依靠色彩指标
    const score = hasPopulation
      ? populationScore * 0.4 + vibrance * 0.4 + colorfulness * 0.2
      : vibrance * 0.6 + colorfulness * 0.4;

    if (score > bestScore) {
      bestScore = score;
      bestColor = color;
    }
  }

  if (!bestColor) return null;

  const { h, s, l } = bestColor.toHsl();
  return [Math.round(h), Math.round(s), Math.round(l)];
}

/**
 * 第二阶段：将代表色转换为播放器背景色
 * 策略：混黑 + 饱和度压缩 + 亮度固定
 */
export function createBackgroundColor(dominant: HSL): HSL {
  const [h, s, l] = dominant;

  const newS = clamp(s, 30, 60);

  // 混黑：用 HSL 模拟混合 #111111 后的亮度叠加效果
  const mixedL = l * 0.55 + 3;

  // 结合默认固定亮度（20）求均值，防止极端色彩下背景过暗
  const finalL = Math.round((mixedL + 20) / 2);

  return [Math.round(h), Math.round(newS), clamp(finalL, 16, 24)];
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

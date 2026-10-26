export type AwardId = "grammy" | "gma";

export interface AwardMeta {
  /** slug：前端路由参数与 chartly-api 路径共用 */
  id: AwardId;
  name: string;
  /** 封面渐变上的英文小字 */
  enName: string;
  /** 最新一届年份（曲市入口与奖项页缺省年份） */
  latestYear: number;
  /** 可选年份列表（倒序），范围以 chartly-api 已验证覆盖为准 */
  years: number[];
  /** 封面渐变起止色（135deg） */
  colors: [string, string];
}

/** 金曲奖届次年份（1990 第1届 — 2026，chartly-api 全量覆盖） */
const GMA_YEARS: number[] = Array.from(
  { length: 2026 - 1990 + 1 },
  (_, i) => 2026 - i
);

/** 格莱美届次年份（1959 第1届 — 2026，chartly-api 全量覆盖） */
const GRAMMY_YEARS: number[] = Array.from(
  { length: 2026 - 1959 + 1 },
  (_, i) => 2026 - i
);

export const AWARDS: AwardMeta[] = [
  {
    id: "gma",
    name: "台湾金曲奖",
    enName: "GMA",
    latestYear: 2026,
    years: GMA_YEARS,
    colors: ["#451a03", "#b45309"],
  },
  {
    id: "grammy",
    name: "格莱美奖",
    enName: "Grammy",
    latestYear: 2026,
    years: GRAMMY_YEARS,
    colors: ["#18181b", "#713f12"],
  },
];

export function getAwardMeta(id: string): AwardMeta | null {
  return AWARDS.find((a) => a.id === id) ?? null;
}

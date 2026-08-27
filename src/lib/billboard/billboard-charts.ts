export type BillboardChartGroup = "songs" | "albums" | "artists";

export interface BillboardChartMeta {
  /** slug：前端路由参数与后端 API 参数共用 */
  id: string;
  name: string;
  group: BillboardChartGroup;
  /** 封面渐变起止色（135deg） */
  colors: [string, string];
}

export const BILLBOARD_GROUPS: { id: BillboardChartGroup; name: string }[] = [
  { id: "songs", name: "歌曲" },
  { id: "albums", name: "专辑" },
  { id: "artists", name: "歌手" },
];

/** 榜单清单（slug 已于 2026-08 在 billboard.com 逐一验证可用） */
export const BILLBOARD_CHARTS: BillboardChartMeta[] = [
  // 歌曲
  {
    id: "billboard-global-200",
    name: "Global 200",
    group: "songs",
    colors: ["#18181b", "#3f3f46"],
  },
  {
    id: "billboard-global-excl-us",
    name: "Global Excl. U.S.",
    group: "songs",
    colors: ["#0f2027", "#2c5364"],
  },
  {
    id: "hot-100",
    name: "Hot 100",
    group: "songs",
    colors: ["#7f1d1d", "#dc2626"],
  },
  {
    id: "r-b-hip-hop-songs",
    name: "R&B/Hip-Hop",
    group: "songs",
    colors: ["#3b0764", "#9333ea"],
  },
  {
    id: "rock-songs",
    name: "Rock",
    group: "songs",
    colors: ["#450a0a", "#b91c1c"],
  },
  {
    id: "country-songs",
    name: "Country",
    group: "songs",
    colors: ["#451a03", "#d97706"],
  },
  {
    id: "dance-electronic-songs",
    name: "Dance",
    group: "songs",
    colors: ["#083344", "#0891b2"],
  },
  {
    id: "latin-songs",
    name: "Latin",
    group: "songs",
    colors: ["#365314", "#84cc16"],
  },
  // 专辑
  {
    id: "album-200",
    name: "Album 200",
    group: "albums",
    colors: ["#1e1b4b", "#4338ca"],
  },
  // 歌手
  {
    id: "artist-100",
    name: "Artist 100",
    group: "artists",
    colors: ["#431407", "#ea580c"],
  },
];

export function getBillboardChartMeta(id: string): BillboardChartMeta | null {
  return BILLBOARD_CHARTS.find((c) => c.id === id) ?? null;
}

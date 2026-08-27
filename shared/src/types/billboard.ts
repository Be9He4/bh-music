// Billboard 榜单条目（名次 + 标题 + 歌手 + 可选封面）
export type BillboardChartEntry = {
  rank: number;
  title: string;
  artist: string;
  /** 条目封面（billboard.com 缩略图 URL），专辑/歌手榜可用 */
  cover?: string;
};

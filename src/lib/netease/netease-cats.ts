export type CatItem = {
  id: string;
  name: string;
};

export type CatGroup = {
  category: string;
  filters: CatItem[];
};

/* 工具函数：避免重复写 { id, name } */
const F = (name: string): CatItem => ({
  id: name,
  name,
});

/* =========================================================
 * 所有分类（按移动端优先级排序）
 * 顺序：语种 → 风格 → 场景 → 情感 → 主题
 * ========================================================= */

export const ALIST_CAT: CatItem = F("Alist");

export const NETEASE_CATS: CatGroup[] = [
  {
    category: "语种",
    filters: [F("华语"), F("欧美"), F("日语"), F("韩语"), F("粤语")],
  },

  {
    category: "风格",
    filters: [
      // 高频（移动端优先展示）
      F("流行"),
      F("说唱"),
      F("电子"),
      F("民谣"),
      F("舞曲"),
      F("轻音乐"),

      // 中频
      F("R&B/Soul"),
      F("摇滚"),
      F("爵士"),
      F("乡村"),
      F("古典"),
      F("民族"),
      F("英伦"),

      // 小众
      F("金属"),
      F("朋克"),
      F("蓝调"),
      F("雷鬼"),
      F("世界音乐"),
      F("拉丁"),
      F("New Age"),
      F("古风"),
      F("后摇"),
      F("Bossa Nova"),
    ],
  },

  {
    category: "场景",
    filters: [
      // 高频
      F("学习"),
      F("工作"),
      F("运动"),
      F("驾车"),
      F("旅行"),

      // 其他
      F("清晨"),
      F("夜晚"),
      F("午休"),
      F("下午茶"),
      F("地铁"),
      F("散步"),
      F("酒吧"),
    ],
  },

  {
    category: "情感",
    filters: [
      // 高频
      F("快乐"),
      F("治愈"),
      F("放松"),
      F("浪漫"),

      // 其他
      F("怀旧"),
      F("伤感"),
      F("孤独"),
      F("思念"),
      F("感动"),
      F("兴奋"),
      F("安静"),
      F("清新"),
    ],
  },

  {
    category: "主题",
    filters: [
      // 高频
      F("影视原声"),
      F("ACG"),
      F("游戏"),
      F("经典"),
      F("播客"),
      F("KTV"),

      // 扩展
      F("综艺"),
      F("儿童"),
      F("校园"),
      F("网络歌曲"),
      F("翻唱"),
      F("吉他"),
      F("钢琴"),
      F("器乐"),

      F("70后"),
      F("80后"),
      F("90后"),
      F("00后"),
      ALIST_CAT,
      F("Billboard"),
    ],
  },
];

export const SPECIAL_CATS: CatItem[] = [
  F("官方"),
  { id: "Awards", name: "奖项" },
  F("榜单"),
  { id: "toplist", name: "排行榜" },
];

export const RECOMMEND_CATS: CatItem[] = [
  F("全部"),
  { id: "mine", name: "我的" },
  { id: "featured", name: "精选" },

  F("华语"),
  F("欧美"),

  F("流行"),
  F("说唱"),
  F("摇滚"),
  F("电子"),
  F("民谣"),
  F("轻音乐"),

  { id: "Billboard", name: "Billboard" },
  F("播客"),
];

/** 不走网易云 browse 分页适配器的分类（含「我的」、独立 Section 与精选下的特殊子 Tab） */
export const NON_BROWSE_CATEGORIES: ReadonlySet<string> = new Set([
  "mine",
  "播客",
  "Alist",
  "Billboard",
  "Awards",
]);

/* =========================================================
 * 常驻栏（歌单广场顶部分类栏）解析
 * ========================================================= */

/** 常驻栏固定分类：不可排序、不可删除，始终置前 */
export const FIXED_CATS: CatItem[] = RECOMMEND_CATS.slice(0, 3);

/** 可添加为常驻的全部分类目录（各分组分类平铺，含 Alist / Billboard） */
export const ADDABLE_CATS: CatItem[] = NETEASE_CATS.flatMap((g) => g.filters);

/**
 * 解析常驻栏分类为「固定项 + 常驻项」。
 * @param savedOrder 用户自定义的常驻分类 id 序列；null 表示未自定义（使用默认序列）
 */
export function resolveBarCategories(savedOrder: string[] | null): {
  fixed: CatItem[];
  residents: CatItem[];
} {
  const catalog = new Map(ADDABLE_CATS.map((c) => [c.id, c]));

  if (!savedOrder) {
    return { fixed: FIXED_CATS, residents: RECOMMEND_CATS.slice(3) };
  }
  return {
    fixed: FIXED_CATS,
    residents: savedOrder.flatMap((id) => catalog.get(id) ?? []),
  };
}

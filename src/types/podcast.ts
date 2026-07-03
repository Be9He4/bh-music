import type { PodcastRssSource } from "@otter-music/shared";

export type {
  PodcastEpisode,
  PodcastFeed,
  PodcastRssSource,
  SearchPodcastItem,
} from "@otter-music/shared";

const RAW_SOURCES = [
  // 中文 | 资讯与商业
  {
    id: "zx7",
    name: "资讯早7点",
    rssUrl: "https://feed.xyzfm.space/wb39te6k9gqw",
    author: "王子Wz",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/22/ae/0b/22ae0ba7-e403-0e07-8ffb-5f2bb041ca2a/mza_13972638120233589594.jpg/600x600bb.jpg",
  },
  {
    id: "shengcoffee",
    name: "声动早咖啡",
    rssUrl: "https://www.ximalaya.com/album/51076156.xml",
    author: "声动活泼",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts112/v4/a9/7f/7a/a97f7a8f-4451-05bc-bacc-637773b1b06a/mza_16067595309054880476.png/600x600bb.jpg",
  },
  {
    id: "bnt",
    name: "半拿铁·周刊",
    rssUrl: "https://feed.xyzfm.space/vylham8uw3ay",
    author: "刘飞&潇磊",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts221/v4/7b/91/d8/7b91d8f0-3e9f-6ffc-049d-884a839e6153/mza_6269877101523052423.jpg/600x600bb.jpg",
  },
  {
    id: "zhixing",
    name: "知行小酒馆",
    rssUrl: "https://feed.xyzfm.space/j8yp8gxkmgqr",
    author: "有知有行",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts112/v4/b3/96/fc/b396fcc5-6e2b-d34e-8d3d-c849c43b6215/mza_4090324763067558601.jpeg/600x600bb.jpg",
  },
  {
    id: "wrzhx",
    name: "无人知晓",
    rssUrl: "https://feed.xyzfm.space/ypn9dydpbxpc",
    author: "孟岩",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts125/v4/99/76/95/99769525-5b7f-b1f4-3d11-b669ad4d0f71/mza_7503501950013528617.jpeg/600x600bb.jpg",
  },

  // 中文 | 成长与人文
  {
    id: "xsfgs",
    name: "西西弗高速",
    rssUrl: "https://feed.xyzfm.space/76evp7fxkeu8",
    author: "西西弗高速",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/39/33/c8/3933c812-a713-a8b3-2046-9d82db97ccb3/mza_12071338705578516728.jpg/600x600bb.jpg",
  },
  {
    id: "yzhs",
    name: "岩中花述",
    rssUrl: "https://feed.xyzfm.space/hwen8wf69c6g",
    author: "GIADA | JustPod",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts211/v4/66/61/68/6661682f-e63e-e4ae-9a2b-24e0f469e691/mza_10195277240598994553.jpg/600x600bb.jpg",
  },

  // 英文 | 顶流与新闻
  {
    id: "daily",
    name: "The Daily",
    rssUrl: "https://feeds.simplecast.com/54nAGcIl",
    author: "The New York Times",
    coverUrl:
      "https://image.simplecastcdn.com/images/7f2f4c05-9c2f-4deb-82b7-b538062bc22d/73549bf1-94b3-40ff-8aeb-b4054848ec1b/600x600/the-daily-album-art-original.jpg?aid=rss_feed",
  },
  {
    id: "ted-daily",
    name: "TED Talks Daily",
    rssUrl: "https://feeds.acast.com/public/shows/67587e77c705e441797aff96",
    author: "TED",
    coverUrl:
      "https://is1-ssl.mzstatic.com/image/thumb/Podcasts116/v4/2e/cf/99/2ecf996f-71f7-604f-b0a0-43116b9d6619/mza_10257768296573848480.png/600x600bb.jpg",
  },
];

export const DEFAULT_RSS_SOURCES: PodcastRssSource[] = RAW_SOURCES.map(
  (source) => ({
    ...source,
    id: `default-${source.id}`,
    is_deleted: false,
    update_time: Date.now(),
  })
);

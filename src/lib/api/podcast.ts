import type { PodcastFeed, SearchPodcastItem } from "@/types/podcast";
import { getApiUrl } from ".";
import { retry } from "@/lib/utils";

const parseJson = async (res: Response) => {
  if (!res.ok) {
    throw new Error((await res.text()) || "请求失败");
  }
  try {
    return await res.json();
  } catch {
    throw new Error("接口返回不是有效 JSON");
  }
};

/**
 * Apple Podcasts iTunes 搜索响应类型
 */
type ApplePodcastResult = {
  collectionId?: number;
  collectionName?: string;
  artistName?: string;
  feedUrl?: string;
  artworkUrl600?: string;
  artworkUrl100?: string;
  collectionViewUrl?: string;
};

/**
 * 将 Apple Podcasts 响应标准化为 SearchPodcastItem
 */
const normalizeAppleResult = (item: ApplePodcastResult): SearchPodcastItem => ({
  source: "apple",
  id: String(item.collectionId ?? ""),
  title: item.collectionName?.trim() ?? "",
  author: item.artistName?.trim() ?? "",
  cover: item.artworkUrl600?.trim() || item.artworkUrl100?.trim() || null,
  rssUrl: item.feedUrl?.trim() || null,
  url: item.collectionViewUrl?.trim() || null,
});

/**
 * 前端直连 Apple Podcasts iTunes Search API
 */
const appleSearchPodcast = async (
  keyword: string,
  limit: number = 20
): Promise<SearchPodcastItem[]> => {
  const url = new URL("https://itunes.apple.com/search");
  url.searchParams.set("term", keyword);
  url.searchParams.set("media", "podcast");
  url.searchParams.set("entity", "podcast");
  url.searchParams.set("limit", String(limit));
  url.searchParams.set("country", "CN");
  url.searchParams.set("lang", "zh_cn");

  const response = await fetch(url.toString(), {
    headers: {
      accept: "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`Apple Podcasts 搜索失败: HTTP ${response.status}`);
  }

  const json = (await response.json()) as { results?: ApplePodcastResult[] };
  return (json.results ?? [])
    .map(normalizeAppleResult)
    .filter((item) => item.id && item.title);
};

/**
 * 搜索播客（直连 Apple Podcasts）
 */
export const searchPodcast = async (
  keyword: string
): Promise<SearchPodcastItem[]> => {
  const normalizedKeyword = keyword.trim();
  if (!normalizedKeyword) {
    return [];
  }
  return appleSearchPodcast(normalizedKeyword);
};

/**
 * 解析播客 RSS（仍需后端代理，因 RSS 源通常不支持 CORS）
 */
export const parsePodcastRss = async (
  rssUrl: string,
  signal?: AbortSignal
): Promise<PodcastFeed> => {
  const normalizedUrl = rssUrl.trim();
  if (!normalizedUrl) {
    throw new Error("RSS 地址不能为空");
  }

  const res = await retry(
    async () => {
      if (signal?.aborted) {
        throw new DOMException("Aborted", "AbortError");
      }
      return await fetch(
        `${getApiUrl()}/podcast-api/rss?url=${encodeURIComponent(normalizedUrl)}`,
        { signal }
      );
    },
    2,
    1000
  );

  const json = await parseJson(res);
  return json.data;
};

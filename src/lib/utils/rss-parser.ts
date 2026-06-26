import type { PodcastFeed, PodcastEpisode } from "@otter-music/shared";

const MAX_EPISODES = 50;

const HTML_ENTITY_MAP: Record<string, string> = {
  nbsp: " ",
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  "#39": "'",
};

/**
 * 清洗 HTML 标签和实体
 */
function stripHtml(html: string): string {
  if (!html) return "";
  return html
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&(nbsp|amp|lt|gt|quot|#39);/gi, (m, p1: string) => {
      return HTML_ENTITY_MAP[p1.toLowerCase()] ?? m;
    })
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * 标准化 URL（相对路径转绝对路径）
 */
function normalizeUrl(url?: string, baseUrl?: string): string | null {
  if (!url) return null;
  try {
    return new URL(url, baseUrl).toString();
  } catch {
    return null;
  }
}

/**
 * 获取元素的文本内容
 */
function getTextContent(el: Element | null): string {
  if (!el) return "";
  return el.textContent?.trim() || "";
}

/**
 * 从 RSS/Atom XML 解析播客数据
 */
export function parseRssXml(xmlText: string, feedUrl: string): PodcastFeed {
  const parser = new DOMParser();
  const doc = parser.parseFromString(xmlText, "text/xml");

  // 检查解析错误
  const parseError = doc.querySelector("parsererror");
  if (parseError) {
    throw new Error("RSS XML 解析失败");
  }

  const feed: PodcastFeed = {
    name: "",
    description: "",
    coverUrl: null,
    link: null,
    episodes: [],
  };

  // 判断是 RSS 还是 Atom
  const isAtom = doc.documentElement.nodeName === "feed";

  if (isAtom) {
    // Atom 格式
    feed.name = stripHtml(getTextContent(doc.querySelector("feed > title")));
    feed.description = stripHtml(
      getTextContent(doc.querySelector("feed > subtitle"))
    );
    feed.link = normalizeUrl(
      getTextContent(doc.querySelector("feed > link[rel='alternate']")),
      feedUrl
    );

    // Atom 封面
    const logo = doc.querySelector("feed > logo, feed > icon");
    if (logo) {
      feed.coverUrl = normalizeUrl(getTextContent(logo), feedUrl);
    }

    // itunes:image
    const itunesImage = doc.querySelector("feed > image[href]");
    if (itunesImage) {
      const href = itunesImage.getAttribute("href");
      if (href) feed.coverUrl = normalizeUrl(href, feedUrl);
    }

    // 解析条目
    const entries = doc.querySelectorAll("feed > entry");
    for (
      let i = 0;
      i < entries.length && feed.episodes.length < MAX_EPISODES;
      i++
    ) {
      const entry = entries[i];
      const episode = parseAtomEntry(entry, feedUrl, feed.coverUrl);
      if (episode) feed.episodes.push(episode);
    }
  } else {
    // RSS 2.0 格式
    feed.name = stripHtml(getTextContent(doc.querySelector("channel > title")));
    feed.description = stripHtml(
      getTextContent(doc.querySelector("channel > description"))
    );
    feed.link = normalizeUrl(
      getTextContent(doc.querySelector("channel > link")),
      feedUrl
    );

    // RSS 封面
    const itunesImage = doc.querySelector("channel > image[url]");
    if (itunesImage) {
      const url = itunesImage.getAttribute("url");
      if (url) feed.coverUrl = normalizeUrl(url, feedUrl);
    }

    // itunes:image (namespace)
    if (!feed.coverUrl) {
      const itunesImg = doc.querySelector(
        "channel > itunes\\:image, channel > image"
      );
      if (itunesImg) {
        const href =
          itunesImg.getAttribute("href") || itunesImg.getAttribute("url");
        if (href) feed.coverUrl = normalizeUrl(href, feedUrl);
      }
    }

    // 解析条目
    const items = doc.querySelectorAll("channel > item");
    for (
      let i = 0;
      i < items.length && feed.episodes.length < MAX_EPISODES;
      i++
    ) {
      const item = items[i];
      const episode = parseRssItem(item, feedUrl, feed.coverUrl);
      if (episode) feed.episodes.push(episode);
    }
  }

  return feed;
}

/**
 * 解析 RSS item
 */
function parseRssItem(
  item: Element,
  feedUrl: string,
  feedCoverUrl: string | null
): PodcastEpisode | null {
  const title = getTextContent(item.querySelector("title"));
  if (!title) return null;

  // 音频 URL（enclosure）
  let audioUrl: string | null = null;
  const enclosure = item.querySelector("enclosure[url]");
  if (enclosure) {
    audioUrl = normalizeUrl(enclosure.getAttribute("url") || "", feedUrl);
  }

  // 兼容 Atom link[rel=enclosure]
  if (!audioUrl) {
    const atomLink = item.querySelector("link[rel='enclosure'][href]");
    if (atomLink) {
      audioUrl = normalizeUrl(atomLink.getAttribute("href") || "", feedUrl);
    }
  }

  if (!audioUrl) return null;

  // 描述
  const desc =
    getTextContent(item.querySelector("description")) ||
    getTextContent(item.querySelector("content\\:encoded")) ||
    getTextContent(item.querySelector("summary")) ||
    "";

  // 发布日期
  const pubDate =
    getTextContent(item.querySelector("pubDate")) ||
    getTextContent(item.querySelector("dc\\:date")) ||
    null;

  // 封面
  let coverUrl: string | null = null;
  const itunesImage = item.querySelector("itunes\\:image[href]");
  if (itunesImage) {
    coverUrl = normalizeUrl(itunesImage.getAttribute("href") || "", feedUrl);
  }
  if (!coverUrl) coverUrl = feedCoverUrl;

  // ID
  const id = getTextContent(item.querySelector("guid")) || audioUrl || title;

  return {
    id: id.slice(0, 200),
    title: stripHtml(title),
    audioUrl,
    desc: stripHtml(desc).slice(0, 1000),
    pubDate,
    coverUrl,
  };
}

/**
 * 解析 Atom entry
 */
function parseAtomEntry(
  entry: Element,
  feedUrl: string,
  feedCoverUrl: string | null
): PodcastEpisode | null {
  const title = getTextContent(entry.querySelector("title"));
  if (!title) return null;

  // 音频 URL
  let audioUrl: string | null = null;
  const enclosure = entry.querySelector("link[rel='enclosure'][href]");
  if (enclosure) {
    audioUrl = normalizeUrl(enclosure.getAttribute("href") || "", feedUrl);
  }

  // 兼容 media:content
  if (!audioUrl) {
    const media = entry.querySelector("media\\:content[url]");
    if (media) {
      audioUrl = normalizeUrl(media.getAttribute("url") || "", feedUrl);
    }
  }

  if (!audioUrl) return null;

  // 描述
  const desc =
    getTextContent(entry.querySelector("summary")) ||
    getTextContent(entry.querySelector("content")) ||
    "";

  // 发布日期
  const pubDate =
    getTextContent(entry.querySelector("published")) ||
    getTextContent(entry.querySelector("updated")) ||
    null;

  // 封面
  let coverUrl: string | null = null;
  const itunesImage = entry.querySelector("itunes\\:image[href]");
  if (itunesImage) {
    coverUrl = normalizeUrl(itunesImage.getAttribute("href") || "", feedUrl);
  }
  if (!coverUrl) coverUrl = feedCoverUrl;

  // ID
  const id = getTextContent(entry.querySelector("id")) || audioUrl || title;

  return {
    id: id.slice(0, 200),
    title: stripHtml(title),
    audioUrl,
    desc: stripHtml(desc).slice(0, 1000),
    pubDate,
    coverUrl,
  };
}

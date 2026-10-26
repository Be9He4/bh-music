import type { MusicTrack } from "@/types/music";
import { fetchWithTimeout } from "@/lib/api/config";
import { cachedFetch } from "@/lib/utils/cache";
import { logger } from "@/lib/logger";
import type { AwardId } from "./awards-meta";

const CHARTLY_API_BASE = "https://chartly-api.pages.dev";
const AWARDS_API_TIMEOUT_MS = 15000;
const AWARDS_TTL = 7 * 24 * 60 * 60 * 1000; // 7 天（获奖名单是静态数据）

/** 奖项条目归属：song/album/artist 可点击播放或跳详情，undefined 走聚合搜索 */
export type AwardKind = "song" | "album" | "artist";

/**
 * 格莱美分类归属推导（按顺序匹配）：
 * 1. 工程技术类（录音工程、专辑包装、专辑内页、沉浸式音频）→ 无 kind
 * 2. Song / 年度录音（Record of the Year）/ 表演类（Performance、Solo、Collaboration，含古典）→ song
 * 3. Recording 类单曲录音（如 Dance/Electronic Recording），排除混音、有声书等技术 / 口述类 → song
 * 4. Album / Soundtrack → album
 * 5. New Artist（含 Best New Country & Western Artist 等变体）→ artist
 * 6. 其余（Producer、Music Video、作曲 / 编曲、歌剧录音、Compendium 等）→ 无 kind
 */
export function grammyKind(name: string): AwardKind | undefined {
  if (
    /Album Notes|Recording Package|Engineered Album|Immersive Audio/i.test(name)
  )
    return undefined;
  if (/\bSong\b/i.test(name)) return "song";
  if (
    /Record of the Year|\bPerformance\b|\bSolo\b|\bCollaboration\b/i.test(name)
  )
    return "song";
  if (
    /\bRecording\b/i.test(name) &&
    !/Remix|Audio Book|Narration|Storytelling|Opera/i.test(name)
  ) {
    return "song";
  }
  if (/\bAlbum\b/i.test(name) || /\bSoundtrack\b/i.test(name)) return "album";
  if (/\bNew [A-Za-z& ]*Artist\b/i.test(name)) return "artist";
  return undefined;
}

/**
 * 金曲奖分类归属推导（按顺序匹配，注意表演者判断先于歌曲，
 * 避免「最佳国语歌曲男演唱人奖」这类表演者奖被误判为 song）：
 * 1. 技术 / 特别奖（作词、作曲、编曲、制作人、MV、装帧、包装、录音、特别奖、评审团奖）→ 无 kind
 *    （演唱/演奏录音专辑奖的获奖者是录音师而非专辑艺人，同样归入无 kind）
 * 2. 专辑 / 唱片类 → album
 * 3. 表演者类（歌手、演唱人、乐团、新人、组合、团体、演奏、传统音乐诠释）→ album
 *    （表演者历来凭某张专辑获奖，title 即专辑名，按专辑解析跳详情更实用）
 * 4. 歌曲类 → song
 */
export function gmaKind(name: string): AwardKind | undefined {
  if (/作词|作曲|编曲|制作人|录影带|MV|装帧|包装|录音|特别|评审/.test(name))
    return undefined;
  if (name.includes("专辑") || name.includes("唱片")) return "album";
  if (/歌手|演唱|乐团|新人|组合|团体|演奏人|演奏奖|诠释/.test(name))
    return "album";
  if (name.includes("歌曲")) return "song";
  return undefined;
}

/**
 * 无 kind 分类的 title 是否为专辑名（决定兜底搜索是否设 album 意图）：
 * 专辑 / 唱片 / 装帧 / 包装 / 录音（GMA）与 Album Notes / Package /
 * Engineered / Immersive（Grammy）等技术类奖项的 title 为专辑名；
 * 词曲、MV、Remix 类的 title 为歌曲名。
 */
export function awardTitleIsAlbum(award: string, name: string): boolean {
  if (award === "gma") return /专辑|唱片|装帧|包装|录音/.test(name);
  return /Album|Soundtrack|Package|Notes|Engineered|Immersive/i.test(name);
}

/**
 * 获奖者是否为纯技术署名（装帧设计、录音/混音/母带工程师、专辑包装、
 * Grammy 录音工程 / 内页撰写等）。此类人名对搜索无益，兜底关键词只保留作品名。
 */
export function awardWinnerIsTechnicalCredit(
  award: string,
  name: string
): boolean {
  if (award === "gma") return /装帧|包装|录音/.test(name);
  return /Package|Notes|Engineered|Immersive/i.test(name);
}

export function awardKind(award: AwardId, name: string): AwardKind | undefined {
  return award === "grammy" ? grammyKind(name) : gmaKind(name);
}

/** 归一化后的奖项分类条目 */
export interface AwardCategory {
  name: string;
  winner: string;
  /** 歌曲/专辑名；年度制作人等非作品奖项为 null */
  title: string | null;
  kind?: AwardKind;
  nominees?: string[];
}

export interface AwardData {
  award: AwardId;
  year: number;
  edition?: number;
  categories: AwardCategory[];
}

/** chartly-api 两种原始响应（grammy 无 source/year，gma 无 nominees）的交集形状 */
interface RawAwardResponse {
  source?: string;
  year?: number;
  edition?: number;
  url?: string;
  categories?: RawAwardCategory[];
}

interface RawAwardCategory {
  name?: unknown;
  winner?: unknown;
  title?: unknown;
  nominees?: unknown;
}

/** grammy 端点无 edition 字段，从页签 url 提取届数（"…/68th-annual-grammy-awards-2025/" → 68） */
export const editionFromUrl = (url?: string): number | undefined => {
  const m = url?.match(/(\d+)(?:st|nd|rd|th)\b/i);
  const n = m ? Number(m[1]) : NaN;
  return Number.isInteger(n) && n > 0 ? n : undefined;
};

/**
 * 归一化 grammy / gma 两种响应到 AwardData。
 * grammy 端点缺 source/year/edition，用入参兜底、edition 从 url 解析；字段非法时按缺失处理。
 */
export function normalizeAwardResponse(
  raw: RawAwardResponse,
  award: AwardId,
  fallbackYear: number
): AwardData {
  const categories: AwardCategory[] = (raw?.categories ?? [])
    .filter(
      (c): c is RawAwardCategory & { name: string; winner: string } =>
        typeof c?.name === "string" && typeof c?.winner === "string"
    )
    .map((c) => ({
      name: c.name,
      winner: c.winner,
      title: typeof c.title === "string" && c.title ? c.title : null,
      kind: awardKind(award, c.name),
      nominees: Array.isArray(c.nominees)
        ? c.nominees.filter((n): n is string => typeof n === "string")
        : undefined,
    }));

  return {
    award,
    year: typeof raw?.year === "number" ? raw.year : fallbackYear,
    edition:
      typeof raw?.edition === "number" ? raw.edition : editionFromUrl(raw?.url),
    categories,
  };
}

/** 获奖者串拆成歌手数组："Kendrick Lamar , SZA" / "裘德、崔展鸿" */
export const splitAwardArtists = (winner: string): string[] =>
  winner
    .split(/\s*[,，、&]\s*|\s+\/\s+/)
    .map((s) => s.trim())
    .filter(Boolean);

/** 去掉 Grammy 标题里的来源注释，如 `Bad As I Used To Be [From "F1® The Movie"]` */
export const cleanAwardTitle = (title: string): string =>
  title.replace(/\s*[[［][^\]］]*[\]］]\s*/g, "").trim();

/**
 * 奖项分类 -> 占位 MusicTrack 列表（仅 song 类，供播放上下文与导入歌单）。
 * 与 Billboard 一致：source:"all"、无真实 url；点击播放时 getUrl 失败后由播放器自动换源。
 */
export function toAwardTracks(data: AwardData): MusicTrack[] {
  const tracks: MusicTrack[] = [];
  data.categories.forEach((category, index) => {
    if (category.kind !== "song" || !category.title) return;
    const id = `award:${data.award}:${data.year}:${index}`;
    tracks.push({
      id,
      name: cleanAwardTitle(category.title),
      artist: splitAwardArtists(category.winner),
      album: category.name,
      pic_id: "",
      url_id: id,
      lyric_id: "",
      source: "all",
    });
  });
  return tracks;
}

/**
 * 拉取指定奖项某届获奖名单（直连 chartly-api，静态数据）。
 * year 缺省时由调用方传 meta.latestYear；走 cachedFetch 缓存优先。
 */
export async function fetchAward(
  awardId: AwardId,
  year: number
): Promise<AwardData> {
  const url = `${CHARTLY_API_BASE}/api/awards/${awardId}/${year}`;
  // v3：缓存条目自 edition（grammy 从 url 解析）起结构变更，作废旧版本缓存
  const cacheKey = `awards:v3:${awardId}:${year}`;

  const data = await cachedFetch<AwardData>(
    cacheKey,
    async () => {
      try {
        const res = await fetchWithTimeout(url, {}, AWARDS_API_TIMEOUT_MS);
        if (!res.ok) {
          throw new Error(`chartly-api ${awardId}/${year} HTTP ${res.status}`);
        }
        const raw = (await res.json()) as RawAwardResponse;
        return normalizeAwardResponse(raw, awardId, year);
      } catch (e) {
        logger.error(
          "Awards",
          `Fetch ${awardId} at ${year} failed`,
          e instanceof Error ? e : undefined
        );
        throw e;
      }
    },
    AWARDS_TTL
  );

  if (!data) throw new Error(`awards:${awardId}:${year} fetch failed`);
  return data;
}

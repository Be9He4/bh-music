import type { MusicTrack } from "@/types/music";
import zhT2SMap from "./zh-t2s-map.json";

/* -------------------------------------------------- */
/* 基础配置与正则（提取到模块级，避免重复编译） */
/* -------------------------------------------------- */

const tMap = new Map<string, string>(Object.entries(zhT2SMap));
Object.entries({ 妳: "你", 祢: "你", 牠: "它", 祂: "他" }).forEach(([k, v]) =>
  tMap.set(k, v)
);

const RE_BRACKETS_G = /[([{【（].*?[)\]}】）]/g;
const RE_BRACKETS_S = /[([{【（](.*?)[)\]}】）]/;
const RE_CHINESE = /[\u4e00-\u9fa5]/g;
const RE_SYMBOLS = /[^\p{L}\p{N}_]/gu;
// \p{L} = 所有语言的字母, \p{N} = 所有数字 —— 避免误删韩文/日文等非 CJK 文字
const RE_SPACES = /\s+/g;

/* -------------------------------------------------- */
/* 核心转换（DRY 原则：复用转小写、NFKC和简繁转换） */
/* -------------------------------------------------- */

const baseNorm = (v: string): string =>
  v
    ? v
        .toLowerCase()
        .normalize("NFKC")
        .replace(RE_CHINESE, (c) => tMap.get(c) ?? c)
    : "";

export const convertT2SOnly = baseNorm;

export const normalizeText = (v: string): string => {
  if (!v) return "";
  const base = baseNorm(v);
  const stripped = base
    .replace(RE_BRACKETS_G, " ")
    .replace(RE_SYMBOLS, "")
    .trim();
  return stripped || v.toLowerCase().replace(RE_SPACES, "");
};

export const normalizeArtists = (artists: string[]) =>
  artists.map(normalizeText).filter(Boolean).sort();

/* -------------------------------------------------- */
/* 匹配与校验逻辑 */
/* -------------------------------------------------- */

const stripBracketsKeepSymbols = (s: string): string =>
  baseNorm(s).replace(RE_BRACKETS_G, "").replace(RE_SPACES, "");

const isRawArtistCompatible = (a1: string, a2: string): boolean => {
  const r1 = stripBracketsKeepSymbols(a1);
  const r2 = stripBracketsKeepSymbols(a2);
  if (!r1 || !r2 || r1 === r2) return true;

  if (r1.includes(r2)) return /[\w\u4e00-\u9fa5]/.test(r1.replace(r2, ""));
  if (r2.includes(r1)) return /[\w\u4e00-\u9fa5]/.test(r2.replace(r1, ""));
  return true;
};

const getAlias = (s: string): string =>
  normalizeText(s.match(RE_BRACKETS_S)?.[1] || "");

export const isNameMatch = (name1: string, name2: string): boolean => {
  const n1 = normalizeText(name1),
    n2 = normalizeText(name2);
  if (n1 === n2) return true;
  const a1 = getAlias(name1),
    a2 = getAlias(name2);
  return (a1 && a1 === n2) || (a2 && a2 === n1) || false;
};

const expandArtistWithAlias = (artist: string): string[] => {
  const n = normalizeText(artist);
  const a = getAlias(artist);
  return a ? [n, a, n + a] : [n];
};

export const isArtistMatch = (
  artists1: string[],
  artists2: string[]
): boolean => {
  const exp1 = artists1.map((a) => ({ raw: a, exp: expandArtistWithAlias(a) }));
  const exp2 = artists2.map((a) => ({ raw: a, exp: expandArtistWithAlias(a) }));

  return exp1.some((a1) =>
    exp2.some(
      (a2) =>
        a1.exp.some((e1) => a2.exp.includes(e1)) &&
        isRawArtistCompatible(a1.raw, a2.raw)
    )
  );
};

const includesEither = (left: string, right: string): boolean =>
  !!(left && right) && (left.includes(right) || right.includes(left));

export const isNameContainsMatch = (name1: string, name2: string): boolean => {
  const n1 = normalizeText(name1),
    n2 = normalizeText(name2);
  if (includesEither(n1, n2)) return true;
  const a1 = getAlias(name1),
    a2 = getAlias(name2);
  return (!!a1 && includesEither(a1, n2)) || (!!a2 && includesEither(a2, n1));
};

export const isArtistContainsMatch = (
  artists1: string[],
  artists2: string[]
): boolean => {
  const n1Arr = artists1
    .map((a) => ({ raw: a, norm: normalizeText(a) }))
    .filter((x) => x.norm);
  const n2Arr = artists2
    .map((a) => ({ raw: a, norm: normalizeText(a) }))
    .filter((x) => x.norm);

  return n1Arr.some((a1) =>
    n2Arr.some(
      (a2) =>
        includesEither(a1.norm, a2.norm) &&
        isRawArtistCompatible(a1.raw, a2.raw)
    )
  );
};

/* -------------------------------------------------- */
/* 稳定 Key */
/* -------------------------------------------------- */

export const getExactKey = (t: MusicTrack): string =>
  `${normalizeText(t.name)}|${normalizeArtists(t.artist).join("/")}`;

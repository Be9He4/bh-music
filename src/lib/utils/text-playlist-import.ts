import { v4 as uuidv4 } from "uuid";
import type { MusicTrack } from "@/types/music";

export interface TextPlaylistInput {
  name: string;
  tracks: TextTrackInput[];
}

export interface TextTrackInput {
  name: string;
  artist: string[];
}

export interface ValidatedTextResult {
  valid: true;
  data: TextPlaylistInput;
}

export interface InvalidTextResult {
  valid: false;
  error: string;
}

type ParseResult = ValidatedTextResult | InvalidTextResult;

function extractJsonFromMarkdown(text: string): string {
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
  return codeBlockMatch ? codeBlockMatch[1].trim() : text.trim();
}

function validateSchema(data: unknown): ParseResult {
  if (typeof data !== "object" || data === null) {
    return { valid: false, error: "输入不是有效的 JSON 对象，请检查格式" };
  }

  const obj = data as Record<string, unknown>;

  if (typeof obj.name !== "string" || !obj.name.trim()) {
    return { valid: false, error: "缺少或无效的「歌单名称」(name)" };
  }

  if (!Array.isArray(obj.tracks) || obj.tracks.length === 0) {
    return { valid: false, error: "缺少或为空的「歌曲列表」(tracks)" };
  }

  const validTracks: TextTrackInput[] = [];

  for (let i = 0; i < obj.tracks.length; i++) {
    const t = obj.tracks[i];
    if (typeof t !== "object" || t === null) continue;

    const track = t as Record<string, unknown>;
    const name = typeof track.name === "string" ? track.name.trim() : "";
    const artist: string[] = Array.isArray(track.artist)
      ? track.artist.filter(
          (a): a is string => typeof a === "string" && a.trim().length > 0
        )
      : [];

    if (name && artist.length > 0) {
      validTracks.push({ name, artist });
    }
  }

  if (validTracks.length === 0) {
    return {
      valid: false,
      error: "所有歌曲均缺少「歌名」(name) 或「歌手」(artist) 字段",
    };
  }

  return {
    valid: true,
    data: {
      name: obj.name.trim(),
      tracks: validTracks,
    },
  };
}

export function validateAndParse(text: string): ParseResult {
  if (!text || !text.trim()) {
    return { valid: false, error: "输入内容为空" };
  }

  const extracted = extractJsonFromMarkdown(text);

  let parsed: unknown;
  try {
    parsed = JSON.parse(extracted);
  } catch {
    return {
      valid: false,
      error: "无法解析输入的 JSON 格式，请检查是否包含无效字符",
    };
  }

  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      return { valid: false, error: "JSON 数组为空" };
    }
    return validateSchema({ name: "导入歌单", tracks: parsed });
  }

  return validateSchema(parsed);
}

export function convertToMusicTracks(input: TextPlaylistInput): MusicTrack[] {
  return input.tracks.map((t): MusicTrack => {
    const id = uuidv4();
    return {
      id,
      name: t.name,
      artist: t.artist,
      album: "",
      pic_id: "",
      url_id: id,
      lyric_id: "",
      source: "all",
    };
  });
}

export const TEXT_IMPORT_PROMPT = `请将以下歌曲列表转换为规范的 JSON 格式。每首歌包含 name（歌名）和 artist（歌手名数组）字段。

输出格式要求：
- 顶层对象包含 name（歌单名称）和 tracks（歌曲数组）
- 示例：
\`\`\`json
{
  "name": "我的歌单",
  "tracks": [
    { "name": "晴天", "artist": ["周杰伦"] },
    { "name": "浮夸", "artist": ["陈奕迅"] }
  ]
}
\`\`\`

请严格按此格式输出，不要添加额外说明文字。歌曲列表：`;

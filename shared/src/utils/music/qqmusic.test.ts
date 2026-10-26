import { describe, expect, it } from "vitest";
import {
  buildQqSearchApiPath,
  buildVkeyRequestBody,
  extractVkeyUrl,
  orderQqQualityKeys,
  parseQqSosoSearchResponse,
  qqBrToQualityKey,
} from "./qqmusic";
import type {
  QqSosoSearchResponse,
  QqVkeyResponse,
} from "../../types/music-platforms";

function buildVkeyResponse(
  sip: string[],
  midurlinfo: { purl: string; filename: string }[]
): QqVkeyResponse {
  return { req_1: { code: 0, data: { sip, midurlinfo } } };
}

describe("buildQqSearchApiPath", () => {
  it("builds soso search path with encoded query and page params", () => {
    const path = buildQqSearchApiPath("周杰伦", 2, 20);

    expect(path.startsWith("/soso/fcgi-bin/client_search_cp?")).toBe(true);
    expect(path).toContain("w=%E5%91%A8%E6%9D%B0%E4%BC%A6");
    expect(path).toContain("p=2");
    expect(path).toContain("n=20");
  });

  it("does not include new_json param (upstream returns empty list with it)", () => {
    expect(buildQqSearchApiPath("jay", 1, 20)).not.toContain("new_json");
  });
});

describe("parseQqSosoSearchResponse", () => {
  it("converts soso song list and computes hasMore", () => {
    const data: QqSosoSearchResponse = {
      code: 0,
      data: {
        song: {
          totalnum: 45,
          list: [
            {
              songmid: "m1",
              songname: "song",
              singer: [{ name: "a" }],
              albummid: "al",
              albumname: "album",
            },
          ],
        },
      },
    };

    const res = parseQqSosoSearchResponse(data, 1, 20);

    expect(res.items).toHaveLength(1);
    expect(res.items[0]).toMatchObject({
      id: "qq_m1",
      name: "song",
      artist: ["a"],
      album: "album",
      source: "qq",
    });
    expect(res.hasMore).toBe(true);
  });

  it("returns empty result when code is non-zero", () => {
    expect(parseQqSosoSearchResponse({ code: 2001 }, 1, 20)).toEqual({
      items: [],
      hasMore: false,
    });
  });

  it("sets hasMore false when no more pages", () => {
    const data: QqSosoSearchResponse = {
      code: 0,
      data: { song: { totalnum: 20, list: [] } },
    };

    expect(parseQqSosoSearchResponse(data, 1, 20).hasMore).toBe(false);
  });
});

describe("buildVkeyRequestBody", () => {
  it("uses anonymous credentials by default", () => {
    const body = buildVkeyRequestBody("song-mid", ["320k"]);

    expect(body.loginUin).toBe("0");
    expect(body.comm.uin).toBe("0");
    expect(body.req_1.param.uin).toBe("0");
  });

  it("uses the authenticated uin when provided", () => {
    const body = buildVkeyRequestBody("song-mid", ["320k"], "123456");

    expect(body.loginUin).toBe("123456");
    expect(body.comm.uin).toBe("123456");
    expect(body.req_1.param.uin).toBe("123456");
  });
});

describe("qqBrToQualityKey", () => {
  it("caps at 320k for high bitrates", () => {
    expect(qqBrToQualityKey(320)).toBe("320k");
    expect(qqBrToQualityKey(999)).toBe("320k");
  });

  it("falls back to 128k below 320 (no 192 tier on QQ)", () => {
    expect(qqBrToQualityKey(192)).toBe("128k");
    expect(qqBrToQualityKey(128)).toBe("128k");
  });

  it("defaults to 320k", () => {
    expect(qqBrToQualityKey()).toBe("320k");
  });
});

describe("orderQqQualityKeys", () => {
  it("puts the preferred key first and keeps the rest in default order", () => {
    expect(orderQqQualityKeys("128k")).toEqual(["128k", "320k", "m4a"]);
  });

  it("returns the default order when preferred is unknown", () => {
    expect(orderQqQualityKeys("flac")).toEqual(["320k", "128k", "m4a"]);
  });
});

describe("extractVkeyUrl", () => {
  const purlInfo = [
    {
      purl: "C400songmid.m4a?guid=10000&key=vkey&uin=0",
      filename: "C400songmid.m4a",
    },
  ];

  it("returns the first non-empty purl joined with the base sip", () => {
    const data = buildVkeyResponse(
      ["https://ws.stream.qqmusic.qq.com/"],
      purlInfo
    );
    expect(extractVkeyUrl(data)).toBe(
      "https://ws.stream.qqmusic.qq.com/C400songmid.m4a?guid=10000&key=vkey&uin=0"
    );
  });

  it("prefers the https mirror over http mirrors", () => {
    const data = buildVkeyResponse(
      ["http://ws.stream.qqmusic.qq.com/", "https://ws.stream.qqmusic.qq.com/"],
      purlInfo
    );
    expect(extractVkeyUrl(data)?.startsWith("https://")).toBe(true);
  });

  it("upgrades an http mirror to https when no https mirror exists", () => {
    const data = buildVkeyResponse(
      ["http://ws.stream.qqmusic.qq.com/"],
      purlInfo
    );
    expect(extractVkeyUrl(data)).toBe(
      "https://ws.stream.qqmusic.qq.com/C400songmid.m4a?guid=10000&key=vkey&uin=0"
    );
  });

  it("skips empty purls and returns null when none is playable", () => {
    const data = buildVkeyResponse(
      ["http://ws.stream.qqmusic.qq.com/"],
      [
        { purl: "", filename: "C400a.m4a" },
        { purl: "", filename: "M500a.mp3" },
      ]
    );
    expect(extractVkeyUrl(data)).toBeNull();
  });

  it("returns null when sip or midurlinfo is missing", () => {
    expect(extractVkeyUrl(buildVkeyResponse([], purlInfo))).toBeNull();
    expect(
      extractVkeyUrl(
        buildVkeyResponse(["http://ws.stream.qqmusic.qq.com/"], [])
      )
    ).toBeNull();
  });
});

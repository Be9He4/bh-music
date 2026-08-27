import { afterEach, describe, expect, it, vi } from "vitest";
import {
  getQqUinFromCookie,
  getQqUserByCookie,
  normalizeQqCookie,
} from "./qqmusic-auth";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("normalizeQqCookie", () => {
  it("removes a Cookie header prefix before persistence", () => {
    expect(normalizeQqCookie(" Cookie: uin=123456; qm_keyst=secret ")).toBe(
      "uin=123456; qm_keyst=secret"
    );
  });
});

describe("getQqUinFromCookie", () => {
  it("reads uin from a complete Cookie", () => {
    expect(getQqUinFromCookie("uin=123456; qm_keyst=secret")).toBe("123456");
  });

  it("supports an openid-style wxuin fallback", () => {
    expect(getQqUinFromCookie("wxuin=oABC123; qm_keyst=secret")).toBe(
      "1ABC123"
    );
  });

  it("keeps a numeric wxuin unchanged", () => {
    expect(
      getQqUinFromCookie("wxuin=1152921504861462128; qm_keyst=secret")
    ).toBe("1152921504861462128");
  });

  it("accepts a Cookie header prefix", () => {
    expect(getQqUinFromCookie("Cookie: uin=123456; qm_keyst=secret")).toBe(
      "123456"
    );
  });

  it("returns null when no QQ identity is present", () => {
    expect(getQqUinFromCookie("qm_keyst=secret")).toBeNull();
  });
});

describe("getQqUserByCookie", () => {
  it("uses the Vite proxy with the Cookie in web development", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          base: {
            data: {
              map_userinfo: {
                "123456": { nick: "Test User", headurl: "avatar" },
              },
            },
          },
        }),
        { status: 200 }
      )
    );
    vi.stubGlobal("fetch", fetchMock);

    await expect(
      getQqUserByCookie("uin=123456; qm_keyst=secret")
    ).resolves.toEqual({
      uin: "123456",
      nickname: "Test User",
      avatarUrl: "avatar",
      isVip: false,
    });

    expect(fetchMock).toHaveBeenCalledWith(
      expect.stringContaining("/api/qqmusic-search/cgi-bin/musicu.fcg"),
      { headers: { "X-Real-Cookie": "uin=123456; qm_keyst=secret" } }
    );
  });
});

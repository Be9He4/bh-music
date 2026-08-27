import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

let mockCapacitor: any;

beforeEach(() => {
  mockCapacitor = {
    CapacitorHttp: { request: vi.fn() },
  };
  vi.doMock("@capacitor/core", () => mockCapacitor);
});

afterEach(() => {
  vi.resetModules();
});

describe("bilibili-auth", () => {
  it("normalizes bilibili cookie", async () => {
    const { normalizeBilibiliCookie } = await import("./bilibili-auth");
    expect(normalizeBilibiliCookie("  SESSDATA=abc; DedeUserID=1  ")).toBe(
      "SESSDATA=abc; DedeUserID=1"
    );
    expect(normalizeBilibiliCookie("Cookie: SESSDATA=abc")).toBe(
      "SESSDATA=abc"
    );
  });

  it("returns profile when nav reports logged in", async () => {
    mockCapacitor.CapacitorHttp.request.mockResolvedValue({
      status: 200,
      data: {
        code: 0,
        data: { isLogin: true, mid: 123, uname: "UP主", face: "//face.jpg" },
      },
    });

    const { getBilibiliUserByCookie } = await import("./bilibili-auth");
    const profile = await getBilibiliUserByCookie(
      "SESSDATA=abc; DedeUserID=123"
    );

    expect(profile).toEqual({ mid: 123, uname: "UP主", face: "//face.jpg" });
    const url = mockCapacitor.CapacitorHttp.request.mock.calls[0][0].url;
    expect(url).toContain("/x/web-interface/nav");
    const headers =
      mockCapacitor.CapacitorHttp.request.mock.calls[0][0].headers;
    expect(headers.Cookie).toContain("SESSDATA=abc");
  });

  it("returns null when not logged in", async () => {
    mockCapacitor.CapacitorHttp.request.mockResolvedValue({
      status: 200,
      data: { code: 0, data: { isLogin: false } },
    });

    const { getBilibiliUserByCookie } = await import("./bilibili-auth");
    await expect(getBilibiliUserByCookie("SESSDATA=abc")).resolves.toBeNull();
  });

  it("returns null for empty cookie", async () => {
    const { getBilibiliUserByCookie } = await import("./bilibili-auth");
    await expect(getBilibiliUserByCookie("  ")).resolves.toBeNull();
  });
});

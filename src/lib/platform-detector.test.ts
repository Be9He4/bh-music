import { describe, expect, it } from "vitest";
import { detectPlatform } from "./platform-detector";

describe("detectPlatform", () => {
  it("detects supported QQ Music domains", () => {
    expect(detectPlatform("https://y.qq.com/n/yqq/playlist/7177076625.html")).toBe("qq");
    expect(detectPlatform("https://i.y.qq.com/n2/m/share/details/taoge.html?id=7177076625")).toBe("qq");
    expect(
      detectPlatform(
        "https://i2.y.qq.com/n3/other/pages/details/playlist.html?platform=11&id=3569246560"
      )
    ).toBe("qq");
  });

  it("detects supported NetEase Music domains", () => {
    expect(detectPlatform("https://music.163.com/#/playlist?id=123")).toBe("netease");
    expect(detectPlatform("https://y.music.163.com/m/playlist?id=123")).toBe("netease");
  });

  it("rejects unsupported domains", () => {
    expect(detectPlatform("https://example.com/playlist?id=3569246560")).toBeNull();
    expect(detectPlatform("not a url")).toBeNull();
  });
});

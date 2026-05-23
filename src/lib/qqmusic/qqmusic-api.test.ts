import { describe, expect, it } from "vitest";
import { parseQqMusicUrl } from "./qqmusic-api";

describe("parseQqMusicUrl", () => {
  it("extracts playlist id from path-based QQ Music links", () => {
    expect(parseQqMusicUrl("https://y.qq.com/n/yqq/playlist/7177076625.html")).toBe("7177076625");
  });

  it("extracts playlist id from query-based QQ Music share links", () => {
    expect(
      parseQqMusicUrl(
        "https://i2.y.qq.com/n3/other/pages/details/playlist.html?platform=11&appshare=android_qq&appversion=20040508&hosteuin=oK6kowEAoK4z7ecsoKvsow6ANn**&id=3569246560&ADTAG=wxfshare"
      )
    ).toBe("3569246560");
  });

  it("rejects links without a numeric playlist id", () => {
    expect(parseQqMusicUrl("https://y.qq.com/n/yqq/playlist/not-a-number.html")).toBeNull();
    expect(parseQqMusicUrl("https://i.y.qq.com/n2/m/share/details/taoge.html?id=abc")).toBeNull();
  });
});

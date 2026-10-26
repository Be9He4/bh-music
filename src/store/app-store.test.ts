import { describe, expect, it, vi, afterEach } from "vitest";
import { useAppStore } from "./app-store";
import { idbStorage } from "@/lib/storage-adapter";
import { storeKey } from "./store-keys";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
  },
}));

vi.mock("@/lib/api/update", () => ({
  checkUpdate: vi.fn().mockResolvedValue({
    latestVersion: "0.0.0",
    downloadUrl: "",
    changelog: "",
  }),
}));

vi.mock("@capacitor/app", () => ({
  App: { getInfo: vi.fn().mockResolvedValue({ version: "0.0.0" }) },
}));

describe("app-store persistence (partialize)", () => {
  afterEach(() => {
    vi.mocked(idbStorage.getItem).mockReset();
  });

  it("should persist allowSimultaneousPlayback", () => {
    useAppStore.setState({ allowSimultaneousPlayback: true });

    const call = vi
      .mocked(idbStorage.setItem)
      .mock.calls.find(([name]) => name === storeKey.AppStore);
    expect(call).toBeDefined();

    const persisted = JSON.parse(call![1]);
    expect(persisted.state.allowSimultaneousPlayback).toBe(true);
  });

  it("should restore allowSimultaneousPlayback on rehydrate", async () => {
    vi.mocked(idbStorage.getItem).mockResolvedValue(
      JSON.stringify({
        state: { allowSimultaneousPlayback: true },
        version: 0,
      })
    );

    await useAppStore.persist.rehydrate();
    expect(useAppStore.getState().allowSimultaneousPlayback).toBe(true);

    useAppStore.setState({ allowSimultaneousPlayback: false });
  });
});

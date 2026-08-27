import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/storage-adapter", () => ({
  idbStorage: {
    getItem: vi.fn(async () => null),
    setItem: vi.fn(async () => undefined),
    removeItem: vi.fn(async () => undefined),
  },
}));

vi.mock("@/lib/crypto-storage", () => ({
  encryptString: vi.fn(async (str: string) => `mock_encrypted:${str}`),
  decryptString: vi.fn(async (str: string) =>
    str.replace("mock_encrypted:", "")
  ),
}));

import { useWebdavStore } from "./webdav-store";

describe("webdav store", () => {
  it("sets and clears config", () => {
    useWebdavStore.setState({ url: "", username: "", password: null });

    useWebdavStore.getState().setConfig({
      url: "https://dav.example.com/backup",
      username: "user",
      password: "pass",
    });

    expect(useWebdavStore.getState()).toMatchObject({
      url: "https://dav.example.com/backup",
      username: "user",
      password: "pass",
    });

    useWebdavStore.getState().clearConfig();

    expect(useWebdavStore.getState()).toMatchObject({
      url: "",
      username: "",
      password: null,
    });
  });
});

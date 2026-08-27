import { create } from "zustand";
import { persist, type StorageValue } from "zustand/middleware";
import { storeKey } from "./store-keys";
import { idbStorage } from "@/lib/storage-adapter";
import { encryptString, decryptString } from "@/lib/crypto-storage";

interface WebdavConfig {
  url: string;
  username: string;
  password: string;
}

interface WebdavState {
  url: string;
  username: string;
  password: string | null;

  setConfig: (config: WebdavConfig) => void;
  clearConfig: () => void;
}

type PersistedState = {
  url: string;
  username: string;
  password: string | null;
};

/**
 * 在 idbStorage 基础上透明加密 password 字段。
 * 与 sync-store 相同模式，只有敏感密码密文落盘。
 */
const encryptedWebdavStorage = {
  getItem: async (
    name: string
  ): Promise<StorageValue<PersistedState> | null> => {
    const raw = await idbStorage.getItem(name);
    if (!raw) return null;
    const parsed: StorageValue<PersistedState> = JSON.parse(raw);
    const encryptedPassword = parsed.state?.password;
    if (encryptedPassword) {
      try {
        parsed.state.password = await decryptString(encryptedPassword);
      } catch {
        // 可能是旧版明文数据，直接使用原值
      }
    }
    return parsed;
  },
  setItem: async (
    name: string,
    value: StorageValue<PersistedState>
  ): Promise<void> => {
    const toStore = structuredClone(value);
    if (toStore.state.password) {
      toStore.state.password = await encryptString(toStore.state.password);
    }
    await idbStorage.setItem(name, JSON.stringify(toStore));
  },
  removeItem: async (name: string): Promise<void> => {
    await idbStorage.removeItem(name);
  },
};

export const useWebdavStore = create<WebdavState>()(
  persist(
    (set) => ({
      url: "",
      username: "",
      password: null,

      setConfig: ({ url, username, password }) =>
        set({ url, username, password }),
      clearConfig: () => set({ url: "", username: "", password: null }),
    }),
    {
      name: storeKey.WebdavStore,
      storage: encryptedWebdavStorage,
      partialize: (state) => ({
        url: state.url,
        username: state.username,
        password: state.password,
      }),
    }
  )
);

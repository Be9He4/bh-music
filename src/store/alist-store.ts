import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import { v4 as uuidv4 } from "uuid";
import { idbStorage } from "@/lib/storage-adapter";
import { storeKey } from "./store-keys";
import type { AlistServer } from "@/types/alist";

interface AlistState {
  servers: AlistServer[];
  addServer: (
    name: string,
    serverUrl: string,
    token?: string,
    rootPath?: string
  ) => string;
  updateServer: (
    id: string,
    data: Pick<AlistServer, "name" | "serverUrl" | "token" | "rootPath">
  ) => void;
  removeServer: (id: string) => void;
  setServers: (servers: AlistServer[]) => void;
}

const markUpdate = (item: AlistServer): AlistServer => ({
  ...item,
  update_time: Date.now(),
});

export const useAlistStore = create<AlistState>()(
  persist(
    (set) => ({
      servers: [],
      addServer: (name, serverUrl, token, rootPath) => {
        const id = uuidv4();
        set((state) => ({
          servers: [
            markUpdate({
              id,
              name,
              serverUrl,
              token,
              rootPath,
              is_deleted: false,
            }),
            ...state.servers,
          ],
        }));
        return id;
      },
      updateServer: (id, data) =>
        set((state) => ({
          servers: state.servers.map((item) =>
            item.id === id
              ? markUpdate({ ...item, ...data, is_deleted: false })
              : item
          ),
        })),
      removeServer: (id) =>
        set((state) => ({
          servers: state.servers.map((item) =>
            item.id === id ? markUpdate({ ...item, is_deleted: true }) : item
          ),
        })),
      setServers: (servers) =>
        set({
          servers,
        }),
    }),
    {
      name: storeKey.AlistStore,
      storage: createJSONStorage(() => idbStorage),
      partialize: (state) => ({ servers: state.servers }),
    }
  )
);

/// <reference lib="webworker" />
import { precacheAndRoute } from "workbox-precaching";
import { registerRoute } from "workbox-routing";
import { NetworkFirst, CacheFirst } from "workbox-strategies";
import { ExpirationPlugin } from "workbox-expiration";
import { CacheableResponsePlugin } from "workbox-cacheable-response";
import { clientsClaim } from "workbox-core";

declare let self: ServiceWorkerGlobalScope;

// Auto-update: 立即激活新版本 Service Worker
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);

registerRoute(
  ({ request }) => request.mode === "navigate",
  new NetworkFirst({
    cacheName: "pages-cache",
    networkTimeoutSeconds: 3,
    plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 5 * 60 })],
  })
);

registerRoute(
  ({ request }) => {
    // 代理备用线路 URL 不参与缓存（路径为 /proxy 的请求视为瞬时中转）
    if (new URL(request.url, self.location.origin).pathname === "/proxy") {
      return false;
    }

    const isAudioDestination = request.destination === "audio";
    const hasAudioExt = /\.(mp3|m4a|ogg|wav|flac|aac|mpe?g)(\?|$)/i.test(
      request.url
    );

    if (isAudioDestination || hasAudioExt) return true;

    const secFetchDest = request.headers.get("Sec-Fetch-Dest");
    if (secFetchDest === "empty") return false;
    if (!secFetchDest && request.destination === "") return false;

    return false;
  },
  new CacheFirst({
    cacheName: "audio-stream-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 100,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [200],
      }),
      {
        cacheWillUpdate: async ({ response }) => {
          if (response.status === 200) {
            return response;
          }
          return null;
        },
      },
    ],
    // ! 严禁使用 ignoreSearch， 避免B站音源缓存失效
  })
);

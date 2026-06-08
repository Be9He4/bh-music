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

let streamCacheEnabled = true;

const STREAM_CACHE_CHANNEL = new BroadcastChannel("stream-cache-preference");
STREAM_CACHE_CHANNEL.addEventListener("message", (event) => {
  if (event.data?.type === "set-stream-cache") {
    streamCacheEnabled = !!event.data.enabled;
  }
});

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
    const secFetchDest = request.headers.get("Sec-Fetch-Dest");
    if (secFetchDest === "empty") return false;
    if (!secFetchDest && request.destination === "") return false;
    return (
      request.destination === "audio" ||
      /\.(mp3|m4a|ogg|wav|flac|aac|mpe?g)(\?|$)/i.test(request.url)
    );
  },
  new CacheFirst({
    cacheName: "audio-stream-cache",
    plugins: [
      new ExpirationPlugin({
        maxEntries: 300,
        maxAgeSeconds: 30 * 24 * 60 * 60,
      }),
      new CacheableResponsePlugin({
        statuses: [0, 200, 206],
      }),
      {
        cacheWillUpdate: async ({ response }) => {
          if (!streamCacheEnabled) return null;
          if (
            response.status === 0 ||
            response.status === 200 ||
            response.status === 206
          ) {
            return response;
          }
          return null;
        },
      },
    ],
    matchOptions: {
      ignoreSearch: true,
    },
  })
);

/// <reference types="vitest" />
import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react-swc'
import { VitePWA } from 'vite-plugin-pwa'
import { readFileSync } from 'node:fs'
import { fileURLToPath, URL } from 'node:url'

const pkg = JSON.parse(
  readFileSync(new URL('./package.json', import.meta.url), 'utf-8'),
) as { version: string }

// https://vite.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      injectRegister: 'auto',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'Otter Music',
        short_name: 'Otter Music',
        description: '水獭音乐 - 开源免费音乐播放器',
        theme_color: '#58c9aa',
        background_color: '#f9fbfc',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/favicon.svg',
            sizes: 'any',
            type: 'image/svg+xml',
            purpose: 'any',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webp}'],
        runtimeCaching: [
          {
            urlPattern: ({ request }) =>
              request.destination === 'audio',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'audio-stream-cache',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 30 * 24 * 60 * 60,
              },
              cacheableResponse: {
                statuses: [0, 200, 206],
              },
              rangeRequests: true,
            },
          },
        ],
      },
    }),
    {
      name: 'kugou-resolve',
      configureServer(server) {
        server.middlewares.use('/api/kugou-resolve', async (req, res) => {
          const shortPath = req.url!.replace('/api/kugou-resolve', '') || '/';
          try {
            const fetchRes = await fetch(`https://t1.kugou.com${shortPath}`, {
              method: 'HEAD',
              redirect: 'manual',
            });
            const location = fetchRes.headers.get('location') || '';
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify({ resolvedUrl: location }));
          } catch {
            res.statusCode = 502;
            res.end(JSON.stringify({ error: 'Failed to resolve short link' }));
          }
        });
      },
    },
    {
      name: 'migu-resolve',
      configureServer(server) {
        server.middlewares.use('/api/migu-resolve', async (req, res) => {
          if (req.method !== 'POST') { res.statusCode = 405; res.end(); return; }
          let body = '';
          req.on('data', (chunk: Buffer) => body += chunk.toString());
          req.on('end', async () => {
            try {
              const { url }: { url?: string } = JSON.parse(body);
              if (!url) { res.statusCode = 400; res.end(JSON.stringify({ error: 'url required' })); return; }
              const parsed = new URL(url);
              if (parsed.hostname !== 'c.migu.cn') { res.statusCode = 400; res.end(JSON.stringify({ error: 'not a migu short link' })); return; }

              const fetchRes = await fetch(url, { redirect: 'manual' });
              const location = fetchRes.headers.get('location') || '';
              if (!location) { res.statusCode = 400; res.end(JSON.stringify({ error: 'no redirect' })); return; }

              const target = new URL(location);
              const playlistId = target.searchParams.get('id');
              res.setHeader('Content-Type', 'application/json');
              res.end(JSON.stringify({ playlistId: playlistId && /^\d+$/.test(playlistId) ? playlistId : null }));
            } catch {
              res.statusCode = 502;
              res.end(JSON.stringify({ error: 'resolve failed' }));
            }
          });
        });
      },
    },
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@otter-music/shared': fileURLToPath(
        new URL('./shared/src/index.ts', import.meta.url),
      ),
    },
  },
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'zustand',
      'lucide-react',
      'date-fns',
    ],
  },
  build: {
    minify: 'esbuild',
    target: 'es2018',
    cssMinify: true,
    cssCodeSplit: true,
    rollupOptions: {
      output: {
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
        manualChunks: (id) => {
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('react-dom')) {
              return 'react-vendor'
            }
          }
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './src/test/setup.ts',
  },
  server: {
    proxy: {
      '/api/netease': {
        target: 'https://music.163.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/netease/, ''),
        headers: {
          'Referer': 'https://music.163.com',
          'Origin': 'https://music.163.com'
        },
        // 添加 configure 钩子拦截并替换 Headers
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req) => {
            // 1. 还原 Cookie
            if (req.headers['x-real-cookie']) {
              proxyReq.setHeader('Cookie', req.headers['x-real-cookie']);
            }
            // 2. 还原 User-Agent
            if (req.headers['x-real-ua']) {
              proxyReq.setHeader('User-Agent', req.headers['x-real-ua']);
            }
            // 3. 还原伪装 IP
            if (req.headers['x-real-ip']) {
              proxyReq.setHeader('X-Real-IP', req.headers['x-real-ip']);
              proxyReq.setHeader('X-Forwarded-For', req.headers['x-real-ip']);
            }

            // 4. 清理前端发送的自定义 Header，防止被网易云识别为爬虫特征
            proxyReq.removeHeader('x-real-cookie');
            proxyReq.removeHeader('x-real-ua');
          });
        }
      },
      '/api/qqmusic': {
        target: 'https://i.y.qq.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/qqmusic/, ''),
        headers: {
          'Referer': 'https://y.qq.com/',
          'Origin': 'https://y.qq.com'
        },
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('Referer', 'https://y.qq.com/');
            proxyReq.setHeader('Origin', 'https://y.qq.com');
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          });
        }
      },
      '/api/kugou-global': {
        target: 'https://gateway.kugou.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/kugou-global/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi');
          });
        }
      },
      '/api/kugou-page': {
        target: 'https://www.kugou.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/kugou-page/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          });
        }
      },
      '/api/kugou-register': {
        target: 'https://userservice.kugou.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/kugou-register/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'Android15-1070-11083-46-0-DiscoveryDRADProtocol-wifi');
          });
        }
      },
      '/api/kugou': {
        target: 'http://mobilecdn.kugou.com',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/kugou/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          });
        }
      },
      '/api/kuwo': {
        target: 'http://nplserver.kuwo.cn',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/kuwo/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          });
        }
      },
      '/api/migu': {
        target: 'https://app.c.nf.migu.cn',
        changeOrigin: true,
        rewrite: (path: string) => path.replace(/^\/api\/migu/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.setHeader('User-Agent', 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
          });
        }
      }
    }
  }
})

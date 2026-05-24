## 1. Store 层 — 缓存配置持久化

- [x] 1.1 在 `src/store/music-store.ts` 的 `MusicState` 接口中新增 `enableStreamCache: boolean`、`streamCacheMaxSize: number`、`streamCacheMaxAgeDays: number` 及对应 setter
- [x] 1.2 在 store 初始化对象中设置默认值（`enableStreamCache: true`、`streamCacheMaxSize: 1073741824`、`streamCacheMaxAgeDays: 7`）
- [x] 1.3 在 `partialize` 返回对象中添加 `enableStreamCache`、`streamCacheMaxSize`、`streamCacheMaxAgeDays`

## 2. 缓存工具 — 统计查询与清理

- [x] 2.1 新建 `src/lib/cache-stats.ts`，实现 `formatBytes(bytes: number): string` 工具函数
- [x] 2.2 实现 `getAudioCacheStats()`：打开 `audio-stream-cache`，遍历条目计算总大小和条目数
- [x] 2.3 实现 `getStorageQuota()`：调用 `navigator.storage.estimate()` 返回 `{ usage, quota }`
- [x] 2.4 实现 `clearAudioCache()`：删除 `audio-stream-cache` 中所有条目
- [x] 2.5 实现 `cleanupByMaxAge(maxAgeDays: number)`：删除超过指定天数的缓存条目
- [x] 2.6 实现 `cleanupByMaxSize(maxSizeBytes: number)`：按 LRU 顺序删除条目直到总大小低于限制

## 3. UI 组件 — 设置项

- [x] 3.1 新建 `src/components/settings/StreamCacheSetting.tsx`，使用 SettingItem 展开模式
- [x] 3.2 实现主开关（`<Switch>`）绑定 `enableStreamCache`
- [x] 3.3 实现展开区域：缓存统计卡片（格式化显示条目数、占用空间、配额占比）和手动刷新按钮
- [x] 3.4 实现最大缓存大小 Select 下拉（256MB / 512MB / 1GB / 2GB / 无限制，映射为字节值）
- [x] 3.5 实现缓存过期时间 Select 下拉（1天 / 3天 / 7天 / 14天 / 30天），变更时触发 `cleanupByMaxAge`
- [x] 3.6 实现"清空缓存"按钮（调用 `clearAudioCache`，含确认对话框）

## 4. 集成

- [x] 4.1 在 `src/components/SettingsPage.tsx` 中引入 `StreamCacheSetting`，放置在"偏好设置"区域内

## 5. Workbox 配置对齐（可选）

- [x] 5.1 将 `vite.config.ts` 中 `audio-stream-cache` 的 `maxEntries` 从 50 上调至 500，`maxAgeSeconds` 从 7天 上调至 30天，确保 Workbox 基础限制宽松于用户配置

## 6. 验证

- [x] 6.1 构建生产版本，在浏览器中验证：开关默认开启、展开显示统计数据、修改配置后刷新页面持久化有效
- [x] 6.2 验证清空缓存功能：播放音频产生缓存后，清空缓存确认统计归零
- [x] 6.3 验证过期时间变更后触发清理

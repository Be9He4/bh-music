## Why

上次提交通过 Workbox Service Worker 实现了音频"边听边缓存"（NetworkFirst + Range 请求），但用户无法感知缓存状态，也无法控制缓存行为。需要一个直观的设置界面，让用户看到缓存占用了多少空间、缓存了多少歌曲，并能自定义缓存上限和过期时间。

## What Changes

- 在设置页新增"边听边缓存"设置项，点击展开查看缓存统计信息和配置项
- 显示缓存状态：已缓存条目数、已用空间 / 总配额、存储使用百分比
- 支持配置最大缓存大小：提供 256MB / 512MB / 1GB / 2GB / 无限制 五档选择，默认 1GB
- 支持配置缓存过期时间：提供 1天 / 3天 / 7天 / 14天 / 30天 五档选择，默认 7天
- 提供"清空缓存"按钮，一键清除所有已缓存的音频
- 主开关控制是否启用边听边缓存（关闭时跳过缓存写入）

## Capabilities

### New Capabilities
- `stream-cache-ui`: 设置页面中"边听边缓存"的 UI 展开项，包含开关、缓存统计、配置项和清空操作
- `stream-cache-store`: Zustand store 扩展，持久化缓存配置（开关、最大缓存大小、过期时间）

### Modified Capabilities
_(无现有 capability 需要修改)_

## Impact

- 修改 `src/store/music-store.ts` — 新增 3 个状态字段 + setter + partialize 白名单
- 修改 `src/components/SettingsPage.tsx` — 新增 `<StreamCacheSetting>` 引用
- 新增 `src/components/settings/StreamCacheSetting.tsx` — 主组件（展开式 SettingItem）
- 新增 `src/lib/cache-stats.ts` — 缓存统计查询工具（读 audio-stream-cache，计算大小）
- 依赖：现有 `caches` API、`navigator.storage.estimate()`、`vite.config.ts` 中的 Workbox `audio-stream-cache`
